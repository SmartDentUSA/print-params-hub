import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mergeTagsCrm } from "../_shared/sellflux-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Intent Classification (Rule-based v1) ───

interface IntentResult {
  intent: string;
  confidence: number;
}

const INTENT_RULES: Array<{ intent: string; patterns: RegExp[]; confidence: number }> = [
  {
    intent: "interesse_imediato",
    patterns: [
      /\b(quero|queremos|fechamos?|fechar|parcela|parcelamento|proposta|quando entrega|comprar|adquirir|envie proposta|vamos fechar|pode mandar)\b/i,
    ],
    confidence: 90,
  },
  {
    intent: "interesse_futuro",
    patterns: [
      /\b(planejando|semestre|ano que vem|futuro|mais pra frente|depois|pensar|avaliar|avaliando|estudando)\b/i,
    ],
    confidence: 75,
  },
  {
    intent: "pedido_info",
    patterns: [
      /\b(catalogo|catálogo|preco|preço|tabela|como funciona|diferenca|diferença|especifica|ficha tecnica|quanto custa|valores|modelos disponíveis)\b/i,
    ],
    confidence: 80,
  },
  {
    intent: "objecao",
    patterns: [
      /\b(caro|muito caro|vou pensar|falar com (meu |o )?socio|sócio|orçamento apertado|não é o momento|momento difícil)\b/i,
    ],
    confidence: 70,
  },
  {
    intent: "sem_interesse",
    patterns: [
      /\b(nao tenho interesse|não tenho interesse|pare|parar|remover|remova|não quero|nao quero|cancelar|sair da lista|descadastrar)\b/i,
    ],
    confidence: 95,
  },
  {
    intent: "suporte",
    patterns: [
      /\b(problema|defeito|troca|garantia|assistencia|assistência|suporte|quebrou|não funciona|nao funciona|com defeito)\b/i,
    ],
    confidence: 85,
  },
];

function classifyMessage(text: string): IntentResult {
  if (!text || text.trim().length < 2) return { intent: "indefinido", confidence: 10 };
  
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text) || pattern.test(normalized)) {
        return { intent: rule.intent, confidence: rule.confidence };
      }
    }
  }
  
  return { intent: "indefinido", confidence: 20 };
}

// ─── Phone normalization for matching ───

function normalizePhoneForMatch(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-9) : digits;
}

