import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let limit = 25;
  let dryRun = false;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (typeof body.limit === "number") limit = Math.min(100, body.limit);
      if (body.dry_run === true) dryRun = true;
    }
  } catch {}

  // Find canonical leads created in the last 7 days, with email but no piperun_id,
  // and that have not been retried yet (raw_payload.piperun_retry_attempted_at NULL).
  const { data: leads, error } = await supabase
    .from("lia_attendances")
    .select("id, email, raw_payload, created_at")
    .is("merged_into", null)
    .is("piperun_id", null)
    .not("email", "is", null)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const candidates = (leads || []).filter((l: any) => {
    const email = (l.email || "").toLowerCase();
    if (!email || /test|teste|example/.test(email)) return false;
    return !l.raw_payload?.piperun_retry_attempted_at;
  }).slice(0, limit);

  const results: Array<{ lead_id: string; ok: boolean; piperun_id?: string | null; error?: string }> = [];

  for (const lead of candidates) {
    if (dryRun) {
      results.push({ lead_id: lead.id, ok: true, piperun_id: null });
      continue;
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-lia-assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ lead_id: lead.id, force: true, trigger: "auto_retry_failed_piperun" }),
      });
      const json = await res.json().catch(() => ({}));

      // Mark attempt timestamp regardless of outcome (avoid hot loop)
      const newPayload = { ...(lead.raw_payload || {}), piperun_retry_attempted_at: new Date().toISOString() };
      await supabase.from("lia_attendances").update({ raw_payload: newPayload }).eq("id", lead.id);

      results.push({ lead_id: lead.id, ok: !!json.piperun_id, piperun_id: json.piperun_id || null });
    } catch (e) {
      results.push({ lead_id: lead.id, ok: false, error: String(e) });
    }
  }

  return new Response(
    JSON.stringify({ checked: candidates.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});