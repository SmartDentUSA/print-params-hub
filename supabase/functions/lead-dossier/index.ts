// Dossiê do lead no CRM (aba "Dossiê IA" do card do lead), gerado com Claude.
// Só administradores e vendedores ativos (fn_can_use_lead_dossier). Lê apenas o lead canônico
// e grava o resultado em lead_ai_dossiers (sem acesso direto pelo navegador).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateMessage, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.11";
import { logAIUsage } from "../_shared/log-ai-usage.ts";

const MODEL = "anthropic/claude-sonnet-5" as const;
const COOLDOWN_MS = 60_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = [
  "Você é analista comercial sênior da Smart Dent (odontologia digital: resinas 3D, scanners intraorais, impressoras 3D, CAD e soluções integradas).",
  "Escreva em português do Brasil um DOSSIÊ para o vendedor ler em 1 minuto antes de falar com o lead.",
  "Use SOMENTE os dados fornecidos em JSON. Se algo não constar, escreva 'sem registro'. Nunca invente pessoas, produtos, valores, datas ou conversas.",
  "Pessoa e empresa são entidades distintas: não atribua à pessoa compras de outra empresa sem evidência nos dados.",
  "Valores em reais só quando vierem dos negócios ou notas fiscais fornecidos; não sugira preços nem descontos.",
  "Formato em Markdown, com exatamente estas seções (títulos ###):",
  "### Quem é — 2 a 3 linhas (especialidade, cidade/UF, empresa, origem do primeiro contato).",
  "### Relação com a Smart Dent — compras ganhas (produtos e valores), notas fiscais, LTV, cursos.",
  "### Negócios em andamento — funil, etapa, vendedor e produto de cada negócio aberto; perdidos recentes com motivo.",
  "### Equipamentos e interesses — o que possui (marca/modelo, idade) e o que demonstrou interesse.",
  "### Sinais recentes — até 5 eventos mais relevantes da linha do tempo com data (dd/mm/aaaa).",
  "### Pontos de atenção — suporte em aberto, objeções, riscos; 'Nenhum' se não houver.",
  "### Próximos passos sugeridos — 3 ações objetivas e numeradas, coerentes com os dados.",
  "### Perguntas para a conversa — 3 perguntas curtas para qualificar ou avançar.",
  "Seja direto, use tópicos curtos e negrito só em nomes de produtos.",
].join("\n");

const NOISE = /snapshot|sync|backfill|merge|enrich|score|recalc|cognitive|audit/i;

