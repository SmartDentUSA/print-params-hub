/**
 * LIA Escalation — intent detection, seller notification, and handoff engine.
 * Handles vendedor/cs_suporte/especialista routing and WaLeads notifications.
 * Extracted from dra-lia/index.ts for modularity and testability.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage } from "./log-ai-usage.ts";

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
  ],
  especialista: [
    /\b(frustra|irritad|decepcion|insatisfeit|raiva|absurdo|p[ée]ssim|horrível|hor[íi]vel|nunca mais)\b/i,
    /\b(j[áa] perguntei|j[áa] falei|n[ãa]o resolveu|n[ãa]o funciona|n[ãa]o ajudou|n[ãa]o entendeu)\b/i,
  ],
};

export function detectEscalationIntent(message: string, history: Array<{ role: string; content: string }>): EscalationType {
  const closingPattern = /^(obrigad[oa]s?|valeu|ok|beleza|entendi|perfeito|legal|blz|vlw|thanks?|thank you|gracias?|tudo bem|certo|massa|show|top|boa|bacana|ta bom|tá bom|combinado|pode ser|fechou|tranquilo)\b/i;
  if (closingPattern.test(message.trim())) return null;

  for (const [type, patterns] of Object.entries(ESCALATION_TRIGGERS)) {
    if (patterns.some(p => p.test(message))) return type as EscalationType;
  }

  const userMessages = history.filter(h => h.role === "user");
  const assistantMessages = history.filter(h => h.role === "assistant");
  if (userMessages.length >= 3) {
    const lastAssistants = assistantMessages.slice(-3);
    const fallbackCount = lastAssistants.filter(a => /não tenho essa informação|falar com especialista|falar com suporte|wa\.me/i.test(a.content)).length;
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
export async function notifySellerEscalation(
  supabase: SupabaseClient,
  leadEmail: string,
  leadName: string,
  escalationType: EscalationType,
  resumo: string,
  message: string,
  env: { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string }
): Promise<void> {
  if (!escalationType) return;
  try {
    const { data: attendance } = await supabase
      .from("lia_attendances")
      .select("proprietario_lead_crm, telefone_normalized, produto_interesse, temperatura_lead, score, id, piperun_id, piperun_link, especialidade, confidence_score_analysis, lead_stage_detected, urgency_level, interest_timeline, psychological_profile, primary_motivation, objection_risk, recommended_approach")
      .eq("email", leadEmail)
      .maybeSingle();
    if (!attendance) { console.warn(`[escalation] No attendance for ${leadEmail}`); return; }

    let teamMember: { id: string; nome_completo: string; whatsapp_number: string; waleads_api_key: string | null } | null = null;
    if (attendance.proprietario_lead_crm) {
      const { data: tm } = await supabase.from("team_members").select("id, nome_completo, whatsapp_number, waleads_api_key").eq("piperun_owner_id", attendance.proprietario_lead_crm).eq("ativo", true).maybeSingle();
      teamMember = tm;
    }
    if (!teamMember) {
      const { data: tm } = await supabase.from("team_members").select("id, nome_completo, whatsapp_number, waleads_api_key").eq("ativo", true).eq("role", "vendedor").limit(1).maybeSingle();
      teamMember = tm;
    }
    if (!teamMember) { console.warn(`[escalation] No team member found`); return; }

    const typeLabels: Record<string, string> = { vendedor: "🟢 OPORTUNIDADE COMERCIAL", cs_suporte: "🟡 SUPORTE TÉCNICO", especialista: "🔴 ESCALONAMENTO URGENTE" };
    const urgencyEmoji: Record<string, string> = { alta: "🔴", media: "🟡", baixa: "🟢" };
    let cognitiveBlock = "";
    if (attendance.confidence_score_analysis) {
      cognitiveBlock = `\n📊 Análise Cognitiva - Confiança: ${attendance.confidence_score_analysis}%\nEstágio: ${attendance.lead_stage_detected || "N/I"}\nUrgência: ${urgencyEmoji[attendance.urgency_level as string] || "⚪"} ${attendance.urgency_level || "N/I"}\nTimeline: ${attendance.interest_timeline || "N/I"}\nPerfil: ${attendance.psychological_profile || "N/I"}\nMotivação: ${attendance.primary_motivation || "N/I"}\nRisco objeção: ${attendance.objection_risk || "N/I"}\nAbordagem: ${attendance.recommended_approach || "N/I"}`;
    }

    const notificationMsg = `${typeLabels[escalationType] || "📋 ESCALONAMENTO"}\n\n👤 Lead: ${leadName}\n📧 Email: ${leadEmail}\n${attendance.telefone_normalized ? `📱 Tel: ${attendance.telefone_normalized}` : ""}\n${attendance.especialidade ? `🦷 Especialidade: ${attendance.especialidade}` : ""}\n${attendance.produto_interesse ? `🎯 Interesse: ${attendance.produto_interesse}` : ""}\n${attendance.piperun_id ? `🎯 ID_PipeRun: ${attendance.piperun_id}` : ""}\n${attendance.piperun_link ? `🔗 PipeRun: ${attendance.piperun_link}` : ""}\n\n💬 Última msg: "${message.slice(0, 200)}"\n${resumo ? `📝 Resumo LIA: ${resumo.slice(0, 200)}` : ""}\n\n⚡ Ação recomendada: ${escalationType === "vendedor" ? "Contactar lead para negociação" : escalationType === "cs_suporte" ? "Agendar suporte técnico" : "Intervenção imediata - lead frustrado"}\n${cognitiveBlock}`.replace(/\n{3,}/g, "\n\n");

    await supabase.from("message_logs").insert({ lead_id: attendance.id, team_member_id: teamMember.id, tipo: `escalation_${escalationType}`, mensagem_preview: notificationMsg.slice(0, 500), whatsapp_number: teamMember.whatsapp_number, status: "pendente" });
    await supabase.from("lia_attendances").update({ ultima_etapa_comercial: `escalado_lia_${escalationType}`, updated_at: new Date().toISOString() }).eq("email", leadEmail);

    console.log(`[escalation] ${escalationType} escalation logged for ${leadEmail} → ${teamMember.nome_completo}`);

    if (teamMember.waleads_api_key && teamMember.whatsapp_number) {
      try {
        const sendResp = await fetch(`${env.SUPABASE_URL}/functions/v1/smart-ops-send-waleads`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ team_member_id: teamMember.id, phone: teamMember.whatsapp_number, tipo: "text", message: notificationMsg, lead_id: attendance.id }),
          signal: AbortSignal.timeout(5000),
        });
        let sendResult: { success?: boolean } = {};
        try { sendResult = await sendResp.json(); } catch { /* ignore */ }
        const ok = sendResp.ok && sendResult.success !== false;
        await supabase.from("message_logs").update({ status: ok ? "enviado" : "erro" }).eq("lead_id", attendance.id).eq("tipo", `escalation_${escalationType}`).order("created_at", { ascending: false }).limit(1);
        console.log(`[escalation] ${ok ? "✓" : "✗"} Notification sent to ${teamMember.nome_completo}`);
      } catch (e) { console.warn(`[escalation] WaLeads send error:`, e); }
    }
  } catch (e) { console.error(`[escalation] Error:`, e); }
}
