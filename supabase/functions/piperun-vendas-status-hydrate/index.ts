/**
 * piperun-vendas-status-hydrate
 *
 * Re-hydrates the real CRM status of local "Funil de Vendas" (18784) deals that
 * the reconciler flagged as no longer open in PipeRun. Read-only against the
 * CRM: it delegates to `smart-ops-sync-piperun?deal_ids=` (max 50 per call),
 * which upserts the authoritative snapshot (status, closed_at, value, stage).
 *
 * POST body: { limit?: number }  (default 500 deals per run)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VENDAS_PIPELINE_ID = 18784;
const CHUNK = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let limit = 500;
  try {
    const body = await req.json();
    if (body?.limit) limit = Math.max(1, Math.min(2000, Number(body.limit)));
  } catch (_) { /* no body */ }

  const startedAt = Date.now();

  const { data, error } = await supabase
    .from("deals")
    .select("piperun_deal_id")
    .eq("pipeline_id", VENDAS_PIPELINE_ID)
    .eq("is_deleted", true)
    .eq("status", "aberta")
    .not("piperun_deal_id", "is", null)
    .limit(limit);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ids = (data ?? []).map((r) => String(r.piperun_deal_id));

  const run = async () => {
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/smart-ops-sync-piperun?deal_ids=${slice.join(",")}`,
          { method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
        );
        const json = await res.json().catch(() => ({}));
        ok += Number(json?.updated ?? 0) + Number(json?.created ?? 0);
      } catch (_) {
        failed += slice.length;
      }
      // PipeRun allows 120 req/min — keep a safe cadence.
      await new Promise((r) => setTimeout(r, 1500));
    }
    await supabase.from("system_health_logs").insert({
      function_name: "piperun_vendas_status_hydrate",
      severity: failed > 0 ? "warning" : "info",
      error_type: "status_hydrate",
      details: { requested: ids.length, hydrated: ok, failed, elapsed_ms: Date.now() - startedAt },
    });
  };

  // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
  EdgeRuntime.waitUntil(run());

  return new Response(JSON.stringify({ success: true, queued: ids.length }), {
    status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
