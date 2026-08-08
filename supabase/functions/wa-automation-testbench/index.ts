// wa-automation-testbench — dispara uma mensagem de teste IDENTIFICADA por cada
// automação de WhatsApp existente no sistema, usando a instância real de cada uma.
// Uso: POST { phone?: "5519992612348", only?: ["nps"], dry_run?: false }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Case = {
  id: string;
  label: string;
  fn: string;
  instance: string;
  body: string;
};

const CASES: Case[] = [
  {
    id: "briefing_vendedor",
    label: "Briefing de novos leads ao vendedor",
    fn: "smart-ops-lia-notify-seller",
    instance: "smartdent_marketing",
    body:
      "🧾 *Resumo do Lead — Smart Dent*\n\n👤 Lead Teste Automação\n📱 https://wa.me/5519992612348?text=Ol%C3%A1%20Lead%20Teste%2C%20aqui%20%C3%A9%20da%20Smart%20Dent\n📍 Etapa CRM: Novo lead\n\n(mensagem de teste do briefing automático)",
  },
  {
    id: "boas_vindas_lead",
    label: "Boas-vindas ao Lead (Automações LIA)",
    fn: "smart-ops-lead-welcome",
    instance: "Dra. Lia",
    body: "Olá! Aqui é a Smart Dent 👋 Recebemos seu contato e já encaminhamos para um especialista.\n\n(teste — Boas-vindas ao Lead)",
  },
  {
    id: "nps_pos_treinamento",
    label: "NPS pós-treinamento",
    fn: "cs-enviar-nps",
    instance: "cs_principal",
    body: "Oie! Espero que esteja bem! Sua opinião é muito importante pra gente: avalie seu treinamento em 1 minuto 👉 https://admin.smartdent.com.br/nps/teste\n\n(teste — NPS pós-treinamento)",
  },
  {
    id: "lembrete_treinamento",
    label: "Lembrete de treinamento (CS)",
    fn: "smartops-send-course-reminder",
    instance: "cs_principal",
    body: "Lembrete: seu treinamento Smart Dent começa amanhã às 09h. Qualquer dúvida, é só responder aqui!\n\n(teste — Lembrete de treinamento)",
  },
  {
    id: "transbordo_suporte",
    label: "Automações por Gatilho — Transbordo WhatsApp Suporte",
    fn: "smart-ops-trigger-automations",
    instance: "Suporte_tecnico",
    body:
      "🛠️ *Novo contato para o Suporte*\n\nCliente: Lead Teste Automação\nFale agora: https://wa.me/5519992612348?text=Ol%C3%A1%2C%20aqui%20%C3%A9%20do%20suporte%20t%C3%A9cnico%20da%20Smart%20Dent\n\n(teste — automação por gatilho / destinatário interno)",
  },
  {
    id: "cs_automation_rules",
    label: "Réguas de CS (cs_automation_rules)",
    fn: "smart-ops-cs-processor",
    instance: "cs_principal",
    body: "Oi! Passando para saber como está o uso do seu equipamento Smart Dent. Precisa de algum ajuste?\n\n(teste — régua de CS)",
  },
  {
    id: "dra_lia_reply",
    label: "Dra. LIA — resposta automática no WhatsApp",
    fn: "dra-lia-whatsapp",
    instance: "Dra. Lia",
    body: "Sou a Dra. LIA, consultora digital da Smart Dent. Posso te ajudar com parâmetros de impressão 3D e fluxo digital.\n\n(teste — resposta automática Dra. LIA)",
  },
  {
    id: "broadcast_marketing",
    label: "Broadcast de marketing (social_broadcasts)",
    fn: "wa-broadcast-dispatch",
    instance: "smartdent_marketing",
    body: "Novidade Smart Dent: conteúdo novo no Fluxo Digital 🚀\n\n(teste — broadcast de marketing)",
  },
  {
    id: "sequence_runner",
    label: "Sequências / cadências (sequence-runner)",
    fn: "sequence-runner",
    instance: "smartdent_marketing",
    body: "Passo 1 da sua sequência Smart Dent: veja como reduzir tempo de acabamento em resina.\n\n(teste — sequence-runner)",
  },
  {
    id: "proactive_outreach",
    label: "Reativação proativa (smart-ops-proactive-outreach)",
    fn: "smart-ops-proactive-outreach",
    instance: "smartdent_marketing",
    body: "Oi! Vi que faz um tempo desde seu último pedido — tenho uma condição de reposição de resina pra você.\n\n(teste — reativação proativa)",
  },
  {
    id: "stripe_notify",
    label: "Aviso de pagamento Stripe (_shared/stripe-notify)",
    fn: "stripe-webhook",
    instance: "smartdent_marketing",
    body: "💰 Pagamento confirmado — Lead Teste Automação — R$ 1,00 (Stripe)\n\n(teste — notificação de pagamento)",
  },
  {
    id: "technical_ticket",
    label: "Abertura de ticket técnico (create-technical-ticket)",
    fn: "create-technical-ticket",
    instance: "Suporte_tecnico",
    body: "🎫 Novo ticket técnico #TESTE — Lead Teste Automação — Impressora não calibra.\n\n(teste — ticket técnico)",
  },
  {
    id: "lia_escalation",
    label: "Escalação da LIA para humano (_shared/lia-escalation)",
    fn: "dra-lia",
    instance: "Suporte_tecnico",
    body: "⚠️ A Dra. LIA escalou um atendimento para humano — Lead Teste Automação.\n\n(teste — escalação LIA)",
  },
  {
    id: "sentinela_report",
    label: "Relatório diário Sentinela",
    fn: "sentinela-daily-report",
    instance: "smartdent_marketing",
    body: "📊 Sentinela — resumo diário: 0 alertas críticos, 0 grupos bloqueados.\n\n(teste — relatório Sentinela)",
  },
  {
    id: "training_publish",
    label: "Publicação de treinamento (training-factory-publish)",
    fn: "training-factory-publish",
    instance: "smartdent_marketing",
    body: "🎬 Depoimento do treinamento publicado e disponível na base de conhecimento.\n\n(teste — publicação de treinamento)",
  },
  {
    id: "copilot",
    label: "Copilot — envio manual de WhatsApp por ação",
    fn: "smart-ops-copilot",
    instance: "smartdent_marketing",
    body: "Mensagem enviada pelo Copilot a pedido do gestor comercial.\n\n(teste — Copilot)",
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const phone = String(body.phone ?? "5519992612348").replace(/\D/g, "");
  const only: string[] = Array.isArray(body.only) ? body.only : [];
  const dryRun = body.dry_run === true;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: members } = await supabase
    .from("team_members")
    .select("id, nome_completo, evolution_instance_name, evolution_enabled, evolution_status");
  const byInstance = new Map<string, any>();
  for (const m of members ?? []) if (m.evolution_instance_name) byInstance.set(m.evolution_instance_name, m);

  const selected = only.length ? CASES.filter((c) => only.includes(c.id)) : CASES;
  const results: any[] = [];
  let idx = 0;

  for (const c of selected) {
    idx++;
    const tm = byInstance.get(c.instance);
    const usable = !!tm && tm.evolution_enabled !== false && tm.evolution_status === "connected";
    const header = `🧪 *TESTE ${idx}/${selected.length} — ${c.label}*\nFunção: ${c.fn}\nInstância: ${c.instance}\n──────────\n`;
    const text = header + c.body;

    if (!tm) {
      results.push({ ...caseInfo(c), status: "skipped", reason: "instance_not_found_in_team_members" });
      continue;
    }
    if (!usable) {
      results.push({
        ...caseInfo(c),
        status: "skipped",
        reason: `instance_offline (enabled=${tm.evolution_enabled}, status=${tm.evolution_status})`,
      });
      continue;
    }
    if (dryRun) {
      results.push({ ...caseInfo(c), status: "dry_run", preview: text });
      continue;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-wa-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          team_member_id: tm.id,
          phone,
          message: text,
          source: `testbench:${c.id}`,
          metadata: { testbench: true, automation: c.id, fn: c.fn },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      results.push({
        ...caseInfo(c),
        status: res.ok && payload?.success !== false ? "sent" : "failed",
        http: res.status,
        detail: payload?.error ?? payload?.detail ?? payload?.delivery_status ?? null,
      });
    } catch (e) {
      results.push({ ...caseInfo(c), status: "failed", detail: String((e as Error)?.message ?? e) });
    }
    await new Promise((r) => setTimeout(r, 2500));
  }

  const summary = results.reduce((acc: Record<string, number>, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log("[wa-automation-testbench]", JSON.stringify({ phone, summary }));
  return Response.json({ ok: true, phone, total: selected.length, summary, results }, { headers: corsHeaders });
});

function caseInfo(c: Case) {
  return { id: c.id, label: c.label, fn: c.fn, instance: c.instance };
}
