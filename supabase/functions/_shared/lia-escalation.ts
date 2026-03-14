/**
 * LIA Escalation — intent detection, seller notification, and handoff engine.
 * Handles vendedor/cs_suporte/especialista routing and WaLeads notifications.
 * Extracted from dra-lia/index.ts for modularity and testability.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

// ── Escalation Types ──
export type EscalationType = "vendedor" | "cs_suporte" | "especialista" | null;

// ── Trigger Patterns ──
const ESCALATION_TRIGGERS = {
  vendedor: [
    /\b(desconto|negocia[çc]|condi[çc][ãa]o especial|pre[çc]o menor|melhor pre[çc]o|quanto fica|parcel[ao]|pagamento)\b/i,
    /\b(or[çc]amento|proposta|cotação|cota[çc]ao)\b/i,
    /\b(quero comprar|vou comprar|vou fechar|fecha[r]? neg[óo]cio|agendar reuni[ãa]o|visita|demo(nstra[çc][ãa]o)?)\b/i,
    /\b(concorr[êe]ncia|concorrente|formlabs|dentsply|keystone|stratasys|bego)\b.{0,30}\b(melhor|mais barato|prefer[oe]|considerar|comparar)\b/i,
  ],
  cs_suporte: [
    /\b(defeito|garantia|assist[êe]ncia|reclama[çc]|insatisf|problema com.{0,20}(produto|equipamento|impressora|scanner))\b/i,
    /\b(troca[r]?|devolu[çc]|reembolso|pe[çc]a.{0,15}reposi[çc])\b/i,
    // REMOVED: "treinamento" — users asking ABOUT training are not support cases
  ],
  especialista: [
    /\b(frustra|irritad|decepcion|insatisfeit|raiva|absurdo|p[ée]ssim|horrível|hor[íi]vel|nunca mais)\b/i,
    /\b(j[áa] perguntei|j[áa] falei|n[ãa]o resolveu|n[ãa]o funciona|n[ãa]o ajudou|n[ãa]o entendeu)\b/i,
  ],
};

export function detectEscalationIntent(message: string, history: Array<{ role: string; content: string }>): EscalationType {
  // Guard: polite closing/thank-you messages should never trigger escalation
  const closingPattern = /^(obrigad[oa]s?|valeu|ok|beleza|entendi|perfeito|legal|blz|vlw|thanks?|thank you|gracias?|tudo bem|certo|massa|show|top|boa|bacana|ta bom|tá bom|combinado|pode ser|fechou|tranquilo)\b/i;
  if (closingPattern.test(message.trim())) return null;

  // Check current message first
  for (const [type, patterns] of Object.entries(ESCALATION_TRIGGERS)) {
    if (patterns.some(p => p.test(message))) return type as EscalationType;
  }

  // Check for specialist escalation: 3+ unanswered questions in session
  const userMessages = history.filter(h => h.role === "user");
  const assistantMessages = history.filter(h => h.role === "assistant");
  if (userMessages.length >= 3) {
    const lastAssistants = assistantMessages.slice(-3);
    const fallbackCount = lastAssistants.filter(a =>
      /não tenho essa informação|falar com especialista|falar com suporte|wa\.me/i.test(a.content)
    ).length;
    if (fallbackCount >= 2) return "especialista";
  }
  return null;
}

// ── Escalation CTA messages ──
export const ESCALATION_RESPONSES: Record<string, Record<string, string>> = {
  vendedor: {
    "pt-BR": `\n\n---\n💼 Vou conectar você com um de nossos especialistas comerciais para discutir as melhores condições. Eles poderão preparar uma proposta personalizada para sua realidade.\n\n👉 [Falar com especialista comercial](https://wa.me/5516993831794)`,
    "en-US": `\n\n---\n💼 I'll connect you with one of our commercial specialists to discuss the best conditions. They can prepare a customized proposal for you.\n\n👉 [Talk to commercial specialist](https://wa.me/5516993831794)`,
    "es-ES": `\n\n---\n💼 Voy a conectarte con uno de nuestros especialistas comerciales para discutir las mejores condiciones.\n\n👉 [Hablar con especialista comercial](https://wa.me/5516993831794)`,
  },
  cs_suporte: {
    "pt-BR": `\n\n---\n🛠️ Para essa questão, nosso time de suporte técnico é o mais indicado. Eles têm acesso direto ao sistema e podem resolver rapidamente.\n\n👉 [Falar com suporte técnico](https://wa.me/551634194735)`,
    "en-US": `\n\n---\n🛠️ For this issue, our technical support team is best suited. They have direct system access and can resolve it quickly.\n\n👉 [Contact technical support](https://wa.me/551634194735)`,
    "es-ES": `\n\n---\n🛠️ Para esta cuestión, nuestro equipo de soporte técnico es el más indicado.\n\n👉 [Contactar soporte técnico](https://wa.me/551634194735)`,
  },
  especialista: {
    "pt-BR": `\n\n---\n🎯 Percebi que sua dúvida precisa de um atendimento mais aprofundado. Vou acionar um especialista que pode te dar atenção dedicada.\n\n👉 [Falar com especialista](https://wa.me/5516993831794)`,
    "en-US": `\n\n---\n🎯 I noticed your question needs more in-depth attention. I'll connect you with a specialist who can give you dedicated support.\n\n👉 [Talk to specialist](https://wa.me/5516993831794)`,
    "es-ES": `\n\n---\n🎯 Noté que tu duda necesita una atención más profunda. Voy a conectarte con un especialista.\n\n👉 [Hablar con especialista](https://wa.me/5516993831794)`,
  },
};

// ── Fallback Messages ──
export const FALLBACK_MESSAGES: Record<string, string> = {
  "pt-BR": `Já entendi sua dúvida! 😊 Estou acionando um especialista do nosso time que vai te chamar no **WhatsApp** e explicar cada detalhe.\n\nPossui alguma outra dúvida que queria tirar?`,
  "en-US": `Got it! 😊 I'm reaching out to a specialist from our team who will contact you on **WhatsApp** to explain everything in detail.\n\nAny other questions I can help with?`,
  "es-ES": `¡Entendido! 😊 Estoy contactando a un especialista de nuestro equipo que te llamará por **WhatsApp** para explicarte cada detalle.\n\n¿Tienes alguna otra duda?`,
};

// ── Notify Seller (escalation) ──
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Deno.env
export async function notifySellerEscalation(
  supabase: SupabaseClient,
  leadEmail: string,
  leadName: string,
  escalationType: EscalationType,
  resumo: string,
  message: string,
): Promise<void> {
  if (!escalationType) return;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // 1. Find the responsible seller from lia_attendances → proprietario_lead_crm → team_members
    const { data: attendance } = await supabase
      .from("lia_attendances")
      .select("proprietario_lead_crm, telefone_normalized, produto_interesse, temperatura_lead, score, id, piperun_id, piperun_link, especialidade, confidence_score_analysis, lead_stage_detected, urgency_level, interest_timeline, psychological_profile, primary_motivation, objection_risk, recommended_approach")
      .eq("email", leadEmail)
      .maybeSingle();

    if (!attendance) { console.warn(`[escalation] No attendance found for ${leadEmail}`); return; }

    // 2. Find team member by proprietario_lead_crm
    let teamMember: { id: string; nome_completo: string; whatsapp_number: string; waleads_api_key: string | null } | null = null;
    if (attendance.proprietario_lead_crm) {
      const { data: tm } = await supabase.from("team_members").select("id, nome_completo, whatsapp_number, waleads_api_key").eq("piperun_owner_id", attendance.proprietario_lead_crm).eq("ativo", true).maybeSingle();
      teamMember = tm;
    }
    // Fallback: first active vendedor
    if (!teamMember) {
      const { data: tm } = await supabase.from("team_members").select("id, nome_completo, whatsapp_number, waleads_api_key").eq("ativo", true).eq("role", "vendedor").limit(1).maybeSingle();
      teamMember = tm;
    }
    if (!teamMember) { console.warn(`[escalation] No team member found for escalation`); return; }

    // 3. Build notification message
    const typeLabels: Record<string, string> = { vendedor: "🟢 OPORTUNIDADE COMERCIAL", cs_suporte: "🟡 SUPORTE TÉCNICO", especialista: "🔴 ESCALONAMENTO URGENTE" };
    const urgencyEmoji: Record<string, string> = { alta: "🔴", media: "🟡", baixa: "🟢" };

    let cognitiveBlock = "";
    if (attendance.confidence_score_analysis) {
      cognitiveBlock = `\n📊 Análise Cognitiva - Confiança: ${attendance.confidence_score_analysis}%\n\nEstágio: ${attendance.lead_stage_detected || "N/I"}\nUrgência: ${urgencyEmoji[attendance.urgency_level as string] || "⚪"} ${attendance.urgency_level || "N/I"}\nTimeline: ${attendance.interest_timeline || "N/I"}\nPerfil: ${attendance.psychological_profile || "N/I"}\nMotivação: ${attendance.primary_motivation || "N/I"}\nRisco objeção: ${attendance.objection_risk || "N/I"}\nAbordagem: ${attendance.recommended_approach || "N/I"}`;
    }

    const notificationMsg = `${typeLabels[escalationType] || "📋 ESCALONAMENTO"}

👤 Lead: ${leadName}
📧 Email: ${leadEmail}
${attendance.telefone_normalized ? `📱 Tel: ${attendance.telefone_normalized}` : ""}
${attendance.especialidade ? `🦷 Especialidade: ${attendance.especialidade}` : ""}
${attendance.produto_interesse ? `🎯 Interesse: ${attendance.produto_interesse}` : ""}
${attendance.piperun_id ? `🎯 ID_PipeRun: ${attendance.piperun_id}` : ""}
${attendance.piperun_link ? `🔗 PipeRun: ${attendance.piperun_link}` : ""}

💬 Última msg: "${message.slice(0, 200)}"
${resumo ? `📝 Resumo LIA: ${resumo.slice(0, 200)}` : ""}

⚡ Ação recomendada: ${escalationType === "vendedor" ? "Contactar lead para negociação" : escalationType === "cs_suporte" ? "Agendar suporte técnico" : "Intervenção imediata - lead frustrado"}
${cognitiveBlock}`.replace(/\n{3,}/g, "\n\n");

    // 4. Log in message_logs
    await supabase.from("message_logs").insert({
      lead_id: attendance.id,
      team_member_id: teamMember.id,
      tipo: `escalation_${escalationType}`,
      mensagem_preview: notificationMsg.slice(0, 500),
      whatsapp_number: teamMember.whatsapp_number,
      status: "pendente",
    });

    // 5. Update lia_attendances with escalation status
    await supabase.from("lia_attendances")
      .update({
        ultima_etapa_comercial: `escalado_lia_${escalationType}`,
        updated_at: new Date().toISOString(),
      })
      .eq("email", leadEmail);

    console.log(`[escalation] ${escalationType} escalation logged for ${leadEmail} → ${teamMember.nome_completo}`);

    // 6. Send via WaLeads if API key available
    if (teamMember.waleads_api_key) {
      try {
        const sellerPhone = teamMember.whatsapp_number;
        if (!sellerPhone) {
          console.warn(`[escalation] Seller ${teamMember.nome_completo} has no whatsapp_number — skipping WaLeads send`);
          return;
        }
        const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-send-waleads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            team_member_id: teamMember.id,
            phone: sellerPhone,
            tipo: "text",
            message: notificationMsg,
            lead_id: attendance.id,
          }),
          signal: AbortSignal.timeout(5000),
        });

        // Parse response body to check actual success
        let sendResult: { success?: boolean; response?: string; provider?: string } = {};
        try { sendResult = await sendResp.json(); } catch { /* ignore parse errors */ }

        const actuallySucceeded = sendResp.ok && sendResult.success !== false;

        if (actuallySucceeded) {
          await supabase.from("message_logs")
            .update({ status: "enviado", data_envio: new Date().toISOString() })
            .eq("lead_id", attendance.id)
            .eq("tipo", `escalation_${escalationType}`)
            .order("created_at", { ascending: false })
            .limit(1);
          console.log(`[escalation] WaLeads notification sent to ${teamMember.nome_completo} via ${sendResult.provider || "unknown"}`);
        } else {
          await supabase.from("message_logs")
            .update({ status: "erro", error_details: (sendResult.response || `HTTP ${sendResp.status}`).slice(0, 500) })
            .eq("lead_id", attendance.id)
            .eq("tipo", `escalation_${escalationType}`)
            .order("created_at", { ascending: false })
            .limit(1);
          console.warn(`[escalation] WaLeads send failed: HTTP ${sendResp.status} success=${sendResult.success} response=${sendResult.response?.slice(0, 200)}`);
        }
      } catch (e) {
        console.warn(`[escalation] WaLeads send error:`, e);
      }
    }
  } catch (e) {
    console.error(`[escalation] Error:`, e);
  }
}
