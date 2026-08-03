/**
 * piperun-vendas-open-recon
 *
 * Reconciles OPEN deals of PipeRun's "Funil de Vendas" (pipeline 18784) with
 * the local mirror `public.deals`. Read-only against PipeRun — it NEVER writes
 * to the CRM (Golden Rule: never touch Vendas/CS funnels in PipeRun).
 *
 *   ?mode=count  (default) -> reports PipeRun open total vs local open total
 *   ?mode=apply            -> closes local rows that are no longer open in
 *                             PipeRun, using the real CRM status when known
 *                             (won/lost) or `is_deleted=true` when the deal no
 *                             longer exists in the funnel at all.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { piperunGet } from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VENDAS_PIPELINE_ID = 18784;

type Deal = { id: number; status?: number | string; stage_id?: number; stage?: { name?: string } };

async function fetchDealsByStatus(apiKey: string, status: number) {
  const map = new Map<string, Deal>();
  let total: number | null = null;
  for (let page = 1; page <= 200; page++) {
    const res = await piperunGet(apiKey, "deals", {
      show: 200,
      page,
      pipeline_id: VENDAS_PIPELINE_ID,
      status, // 0 = aberta, 1 = ganha, 2 = perdida
    });
    if (!res.success) break;
    const body = res.data as { data?: Deal[]; meta?: { pagination?: { total?: number; current_page?: number; total_pages?: number } } };
    const items = body?.data ?? [];
    const pag = body?.meta?.pagination;
    if (total === null && pag?.total != null) total = pag.total;
    for (const d of items) map.set(String(d.id), d);
    if (items.length === 0) break;
    if (pag?.total_pages && pag.current_page && pag.current_page >= pag.total_pages) break;
  }
  return { deals: map, reportedTotal: total };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");
  if (!PIPERUN_API_KEY) {
    return new Response(JSON.stringify({ error: "PIPERUN_API_KEY missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") || "count").toLowerCase();
  const startedAt = Date.now();

  try {
    const { deals: openRemote, reportedTotal } = await fetchDealsByStatus(PIPERUN_API_KEY, 0);
    // Real CRM status for the stale rows: never guess "perdida" for a won deal.
    const wonRemote = mode === "apply"
      ? (await fetchDealsByStatus(PIPERUN_API_KEY, 1)).deals
      : new Map<string, Deal>();
    const lostRemote = mode === "apply"
      ? (await fetchDealsByStatus(PIPERUN_API_KEY, 2)).deals
      : new Map<string, Deal>();

    // Local open mirror rows
    const localIds: string[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("deals")
        .select("piperun_deal_id")
        .eq("pipeline_id", VENDAS_PIPELINE_ID)
        .eq("status", "aberta")
        .eq("is_deleted", false)
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      for (const r of rows) if (r.piperun_deal_id) localIds.push(String(r.piperun_deal_id));
      if (rows.length < pageSize) break;
    }

    const stale = localIds.filter((id) => !openRemote.has(id));
    const missingLocally = [...openRemote.keys()].filter((id) => !localIds.includes(id));

    let closed = 0;
    let marked_won = 0;
    let marked_lost = 0;
    let marked_deleted = 0;
    if (mode === "apply" && stale.length > 0) {
      const buckets: Record<string, string[]> = { ganha: [], perdida: [], deleted: [] };
      for (const id of stale) {
        if (wonRemote.has(id)) buckets.ganha.push(id);
        else if (lostRemote.has(id)) buckets.perdida.push(id);
        else buckets.deleted.push(id);
      }
      const nowIso = new Date().toISOString();
      for (const [bucket, ids] of Object.entries(buckets)) {
        for (let i = 0; i < ids.length; i += 200) {
          const slice = ids.slice(i, i + 200);
          const patch = bucket === "deleted"
            ? { is_deleted: true, updated_at: nowIso }
            : { status: bucket, closed_at: nowIso, updated_at: nowIso };
          const { error, count } = await supabase
            .from("deals")
            .update(patch, { count: "exact" })
            .in("piperun_deal_id", slice)
            .eq("pipeline_id", VENDAS_PIPELINE_ID)
            .eq("status", "aberta");
          if (error) throw new Error(error.message);
          const n = count ?? slice.length;
          closed += n;
          if (bucket === "ganha") marked_won += n;
          else if (bucket === "perdida") marked_lost += n;
          else marked_deleted += n;
        }
      }
    }

    const payload = {
      success: true,
      mode,
      piperun_open_total: reportedTotal ?? openRemote.size,
      piperun_open_fetched: openRemote.size,
      local_open_before: localIds.length,
      stale_local: stale.length,
      open_missing_locally: missingLocally.length,
      missing_sample: missingLocally.slice(0, 20),
      closed,
      marked_won,
      marked_lost,
      marked_deleted,
      elapsed_ms: Date.now() - startedAt,
    };

    await supabase.from("system_health_logs").insert({
      function_name: "piperun_vendas_open_recon",
      severity: stale.length > 50 ? "warning" : "info",
      error_type: stale.length > 0 ? "vendas_open_drift" : "ok",
      details: payload,
    });

    return new Response(JSON.stringify(payload), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
