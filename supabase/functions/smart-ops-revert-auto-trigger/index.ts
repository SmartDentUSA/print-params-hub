// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { piperunPut } from "../_shared/piperun-field-map.ts";

/**
 * smart-ops-revert-auto-trigger
 *
 * Reverte movimentações automáticas (`source = 'auto_trigger'`) das últimas N horas
 * no Funil de Vendas (pipeline 18784), devolvendo cada deal à etapa em que estava
 * ANTES da cascata. NUNCA altera proprietário. NUNCA toca em deals que estão
 * atualmente na 1ª etapa do pipeline (Novos Leads).
 *
 * Query params:
 *   ?dry_run=1        (default 1) — só lista o que faria
 *   ?hours=24         (default 24) — janela de transições a reverter
 *   ?pipeline_id=18784(default 18784) — Funil de Vendas
 *   ?limit=10000      (default 10000) — teto de deals processados
 */

const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "Primeira etapa" do funil comercial = qualquer stage cujo nome contenha "novos"
// (ex.: "Novos Leads", "Etapa 00 - Novos"). Detecção por nome é resiliente a
// renomeação/reordenação de stages no PipeRun e cobre os múltiplos pipelines
// internos que injetam cards no funil 18784.
const NOVOS_REGEX = /novos/i;
const isNovosStage = (name?: string | null) => !!name && NOVOS_REGEX.test(name);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") !== "0";
  const hours = Math.max(1, Math.min(168, Number(url.searchParams.get("hours") ?? "24")));
  const pipelineId = Number(url.searchParams.get("pipeline_id") ?? "18784");
  const limit = Math.max(1, Math.min(20000, Number(url.searchParams.get("limit") ?? "10000")));

  if (!PIPERUN_API_KEY) {
    return new Response(JSON.stringify({ error: "PIPERUN_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Fetch ALL auto_trigger transitions in window, paginated (PostgREST caps at 1000/page)
  const sinceISO = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const PAGE = 1000;
  let offset = 0;
  const allTransitions: Array<{ deal_id: string; stage_from_id: number | null; stage_from_name: string | null; created_at: string }> = [];
  while (true) {
    const { data, error } = await supabase
      .from("piperun_stage_transitions")
      .select("deal_id, stage_from_id, stage_from_name, created_at")
      .eq("source", "auto_trigger")
      .eq("pipeline_id", pipelineId)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data || data.length === 0) break;
    allTransitions.push(...(data as any));
    if (data.length < PAGE) break;
    offset += PAGE;
    if (offset > 100000) break; // safety
  }
  const transitions = allTransitions;

  // Deduplicate: keep EARLIEST per deal_id
  const earliest = new Map<string, { stage_from_id: number; stage_from_name: string; created_at: string }>();
  for (const t of transitions ?? []) {
    if (!t.deal_id || !t.stage_from_id) continue;
    if (!earliest.has(t.deal_id)) {
      earliest.set(t.deal_id, {
        stage_from_id: t.stage_from_id as number,
        stage_from_name: (t.stage_from_name as string) ?? "",
        created_at: t.created_at as string,
      });
    }
  }

  const candidates = Array.from(earliest.entries()).slice(0, limit);

  // 3. Fetch current local stage_id for each candidate
  const dealIds = candidates.map(([id]) => id);
  const { data: localDeals } = await supabase
    .from("deals")
    .select("piperun_deal_id, stage_id, stage_name")
    .in("piperun_deal_id", dealIds);

  const localMap = new Map<string, { stage_id: number | null; stage_name: string | null }>();
  for (const d of localDeals ?? []) {
    localMap.set(String(d.piperun_deal_id), {
      stage_id: (d as any).stage_id as number | null,
      stage_name: (d as any).stage_name as string | null,
    });
  }

  const stats = {
    pipeline_id: pipelineId,
    hours,
    dry_run: dryRun,
    transitions_scanned: transitions.length,
    distinct_deals: earliest.size,
    total_candidates: candidates.length,
    skipped_current_is_novos: 0,
    skipped_target_is_novos: 0,
    skipped_noop: 0,
    skipped_no_local: 0,
    reverted: 0,
    failed: 0,
  };
  const sample: any[] = [];
  const errors: any[] = [];

  // 4. Process
  for (const [dealId, info] of candidates) {
    const local = localMap.get(dealId);
    const currentStageId = local?.stage_id ?? null;
    const targetStageId = info.stage_from_id;

    // Skip: deal não tem registro local (não conseguimos espelhar)
    if (!local) {
      stats.skipped_no_local++;
      continue;
    }
    // Skip: deal está atualmente em "Novos Leads" — preservar intocado
    if (isNovosStage(local.stage_name)) {
      stats.skipped_current_is_novos++;
      continue;
    }
    // Skip: target é uma etapa "Novos" — não devolvemos deals para Novos Leads
    if (isNovosStage(info.stage_from_name)) {
      stats.skipped_target_is_novos++;
      continue;
    }
    // Skip: noop
    if (currentStageId === targetStageId) {
      stats.skipped_noop++;
      continue;
    }

    if (sample.length < 15) {
      sample.push({
        deal_id: dealId,
        current_stage_id: currentStageId,
        current_stage_name: local?.stage_name ?? null,
        target_stage_id: targetStageId,
        target_stage_name: info.stage_from_name,
        first_auto_at: info.created_at,
      });
    }

    if (dryRun) {
      stats.reverted++;
      continue;
    }

    try {
      const put = await piperunPut(PIPERUN_API_KEY, `deals/${dealId}`, {
        stage_id: targetStageId,
        pipeline_id: pipelineId,
      });
      if (!put.success) {
        stats.failed++;
        errors.push({ deal_id: dealId, status: put.status, data: put.data });
      } else {
        stats.reverted++;
        // Mirror local
        await supabase
          .from("deals")
          .update({
            stage_id: targetStageId,
            stage_name: info.stage_from_name,
            last_stage_updated_at: new Date().toISOString(),
          })
          .eq("piperun_deal_id", dealId);

        await supabase.from("system_health_logs").insert({
          event_type: "revert_auto_trigger",
          source: "smart-ops-revert-auto-trigger",
          status: "ok",
          details: {
            deal_id: dealId,
            from_stage_id: currentStageId,
            to_stage_id: targetStageId,
            target_name: info.stage_from_name,
            pipeline_id: pipelineId,
          },
        });
      }
      // Throttle ~5 req/s
      await sleep(200);
    } catch (e) {
      stats.failed++;
      errors.push({ deal_id: dealId, error: String(e) });
    }
  }

  await supabase.from("system_health_logs").insert({
    event_type: "revert_auto_trigger_summary",
    source: "smart-ops-revert-auto-trigger",
    status: stats.failed > 0 ? "partial" : "ok",
    details: stats as any,
  });

  return new Response(JSON.stringify({ stats, sample, errors: errors.slice(0, 20) }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
