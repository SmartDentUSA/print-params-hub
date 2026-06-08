// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { piperunPut, STAGES_VENDAS } from "../_shared/piperun-field-map.ts";

/**
 * smart-ops-restore-vendas-snapshot
 *
 * Restaura deals que estavam no Funil de Vendas (18784) em um snapshot de data
 * (default 2026-06-06) e foram movidos pela régua para o Funil Estagnados (72938)
 * ou regrediram dentro do próprio 18784.
 *
 * NUNCA toca: owner, valor, custom_fields, deals em CS Onboarding (83896),
 * deals won/lost, ou deals fora do snapshot.
 *
 * Query params:
 *   ?dry_run=1                        (default 1)
 *   ?snapshot_date=2026-06-06         (default 2026-06-06)
 *   ?limit=2000                       (default 2000)
 *   ?offset=0                         (default 0) — para chamadas faseadas
 */

const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PIPELINE_VENDAS = 18784;
const PIPELINE_ESTAGNADOS = 72938;
const PIPELINE_CS_ONBOARDING = 83896;

// Ordem canônica do Funil de Vendas (18784). "Sem contato" (0) é INTOCÁVEL.
const STAGE_ORDER: Record<string, number> = {
  "Sem contato": 0,
  "sem_contato": 0,
  "Novos Leads": 0,
  "C1": 1,
  "Contato Feito": 1,
  "C2": 2,
  "C3": 3,
  "SDR / Nutrição": 4,
  "Em Contato": 4,
  "Apresentação/Visita": 5,
  "Proposta enviada": 6,
  "Proposta enviada (TEMP)": 6,
  "Negociação": 7,
  "LTV": 8,
  "Fechamento": 9,
};

// Mapa nome (como gravado em piperun_stage_transitions.stage_to_name) → stage_id no 18784
const STAGE_NAME_TO_ID: Record<string, number> = {
  "C1": STAGES_VENDAS.C1,
  "C2": STAGES_VENDAS.C2,
  "C3": STAGES_VENDAS.C3,
  "SDR / Nutrição": STAGES_VENDAS.SDR_NUTRICAO,
  "Contato Feito": STAGES_VENDAS.CONTATO_FEITO, // legacy = C1
  "Em Contato": STAGES_VENDAS.EM_CONTATO,       // legacy = SDR_NUTRICAO
  "Apresentação/Visita": STAGES_VENDAS.APRESENTACAO_VISITA,
  "Proposta enviada": STAGES_VENDAS.PROPOSTA_ENVIADA,
  "Proposta enviada (TEMP)": STAGES_VENDAS.PROPOSTA_ENVIADA, // alias → canônico
  "Negociação": STAGES_VENDAS.NEGOCIACAO,
};

const ELIGIBLE_NAMES = Object.keys(STAGE_NAME_TO_ID);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") !== "0";
  const snapshotDate = url.searchParams.get("snapshot_date") ?? "2026-06-06";
  const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get("limit") ?? "2000")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));

  if (!PIPERUN_API_KEY) {
    return new Response(JSON.stringify({ error: "PIPERUN_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Build candidate set via SQL using RPC bypass: use REST .rpc? we don't have it. Use raw select join.
  // Pull all snapshot rows first, then deals locally.
  const snapshotCutoff = `${snapshotDate} 23:59:59+00`;

  // RPC retorna apenas candidatos finais (snapshot ABERTOS 06/06 que hoje estão
  // em Estagnados OU regrediram no 18784, excluindo won/lost, CS Onboarding e
  // primeira etapa). Cabe em <1000 linhas.
  const { data: candidatesRaw, error: rpcErr } = await supabase.rpc(
    "vendas_restore_candidates_at", { cutoff: snapshotCutoff },
  );
  if (rpcErr) {
    return new Response(JSON.stringify({ error: rpcErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  type Action = { deal_id: string; from_pipeline: number | null; from_stage: string | null; target_stage_name: string; target_stage_id: number };
  const actions: Action[] = [];
  const stats = {
    snapshot_date: snapshotDate,
    dry_run: dryRun,
    candidates_from_rpc: (candidatesRaw ?? []).length,
    skipped_no_target_stage: 0,
    candidates: 0,
    restored: 0,
    failed: 0,
  };

  for (const c of (candidatesRaw ?? []) as any[]) {
    const snapStage = String(c.stage_0606 ?? "");
    const targetId = STAGE_NAME_TO_ID[snapStage];
    if (!targetId) { stats.skipped_no_target_stage++; continue; }
    actions.push({
      deal_id: String(c.deal_id),
      from_pipeline: c.from_pipeline ?? null,
      from_stage: c.from_stage ?? null,
      target_stage_name: snapStage,
      target_stage_id: targetId,
    });
  }

  stats.candidates = actions.length;
  const slice = actions.slice(offset, offset + limit);
  const sample = slice.slice(0, 15);
  const errors: any[] = [];

  if (!dryRun) {
    for (const a of slice) {
      try {
        const put = await piperunPut(PIPERUN_API_KEY, `deals/${a.deal_id}`, {
          pipeline_id: PIPELINE_VENDAS,
          stage_id: a.target_stage_id,
        });
        if (!put.success) {
          stats.failed++;
          errors.push({ deal_id: a.deal_id, status: put.status, data: put.data });
        } else {
          stats.restored++;
          await supabase.from("deals").update({
            pipeline_id: PIPELINE_VENDAS,
            pipeline_name: "Funil de vendas",
            stage_id: a.target_stage_id,
            stage_name: a.target_stage_name,
            last_stage_updated_at: new Date().toISOString(),
          }).eq("piperun_deal_id", a.deal_id);

          await supabase.from("system_health_logs").insert({
            function_name: "smart-ops-restore-vendas-snapshot",
            error_type: "restore_vendas_snapshot",
            severity: "info",
            details: {
              deal_id: a.deal_id,
              from_pipeline: a.from_pipeline,
              from_stage: a.from_stage,
              to_stage_id: a.target_stage_id,
              to_stage_name: a.target_stage_name,
            } as any,
          });
        }
        await sleep(120);
      } catch (e) {
        stats.failed++;
        errors.push({ deal_id: a.deal_id, error: String(e) });
      }
    }
  } else {
    stats.restored = slice.length; // dry-run preview count
  }

  await supabase.from("system_health_logs").insert({
    function_name: "smart-ops-restore-vendas-snapshot",
    error_type: "restore_vendas_snapshot_summary",
    severity: stats.failed > 0 ? "warning" : "info",
    details: { ...stats, processed_slice: slice.length, offset } as any,
  });

  return new Response(JSON.stringify({ stats, processed_slice: slice.length, offset, sample, errors: errors.slice(0, 20) }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});