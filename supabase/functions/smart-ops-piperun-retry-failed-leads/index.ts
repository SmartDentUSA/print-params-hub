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
  let emailsFilter: string[] | null = null;
  let force = false;
  let lookbackDays = 7;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (typeof body.limit === "number") limit = Math.min(100, body.limit);
      if (body.dry_run === true) dryRun = true;
      if (Array.isArray(body.emails) && body.emails.length > 0) {
        emailsFilter = body.emails.map((e: string) => String(e).toLowerCase().trim()).filter(Boolean);
      }
      if (body.force === true) force = true;
      if (typeof body.lookback_days === "number") lookbackDays = body.lookback_days;
    }
  } catch {}

  let query = supabase
    .from("lia_attendances")
    .select("id, email, raw_payload, created_at")
    .is("merged_into", null)
    .is("piperun_id", null)
    .not("email", "is", null);
  if (emailsFilter) {
    query = query.in("email", emailsFilter);
  } else {
    query = query.gte("created_at", new Date(Date.now() - lookbackDays * 24 * 3600 * 1000).toISOString());
  }
  const { data: leads, error } = await query
    .order("created_at", { ascending: false })
    .limit(Math.max(200, limit * 2));

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const candidates = (leads || []).filter((l: any) => {
    const email = (l.email || "").toLowerCase();
    if (!email || /test|teste|example/.test(email)) return false;
    if (force) return true;
    return !l.raw_payload?.piperun_retry_attempted_at;
  }).slice(0, limit);

  // Dry-run: delegate to preflight to avoid any Piperun writes
  if (dryRun) {
    const candEmails = candidates.map((c: any) => String(c.email || "").toLowerCase()).filter(Boolean);
    const pre = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-piperun-preflight`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ emails: candEmails }),
    });
    const preJson = await pre.json().catch(() => ({}));
    return new Response(
      JSON.stringify({ dry_run: true, checked: candidates.length, preflight: preJson }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: Array<{ lead_id: string; ok: boolean; piperun_id?: string | null; error?: string }> = [];

  for (const lead of candidates) {
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
      const newPayload: Record<string, unknown> = {
        ...(lead.raw_payload || {}),
        piperun_retry_attempted_at: new Date().toISOString(),
      };
      if (json.piperun_id) {
        newPayload.piperun_retry_succeeded_at = new Date().toISOString();
      }
      await supabase.from("lia_attendances").update({ raw_payload: newPayload }).eq("id", lead.id);

      // On success, fire seller summary note (fire-and-forget)
      if (json.piperun_id) {
        fetch(`${SUPABASE_URL}/functions/v1/smart-ops-deal-form-note`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            lead_id: lead.id,
            form_name: "Recuperação automática (retry Piperun)",
            responses: [],
          }),
        }).catch((e) => console.warn("[retry-failed] deal-form-note error:", e));
      }

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