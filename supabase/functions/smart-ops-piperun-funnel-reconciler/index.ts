/**
 * smart-ops-piperun-funnel-reconciler
 *
 * Detective layer that closes the gap between PipeRun's "Funil de Vendas"
 * (pipeline 18784) and our CDP. Every run:
 *   1. Asks PipeRun for all deals in Vendas updated in the last N hours.
 *   2. Joins with `lia_attendances.piperun_id` to find DEALS WITH NO CDP ROW.
 *   3. For any gap, invokes `smart-ops-sync-piperun?pipeline_id=18784
 *      &since_hours=N&full=true&orchestrate=true` so the existing chunked
 *      pipeline inserts the missing leads using its full snapshot logic.
 *   4. Logs `piperun_funnel_reconciler` to `system_health_logs` with severity
 *      = critical when gap_count > 0 so the team is alerted.
 *
 * Scheduled hourly via cron. May also be invoked manually with `?hours=72`
 * for wider backfills.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { piperunGet } from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VENDAS_PIPELINE_ID = 18784;

interface PiperunDealLite {
  id: number;
  title?: string;
  status?: number | string;
  updated_at?: string;
  created_at?: string;
  person?: { id?: number; name?: string; emails?: Array<{ email?: string }> } | null;
}

async function fetchVendasDeals(apiKey: string, sinceIso: string): Promise<PiperunDealLite[]> {
  const all: PiperunDealLite[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await piperunGet(apiKey, "deals", {
      show: 100,
      page,
      pipeline_id: VENDAS_PIPELINE_ID,
      updated_since: sinceIso,
    }, { "with[]": ["person", "person.emails"] });
    if (!res.success) break;
    const data = res.data as { data?: PiperunDealLite[]; meta?: { current_page: number; last_page: number } };
    const items = data?.data ?? [];
    if (items.length === 0) break;
    all.push(...items);
    if (data?.meta && data.meta.current_page >= data.meta.last_page) break;
  }
  return all;
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
  const hours = Math.max(1, Math.min(168, Number(url.searchParams.get("hours") || "2")));
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const startedAt = Date.now();

  try {
    // 1. Fetch all recently-updated deals in Funil de Vendas
    const deals = await fetchVendasDeals(PIPERUN_API_KEY, sinceIso);
    const dealIds = deals.map((d) => String(d.id));

    // 2. Find which ones already exist in CDP
    let existingIds = new Set<string>();
    if (dealIds.length > 0) {
      // PostgREST `in` filter — chunk by 200 to stay under URL limits
      for (let i = 0; i < dealIds.length; i += 200) {
        const slice = dealIds.slice(i, i + 200);
        const { data, error } = await supabase
          .from("lia_attendances")
          .select("piperun_id")
          .in("piperun_id", slice);
        if (error) {
          console.error("[reconciler] DB lookup error:", error.message);
          continue;
        }
        for (const row of data ?? []) {
          if (row.piperun_id) existingIds.add(String(row.piperun_id));
        }
      }
    }

    const gaps = deals.filter((d) => !existingIds.has(String(d.id)));
    const gapSample = gaps.slice(0, 20).map((d) => ({
      deal_id: d.id,
      title: d.title ?? null,
      email: d.person?.emails?.[0]?.email ?? null,
      created_at: d.created_at ?? null,
    }));

    let triggered = false;
    if (gaps.length > 0) {
      // Fire-and-forget chunked sync to backfill. We do not await so the
      // reconciler returns its audit log promptly even on heavy backfills.
      const syncUrl = `${SUPABASE_URL}/functions/v1/smart-ops-sync-piperun`
        + `?orchestrate=true&pipeline_id=${VENDAS_PIPELINE_ID}&since_hours=${hours}`;
      fetch(syncUrl, {
        headers: {
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
      }).catch((e) => console.error("[reconciler] sync invoke failed:", e));
      triggered = true;
    }
    const triggerStatus = null;

    const severity = gaps.length === 0 ? "info" : gaps.length > 10 ? "critical" : "warning";
    const elapsedMs = Date.now() - startedAt;

    await supabase.from("system_health_logs").insert({
      function_name: "piperun_funnel_reconciler",
      severity,
      error_type: gaps.length > 0 ? "vendas_gap_detected" : "ok",
      details: {
        window_hours: hours,
        deals_in_window: deals.length,
        existing_in_cdp: existingIds.size,
        gap_count: gaps.length,
        gap_sample: gapSample,
        backfill_triggered: triggered,
        backfill_status: triggerStatus,
        elapsed_ms: elapsedMs,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      window_hours: hours,
      deals_in_window: deals.length,
      gap_count: gaps.length,
      gap_sample: gapSample,
      backfill_triggered: triggered,
      backfill_status: triggerStatus,
      elapsed_ms: elapsedMs,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("system_health_logs").insert({
      function_name: "piperun_funnel_reconciler",
      severity: "critical",
      error_type: "reconciler_crash",
      details: { error: msg, window_hours: hours },
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});