// Resumo por IA do histórico do profissional com a Smart Dent (ficha do profissional).
// Só equipe interna. Lê lead canônico, deals, NFs, timeline, indicações e eventos; grava em lia_attendances.prof_ai_summary.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { aiComplete } from "../_shared/ai-router.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Não autenticado" }, 401);
    const { data: isStaff } = await userClient.rpc("fn_is_internal_staff" as any);
    if (!isStaff) return json({ error: "Sem permissão" }, 403);

    const body = await req.json().catch(() => ({}));
    const leadId = String(body?.lead_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(leadId)) return json({ error: "lead_id inválido" }, 400);

    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: lead } = await sb.from("lia_attendances")
      .select("id, nome, prof_display_name, email, especialidade, area_atuacao, empresa_nome, empresa_razao_social, empresa_cnpj, instagram, produto_interesse, equip_scanner, equip_impressora, equip_cad, equip_fresadora, prof_kol_form_ids, prof_kol_coupons, omie_razao_social")
      .eq("id", leadId).is("merged_into", null).maybeSingle();
    if (!lead) return json({ error: "Profissional não encontrado" }, 404);

    const [deals, nfs, acts, referrals] = await Promise.all([
      sb.from("deals").select("piperun_deal_id, deal_title, pipeline_name, stage_name, status, value, value_ps, value_mrr, items_text, origin_name, piperun_created_at, closed_at").eq("lead_id", leadId).order("piperun_created_at", { ascending: false }).limit(60),
      sb.from("omie_notas_fiscais").select("numero_nf, data_emissao, valor_total, tipo_operacao, nf_direcao").eq("lead_id", leadId).order("data_emissao", { ascending: false }).limit(60),
      sb.from("lead_activity_log").select("event_type, entity_name, event_timestamp, source_channel").eq("lead_id", leadId).order("event_timestamp", { ascending: false }).limit(250),
      sb.from("lia_attendances").select("id", { count: "exact", head: true }).eq("prof_referrer_lead_id" as any, leadId).is("merged_into", null).then((r: any) => r, () => ({ count: null })),
    ]);

    const evTypes: Record<string, number> = {};
    for (const a of acts.data ?? []) evTypes[a.event_type] = (evTypes[a.event_type] ?? 0) + 1;

    const context = {
      profissional: lead,
      negocios: deals.data ?? [],
      notas_fiscais: nfs.data ?? [],
      timeline_contagem_por_tipo: evTypes,
      timeline_recente: (acts.data ?? []).slice(0, 120),
      indicacoes_atribuidas: (referrals as any)?.count ?? null,
    };

    const r = await aiComplete({
      task: "auto_balanced",
      functionName: "prof-history-summary",
      maxTokens: 1200,
      messages: [
        { role: "system", content: "Você é analista comercial da Smart Dent. Escreva em português do Brasil um resumo objetivo (até 12 linhas, com tópicos) do relacionamento do profissional com a Smart Dent para quem está cadastrando-o como KOL: produtos já comprados e valores aproximados, negócios em aberto/perdidos, notas fiscais, indicações/oportunidades geradas, participação em eventos/cursos, presença em redes sociais e menções à Smart Dent. Use SOMENTE os dados fornecidos. Se algo não constar nos dados, escreva 'sem registro'. Nunca invente." },
        { role: "user", content: JSON.stringify(context).slice(0, 60000) },
      ],
    });
    if (!r.ok || !r.text) {
      const status = r.error_code === "credits_exhausted" ? 402 : r.error_code === "rate_limited" ? 429 : 502;
      return json({ error: r.error ?? "Falha ao gerar resumo" }, status);
    }
    const at = new Date().toISOString();
    await sb.from("lia_attendances").update({ prof_ai_summary: r.text, prof_ai_summary_at: at }).eq("id", leadId);
    return json({ summary: r.text, generated_at: at });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
