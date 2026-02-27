import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALEADS_BASE_URL = "https://waleads.roote.com.br";
const MAX_WHATSAPP_LENGTH = 4000;

// ── Phone normalization ───
function normalizePhoneForMatch(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-9) : digits;
}

// ── Strip markdown for WhatsApp plain text ───
function stripMarkdownForWhatsApp(text: string): string {
  return text
    // Convert markdown links [text](url) → text: url
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")
    // Bold **text** → *text* (WhatsApp format)
    .replace(/\*\*([^*]+)\*\*/g, "*$1*")
    // Remove heading markers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove horizontal rules
    .replace(/^---+$/gm, "")
    // Trim excessive newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Consume SSE stream from dra-lia and return full text ───
async function consumeSSEStream(response: Response): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") return fullText;

      try {
        const parsed = JSON.parse(jsonStr);
        // Skip meta events
        if (parsed.type === "meta") continue;
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) fullText += content;
      } catch { /* partial JSON, skip */ }
    }
  }

  return fullText;
}

// ── Main handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const phone = body.phone || body.from || body.sender || "";
    const messageText = body.message || body.text || body.body || "";
    const senderName = body.sender_name || body.name || "";

    if (!phone) {
      return new Response(JSON.stringify({ error: "phone is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messageText || messageText.trim().length < 1) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneDigits = phone.replace(/\D/g, "");
    const phoneSuffix = normalizePhoneForMatch(phone);
    console.log(`[dra-lia-wa] Received: phone=${phoneDigits} msg="${messageText.slice(0, 80)}"`);

    // 1. Find or create lead in lia_attendances
    let leadId: string | null = null;
    let leadEmail: string | null = null;
    let leadNome: string | null = null;

    if (phoneSuffix.length >= 8) {
      const { data: leads } = await supabase
        .from("lia_attendances")
        .select("id, email, nome, total_messages, total_sessions")
        .ilike("telefone_normalized", `%${phoneSuffix}`)
        .limit(1);

      if (leads && leads.length > 0) {
        leadId = leads[0].id;
        leadEmail = leads[0].email;
        leadNome = leads[0].nome;
        console.log(`[dra-lia-wa] Matched lead: ${leadNome} (${leadId})`);
      }
    }

    // If no lead found, create a basic one
    if (!leadId) {
      const placeholderEmail = `wa_${phoneDigits}@whatsapp.lead`;
      const nome = senderName || `WhatsApp ${phoneDigits.slice(-4)}`;
      const { data: newLead, error: createErr } = await supabase
        .from("lia_attendances")
        .insert({
          nome,
          email: placeholderEmail,
          telefone_raw: phone,
          telefone_normalized: phoneSuffix,
          source: "whatsapp_lia",
          lead_status: "novo",
        })
        .select("id, email, nome")
        .single();

      if (createErr) {
        console.error("[dra-lia-wa] Error creating lead:", createErr);
      } else if (newLead) {
        leadId = newLead.id;
        leadEmail = newLead.email;
        leadNome = newLead.nome;
        console.log(`[dra-lia-wa] Created new lead: ${leadNome} (${leadId})`);
      }
    }

    // 2. Build conversation history from agent_interactions
    const history: Array<{ role: string; content: string }> = [];
    if (leadId) {
      const { data: interactions } = await supabase
        .from("agent_interactions")
        .select("user_message, agent_response")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (interactions && interactions.length > 0) {
        // Reverse to chronological order
        for (const int of interactions.reverse()) {
          history.push({ role: "user", content: int.user_message });
          if (int.agent_response) {
            history.push({ role: "assistant", content: int.agent_response });
          }
        }
      }
    }

    // 3. Call dra-lia internally (SSE stream)
    const sessionId = `wa_${phoneDigits}_${Date.now()}`;
    let liaResponse = "";

    try {
      const liaUrl = `${SUPABASE_URL}/functions/v1/dra-lia?action=chat`;
      const liaRes = await fetch(liaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          message: messageText,
          history,
          lang: "pt-BR",
          session_id: sessionId,
          topic_context: null,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!liaRes.ok) {
        const errText = await liaRes.text();
        console.error(`[dra-lia-wa] dra-lia returned ${liaRes.status}: ${errText.slice(0, 200)}`);
        
        if (liaRes.status === 429) {
          liaResponse = "Estou com muitas conversas no momento! 😊 Pode me enviar sua pergunta novamente em alguns instantes? Obrigada pela paciência!";
        } else {
          liaResponse = "Desculpe, tive um problema técnico agora. Pode repetir sua pergunta? Se preferir, fale com nosso time: wa.me/5516993831794";
        }
      } else {
        liaResponse = await consumeSSEStream(liaRes);
      }
    } catch (err) {
      console.error("[dra-lia-wa] Fetch to dra-lia failed:", err);
      liaResponse = "Desculpe, tive um problema técnico agora. Pode repetir sua pergunta? Se preferir, fale com nosso time: wa.me/5516993831794";
    }

    if (!liaResponse) {
      liaResponse = "Desculpe, não consegui processar sua mensagem. Pode tentar novamente? 😊";
    }

    // 4. Format for WhatsApp
    let waMessage = stripMarkdownForWhatsApp(liaResponse);
    if (waMessage.length > MAX_WHATSAPP_LENGTH) {
      waMessage = waMessage.slice(0, MAX_WHATSAPP_LENGTH - 50) + "\n\n... (mensagem completa disponível em nosso site)";
    }

    // 5. Find team_member with waleads_api_key to send reply
    let replySent = false;
    let teamMemberId: string | null = null;

    // Try to find the lead's owner first
    if (leadId) {
      const { data: att } = await supabase
        .from("lia_attendances")
        .select("proprietario_lead_crm")
        .eq("id", leadId)
        .single();

      if (att?.proprietario_lead_crm) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("id, waleads_api_key")
          .ilike("nome_completo", `%${att.proprietario_lead_crm.split(" ")[0]}%`)
          .eq("ativo", true)
          .not("waleads_api_key", "is", null)
          .limit(1)
          .single();

        if (tm?.waleads_api_key) {
          teamMemberId = tm.id;
          try {
            const cleanPhone = phoneDigits.replace(/^\+/, "");
            const waRes = await fetch(`${WALEADS_BASE_URL}/public/message/text?key=${tm.waleads_api_key}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone: cleanPhone, message: waMessage }),
            });
            const waBody = await waRes.text();
            console.log(`[dra-lia-wa] WaLeads reply status=${waRes.status} body=${waBody.slice(0, 200)}`);
            replySent = waRes.ok;
          } catch (e) {
            console.error("[dra-lia-wa] WaLeads send error:", e);
          }
        }
      }
    }

    // Fallback: use any active team member with waleads_api_key
    if (!replySent) {
      const { data: fallbackTm } = await supabase
        .from("team_members")
        .select("id, waleads_api_key")
        .eq("ativo", true)
        .not("waleads_api_key", "is", null)
        .limit(1)
        .single();

      if (fallbackTm?.waleads_api_key) {
        teamMemberId = fallbackTm.id;
        try {
          const cleanPhone = phoneDigits.replace(/^\+/, "");
          const waRes = await fetch(`${WALEADS_BASE_URL}/public/message/text?key=${fallbackTm.waleads_api_key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: cleanPhone, message: waMessage }),
          });
          const waBody = await waRes.text();
          console.log(`[dra-lia-wa] WaLeads fallback reply status=${waRes.status} body=${waBody.slice(0, 200)}`);
          replySent = waRes.ok;
        } catch (e) {
          console.error("[dra-lia-wa] WaLeads fallback send error:", e);
        }
      } else {
        console.warn("[dra-lia-wa] No team member with waleads_api_key found — reply NOT sent");
      }
    }

    // 6. Log in whatsapp_inbox (inbound + outbound)
    await supabase.from("whatsapp_inbox").insert([
      {
        phone: phoneDigits,
        phone_normalized: phoneSuffix,
        message_text: messageText,
        direction: "inbound",
        lead_id: leadId,
        matched_by: leadId ? `ilike_%${phoneSuffix}` : "created_new",
        intent_detected: "lia_autonomous",
        confidence_score: 100,
        raw_payload: body,
        processed_at: new Date().toISOString(),
      },
      {
        phone: phoneDigits,
        phone_normalized: phoneSuffix,
        message_text: waMessage,
        direction: "outbound",
        lead_id: leadId,
        matched_by: "lia_reply",
        intent_detected: "lia_autonomous",
        confidence_score: 100,
        seller_notified: replySent,
        processed_at: new Date().toISOString(),
      },
    ]);

    const result = {
      success: true,
      lead_id: leadId,
      reply_sent: replySent,
      reply_length: waMessage.length,
      team_member_id: teamMemberId,
    };

    console.log("[dra-lia-wa] Result:", JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[dra-lia-wa] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