// ─── Main handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SELLFLUX_WEBHOOK_CAMPANHAS = Deno.env.get("SELLFLUX_WEBHOOK_CAMPANHAS");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const phone = body.phone || body.from || body.sender || "";
    const messageText = body.message || body.text || body.body || "";
    const mediaUrl = body.media_url || body.mediaUrl || null;
    const mediaType = body.media_type || body.mediaType || null;

    if (!phone) {
      return new Response(JSON.stringify({ error: "phone is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[wa-inbox] Received: phone=${phone} msg="${(messageText || "").slice(0, 80)}"`);

    // 1. Normalize phone
    const phoneSuffix = normalizePhoneForMatch(phone);
    const phoneDigits = phone.replace(/\D/g, "");

    // 2. Match lead via telefone_normalized (ILIKE last 9 digits)
    let leadId: string | null = null;
    let leadData: Record<string, unknown> | null = null;
    let matchedBy: string | null = null;

    if (phoneSuffix.length >= 8) {
      const { data: leads } = await supabase
        .from("lia_attendances")
        .select("id, nome, email, especialidade, proprietario_lead_crm, ultima_etapa_comercial, lead_stage_detected, urgency_level, recommended_approach, tags_crm, lead_status, telefone_normalized, total_messages")
        .ilike("telefone_normalized", `%${phoneSuffix}`)
        .limit(1);

      if (leads && leads.length > 0) {
        leadData = leads[0] as Record<string, unknown>;
        leadId = leads[0].id;
        matchedBy = `ilike_%${phoneSuffix}`;
        console.log(`[wa-inbox] Matched lead: ${leads[0].nome} (${leadId})`);
      }
    }

    // 3. Classify intent
    const { intent, confidence } = classifyMessage(messageText);
    console.log(`[wa-inbox] Intent: ${intent} (${confidence}%)`);

    // 4. Insert into whatsapp_inbox
    const { data: inboxRow, error: insertErr } = await supabase
      .from("whatsapp_inbox")
      .insert({
        phone: phoneDigits,
        phone_normalized: phoneSuffix,
        message_text: messageText || null,
        media_url: mediaUrl,
        media_type: mediaType,
        direction: "inbound",
        lead_id: leadId,
        matched_by: matchedBy,
        intent_detected: intent,
        confidence_score: confidence,
        raw_payload: body,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[wa-inbox] Insert error:", insertErr);
    }

    // 5. Post-processing based on intent
    let sellerNotified = false;

    if (leadId && leadData) {
      // Hot Lead Alert: notify seller for immediate/future interest
      if ((intent === "interesse_imediato" || intent === "interesse_futuro") && SELLFLUX_WEBHOOK_CAMPANHAS) {
        const ownerName = (leadData.proprietario_lead_crm as string) || "Sem owner";
        
        // Find team member to notify
        const { data: members } = await supabase
          .from("team_members")
          .select("id, nome_completo, waleads_api_key, whatsapp_number")
          .ilike("nome_completo", `%${ownerName.split(" ")[0]}%`)
          .limit(1);

        if (members && members.length > 0 && members[0].whatsapp_number) {
          const member = members[0];
          const alertMsg = [
            "🚨 OPORTUNIDADE QUENTE",
            `Lead: ${leadData.nome || "?"} (${leadData.especialidade || "?"})`,
            `Owner: ${ownerName}`,
            `Resposta: "${(messageText || "").slice(0, 200)}"`,
            `Etapa CRM: ${leadData.ultima_etapa_comercial || "?"}`,
            `Cognitivo: ${leadData.lead_stage_detected || "?"} | Urgência: ${leadData.urgency_level || "?"}`,
            `Ação: ${leadData.recommended_approach || "Contato imediato"}`,
          ].join("\n");

          // Send via internal send-waleads function
          try {
            await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-send-waleads`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({
                team_member_id: member.id,
                phone: member.whatsapp_number,
                tipo: "text",
                message: alertMsg,
                lead_id: leadId,
              }),
            });
            sellerNotified = true;
            console.log(`[wa-inbox] Seller notified: ${member.nome_completo}`);
          } catch (e) {
            console.warn("[wa-inbox] Seller notification error:", e);
          }
        }
      }

      // sem_interesse: tag the lead
      if (intent === "sem_interesse") {
        const newTags = mergeTagsCrm(leadData.tags_crm as string[] | null, ["A_SEM_RESPOSTA"]);
        await supabase
          .from("lia_attendances")
          .update({ tags_crm: newTags, updated_at: new Date().toISOString() })
          .eq("id", leadId);
        console.log(`[wa-inbox] Tagged lead ${leadId} with A_SEM_RESPOSTA`);
      }

      // Fire cognitive analysis if 5+ total messages
      const totalMsgs = ((leadData.total_messages as number) || 0) + 1;
      if (totalMsgs >= 5 && leadData.email) {
        fetch(`${SUPABASE_URL}/functions/v1/cognitive-lead-analysis`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({ email: leadData.email }),
        }).catch(e => console.warn("[wa-inbox] Cognitive fire-and-forget error:", e));
      }
    }

    // Update seller_notified
    if (sellerNotified && inboxRow?.id) {
      await supabase
        .from("whatsapp_inbox")
        .update({ seller_notified: true })
        .eq("id", inboxRow.id);
    }

    const result = {
      success: true,
      inbox_id: inboxRow?.id || null,
      lead_matched: !!leadId,
      lead_id: leadId,
      intent_detected: intent,
      confidence_score: confidence,
      seller_notified: sellerNotified,
    };

    console.log("[wa-inbox] Result:", JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[wa-inbox] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