function textOf(r: any): string {
  return (r?.content ?? [])
    .filter((c: any) => c?.type === "text")
    .map((c: any) => String(c.text ?? ""))
    .join("")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Faça login para ver o dossiê." }, 401);

    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: allowed } = await sb.rpc("fn_can_use_lead_dossier", { _user_id: u.user.id });
    if (!allowed) return json({ error: "O dossiê é exclusivo da equipe de vendas.", code: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const leadId = String(body?.lead_id ?? "");
    const action = body?.action === "generate" ? "generate" : "get";
    if (!/^[0-9a-f-]{36}$/i.test(leadId)) return json({ error: "lead_id inválido" }, 400);

    const { data: saved } = await sb.from("lead_ai_dossiers")
      .select("content, model, generated_at, sources").eq("lead_id", leadId).maybeSingle();
    if (action === "get") return json({ dossier: saved ?? null });
    if (saved && Date.now() - new Date(saved.generated_at).getTime() < COOLDOWN_MS) {
      return json({ dossier: saved, cooldown: true });
    }

    const { data: lead } = await sb.from("lia_attendances")
      .select("id, nome, email, telefone_normalized, cidade, uf, especialidade, area_atuacao, empresa_nome, produto_interesse, produto_interesse_auto, lead_status, real_status, status_atual_lead_crm, proprietario_lead_crm, ultima_etapa_comercial, origem_primeiro_contato, form_name, tags_crm, ltv_total, total_deals_all, intelligence_score_total, equip_scanner, equip_scanner_idade_meses, equip_scanner_bancada, equip_impressora, equip_impressora_idade_meses, equip_cad, equip_fresadora, equip_pos_impressao, equip_notebook, equip_upgrade_signal, equip_upgrade_produto, equip_upgrade_reasoning, astron_courses_total, astron_courses_completed, astron_last_login_at, created_at")
      .eq("id", leadId).is("merged_into", null).maybeSingle();
    if (!lead) return json({ error: "Lead não encontrado." }, 404);

    const [deals, nfs, acts, tickets] = await Promise.all([
      sb.from("deals").select("deal_title, pipeline_name, stage_name, status, owner_name, value, value_ps, value_mrr, items_text, origin_name, loss_reason, piperun_created_at, closed_at")
        .eq("lead_id", leadId).order("piperun_created_at", { ascending: false }).limit(40),
      sb.from("omie_notas_fiscais").select("numero_nf, data_emissao, valor_total, tipo_operacao, nf_direcao")
        .eq("lead_id", leadId).order("data_emissao", { ascending: false }).limit(30),
      sb.from("lead_activity_log").select("event_type, entity_name, event_timestamp, source_channel")
        .eq("lead_id", leadId).order("event_timestamp", { ascending: false }).limit(300),
      sb.from("technical_tickets").select("equipment, status, priority, created_at, resolved_at, closed_at")
        .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(15),
    ]);

    const timeline = (acts.data ?? []).filter((a: any) => !NOISE.test(String(a.event_type ?? ""))).slice(0, 80);
    const context = {
      hoje: new Date().toISOString().slice(0, 10),
      lead,
      negocios: deals.data ?? [],
      notas_fiscais: nfs.data ?? [],
      chamados_suporte: tickets.data ?? [],
      linha_do_tempo: timeline,
    };
    const sources = {
      negocios: context.negocios.length,
      notas_fiscais: context.notas_fiscais.length,
      chamados: context.chamados_suporte.length,
      eventos: timeline.length,
    };

    let r: any;
    try {
      r = await generateMessage({
        model: MODEL,
        max_tokens: 1800,
        system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(context).slice(0, 80_000) }],
      });
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("[lead-dossier] gateway", e.code, e.httpStatus, e.ids);
        const status = e.httpStatus === 402 ? 402 : e.httpStatus === 429 ? 429 : 502;
        const msg = status === 402 ? "Créditos de IA esgotados. Avise um administrador."
          : status === 429 ? "Muitos pedidos agora. Tente de novo em alguns minutos."
          : "Não foi possível gerar o dossiê agora. Tente novamente.";
        return json({ error: msg }, status);
      }
      throw e;
    }
    if (r?.stop_reason === "refusal") return json({ error: "A IA recusou gerar este dossiê." }, 422);
    const content = textOf(r);
    if (!content) return json({ error: "A IA não retornou conteúdo." }, 502);

    const generated_at = new Date().toISOString();
    const row = { lead_id: leadId, content, model: MODEL, sources, generated_at, generated_by: u.user.id };
    const { error: upErr } = await sb.from("lead_ai_dossiers").upsert(row, { onConflict: "lead_id" });
    if (upErr) console.error("[lead-dossier] save", upErr.message);

    await logAIUsage({
      functionName: "lead-dossier",
      actionLabel: "dossie_lead",
      model: MODEL,
      promptTokens: Number(r?.usage?.input_tokens ?? 0),
      completionTokens: Number(r?.usage?.output_tokens ?? 0),
      metadata: { lead_id: leadId },
    });

    return json({ dossier: { content, model: MODEL, generated_at, sources } });
  } catch (e) {
    console.error("[lead-dossier]", e);
    return json({ error: "Erro inesperado ao gerar o dossiê." }, 500);
  }
});
