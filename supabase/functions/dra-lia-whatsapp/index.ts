import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WALEADS_BASE_URL = "https://waleads.roote.com.br";
const MAX_WHATSAPP_LENGTH = 4000;
const DEDUP_WINDOW_MS = 5000;

// ── Phone normalization ───
function normalizePhoneForMatch(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-9) : digits;
}

// ── Strip markdown for WhatsApp plain text ───
function stripMarkdownForWhatsApp(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")
    .replace(/\*\*([^*]+)\*\*/g, "*$1*")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^---+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Extract fields from flexible payload shapes ───
function extractFields(body: Record<string, unknown>): { phone: string; messageText: string; senderName: string } {
  const nested = (body.data || body.contact || {}) as Record<string, unknown>;

  const phone = String(
    body.phone || body.from || body.sender || body.contact_phone ||
    body.chatId || body.chat || nested.phone || nested.chatId || ""
  );

  const messageText = String(
    body.message || body.text || body.body || body.lastMessage ||
    body.content || nested.message || nested.text || nested.lastMessage || ""
  );

  const senderName = String(
    body.sender_name || body.name || body.contact_name ||
    body.pushName || nested.name || nested.pushName || ""
  );

  return { phone, messageText, senderName };
}

// ── Check if message should be ignored (anti-loop) ───
function shouldIgnore(body: Record<string, unknown>): string | null {
  if (body.fromMe === true || body.isFromMe === true || (body as any).key?.fromMe === true) {
    return "fromMe";
  }
  if (body.isGroup === true || body.isGroupMsg === true) {
    return "isGroup";
  }
  return null;
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

    const url = new URL(req.url);
    const isDebug = url.searchParams.get("debug") === "true";

    // Log everything we can for debug
    const contentType = req.headers.get("content-type") || "";
    console.log("[dra-lia-wa] Content-Type:", contentType);
    console.log("[dra-lia-wa] URL search params:", url.searchParams.toString());

    // Parse body flexibly: JSON, form-data, or empty
    let body: Record<string, unknown> = {};
    const rawText = await req.text();
    console.log("[dra-lia-wa] Raw body length:", rawText.length, "preview:", rawText.slice(0, 1500));

    if (rawText.length > 0) {
      try {
        body = JSON.parse(rawText);
      } catch {
        // Try URL-encoded form data
        try {
          const params = new URLSearchParams(rawText);
          for (const [key, value] of params.entries()) {
            body[key] = value;
          }
        } catch {
          console.warn("[dra-lia-wa] Could not parse body as JSON or form-data");
        }
      }
    }

    // Merge query params into body (ChatCenter may send data via URL)
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== "debug") {
        body[key] = value;
      }
    }

    console.log("[dra-lia-wa] Parsed body keys:", Object.keys(body).join(", "));
    console.log("[dra-lia-wa] Parsed body:", JSON.stringify(body).slice(0, 1500));

    // ── Debug mode: log everything and return 200 ───
    if (isDebug) {
      console.log("[dra-lia-wa] DEBUG MODE — full payload logged, no processing");
      return new Response(JSON.stringify({
        debug: true,
        received_keys: Object.keys(body),
        received_body: body,
        timestamp: new Date().toISOString(),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Anti-loop: ignore own messages and groups ───
    const ignoreReason = shouldIgnore(body);
    if (ignoreReason) {
      console.log(`[dra-lia-wa] Ignored: ${ignoreReason}`);
      return new Response(JSON.stringify({ ignored: true, reason: ignoreReason }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Extract fields with flexible mapping ───
    const { phone, messageText, senderName } = extractFields(body);

    // Warn about unresolved template variables but continue processing
    if (messageText.includes("{{") || phone.includes("{{") || senderName.includes("{{")) {
      console.warn("[dra-lia-wa] WARNING: Possible unresolved template variables detected — continuing anyway", {
        phone, message: messageText.slice(0, 100), senderName,
      });
    }

    if (!phone || phone === "undefined" || phone === "null") {
      return new Response(JSON.stringify({ error: "phone is required", received_keys: Object.keys(body) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messageText || messageText.trim().length < 1 || messageText === "undefined") {
      return new Response(JSON.stringify({ error: "message is required", received_keys: Object.keys(body) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneDigits = phone.replace(/\D/g, "");
    const phoneSuffix = normalizePhoneForMatch(phone);
    console.log(`[dra-lia-wa] Received: phone=${phoneDigits} msg="${messageText.slice(0, 80)}"`);

    // ── Deduplication: check recent outbound for same phone ───
    const { data: recentOutbound } = await supabase
      .from("whatsapp_inbox")
      .select("id, created_at")
      .eq("phone_normalized", phoneSuffix)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1);

    if (recentOutbound && recentOutbound.length > 0) {
      const lastOutAt = new Date(recentOutbound[0].created_at).getTime();
      if (Date.now() - lastOutAt < DEDUP_WINDOW_MS) {
        console.log(`[dra-lia-wa] Dedup: last outbound ${Date.now() - lastOutAt}ms ago — skipping`);
        return new Response(JSON.stringify({ ignored: true, reason: "dedup_window" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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

    if (!leadId) {
      const placeholderEmail = `wa_${phoneDigits}_${Date.now()}@whatsapp.lead`;
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
              body: JSON.stringify({ chat: cleanPhone, message: waMessage, isGroup: false }),
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
            body: JSON.stringify({ chat: cleanPhone, message: waMessage, isGroup: false }),
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
