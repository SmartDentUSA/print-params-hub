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

  // 1) Paginated fetch of ALL transitions up to cutoff in pipeline 18784
  const PAGE = 1000;
  let pgOffset = 0;
  const snapMap = new Map<string, { stage_to_name: string; created_at: string }>();
  // We need LAST per deal_id <= cutoff. Sort DESC and keep first seen.
  while (true) {
    const { data, error } = await supabase
      .from("piperun_stage_transitions")
      .select("deal_id, stage_to_name, created_at")
      .eq("pipeline_id", PIPELINE_VENDAS)
      .lte("created_at", snapshotCutoff)
      .in("stage_to_name", ELIGIBLE_NAMES)
      .order("created_at", { ascending: false })
      .range(pgOffset, pgOffset + PAGE - 1);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data || data.length === 0) break;
    for (const r of data as any[]) {
      if (!r.deal_id) continue;
      if (!snapMap.has(r.deal_id)) {
        snapMap.set(r.deal_id, { stage_to_name: r.stage_to_name, created_at: r.created_at });
      }
    }
    if (data.length < PAGE) break;
    pgOffset += PAGE;
    if (pgOffset > 200000) break;
  }

  // BUT: a deal's true snapshot stage could be a NON-eligible stage (e.g., LTV/Fechamento).
  // We must filter those out. Re-fetch full latest-per-deal (any stage) and reject ones whose
  // latest <= cutoff is NOT in ELIGIBLE_NAMES.
  pgOffset = 0;
  const fullLatest = new Map<string, { stage_to_name: string; created_at: string }>();
  while (true) {
    const { data, error } = await supabase
      .from("piperun_stage_transitions")
      .select("deal_id, stage_to_name, created_at")
      .eq("pipeline_id", PIPELINE_VENDAS)
      .lte("created_at", snapshotCutoff)
      .in("deal_id", Array.from(snapMap.keys()).slice(0, 5000)) // safety
      .order("created_at", { ascending: false })
      .range(pgOffset, pgOffset + PAGE - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    for (const r of data as any[]) {
      if (!fullLatest.has(r.deal_id)) {
        fullLatest.set(r.deal_id, { stage_to_name: r.stage_to_name, created_at: r.created_at });
      }
    }
    if (data.length < PAGE) break;
    pgOffset += PAGE;
    if (pgOffset > 200000) break;
  }

  // Keep only deals whose TRUE latest stage at snapshot is eligible
  const validSnapshot = new Map<string, string>(); // deal_id -> stage_name at snapshot
  for (const [id, info] of fullLatest) {
    if (ELIGIBLE_NAMES.includes(info.stage_to_name)) {
      validSnapshot.set(id, info.stage_to_name);
    }
  }

  // 2) Pull current local deals for those IDs (batched)
  const allIds = Array.from(validSnapshot.keys());
  const locals = new Map<string, { pipeline_id: number | null; stage_id: number | null; stage_name: string | null; status: string | null }>();
  for (let i = 0; i < allIds.length; i += 500) {
    const chunk = allIds.slice(i, i + 500);
    const { data } = await supabase
      .from("deals")
      .select("piperun_deal_id, pipeline_id, stage_id, stage_name, status")
      .in("piperun_deal_id", chunk);
    for (const d of (data ?? []) as any[]) {
      locals.set(String(d.piperun_deal_id), {
        pipeline_id: d.pipeline_id, stage_id: d.stage_id, stage_name: d.stage_name, status: d.status,
      });
    }
  }

  // 3) Build action list
  type Action = { deal_id: string; from_pipeline: number | null; from_stage: string | null; target_stage_name: string; target_stage_id: number };
  const actions: Action[] = [];
  const stats = {
    snapshot_date: snapshotDate,
    dry_run: dryRun,
    snapshot_deals_in_eligible_stages: validSnapshot.size,
    skipped_no_local: 0,
    skipped_won_lost: 0,
    skipped_cs_onboarding: 0,
    skipped_already_correct: 0,
    skipped_other_pipeline: 0,
    candidates: 0,
    restored: 0,
    failed: 0,
  };

  for (const [dealId, snapStage] of validSnapshot) {
    const local = locals.get(dealId);
    if (!local) { stats.skipped_no_local++; continue; }
    if (["won","lost","ganha","perdida"].includes(String(local.status ?? "").toLowerCase())) {
      stats.skipped_won_lost++; continue;
    }
    if (local.pipeline_id === 83896) { stats.skipped_cs_onboarding++; continue; }
    if (local.pipeline_id !== PIPELINE_VENDAS && local.pipeline_id !== 72938) {
      stats.skipped_other_pipeline++; continue;
    }
    if (local.pipeline_id === PIPELINE_VENDAS && local.stage_name === snapStage) {
      stats.skipped_already_correct++; continue;
    }
    const targetId = STAGE_NAME_TO_ID[snapStage];
    if (!targetId) continue;
    actions.push({
      deal_id: dealId,
      from_pipeline: local.pipeline_id,
      from_stage: local.stage_name,
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