import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Exponential backoff schedule (minutes) per attempt index (0-based).
// 6 attempts max: 15min, 30min, 1h, 2h, 4h, 8h.
const BACKOFF_MINUTES = [15, 30, 60, 120, 240, 480];
const MAX_ATTEMPTS = BACKOFF_MINUTES.length;

function isCandidate(rp: Record<string, unknown> | null | undefined, force: boolean): boolean {
  if (force) return true;
  const attempts = Number(rp?.["piperun_retry_attempts"] ?? 0);
  if (attempts >= MAX_ATTEMPTS) return false; // exhausted, do not retry anymore
  if (attempts === 0) return true; // never tried via cron
  const lastAt = rp?.["piperun_retry_last_attempt_at"] as string | undefined;
  if (!lastAt) return true;
  const waitMs = BACKOFF_MINUTES[Math.min(attempts - 1, MAX_ATTEMPTS - 1)] * 60_000;
  return Date.now() - new Date(lastAt).getTime() >= waitMs;
}

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
    return isCandidate(l.raw_payload as Record<string, unknown> | null, force);
  }).slice(0, limit);

  console.log(`[retry-failed] Sweep: ${leads?.length ?? 0} stuck leads, ${candidates.length} eligible (force=${force}, lookback=${lookbackDays}d)`);

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
      JSON.stringify({ dry_run: true, checked: candidates.length, candidates: candidates.map((c: any) => ({ id: c.id, email: c.email, attempts: Number(c.raw_payload?.piperun_retry_attempts ?? 0) })), preflight: preJson }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: Array<{ lead_id: string; email: string; ok: boolean; attempts: number; piperun_id?: string | null; error?: string }> = [];

  for (const lead of candidates) {
    const rp = (lead.raw_payload as Record<string, unknown> | null) || {};
    const prevAttempts = Number(rp["piperun_retry_attempts"] ?? 0);
    const newAttempts = prevAttempts + 1;
    try {
      console.log(`[retry-failed] → lead=${lead.id} email=${lead.email} attempt=${newAttempts}/${MAX_ATTEMPTS}`);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-lia-assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ lead_id: lead.id, force: true, trigger: "auto_retry_failed_piperun" }),
      });
      const json = await res.json().catch(() => ({}));
      const ok = !!json.piperun_id;
      const errMsg = ok ? null : (json.error || json.reason || `lia-assign returned no piperun_id (status ${res.status})`);

      // Update retry state with backoff-aware fields. Never set the legacy
      // `piperun_retry_attempted_at` flag (would burn the lead forever).
      const newPayload: Record<string, unknown> = {
        ...rp,
        piperun_retry_last_attempt_at: new Date().toISOString(),
      };
      // Drop legacy field if present (migration handles bulk; this catches stragglers).
      delete (newPayload as Record<string, unknown>)["piperun_retry_attempted_at"];
      if (ok) {
        newPayload.piperun_retry_succeeded_at = new Date().toISOString();
        newPayload.piperun_retry_attempts = 0;
        delete (newPayload as Record<string, unknown>)["piperun_retry_last_error"];
      } else {
        newPayload.piperun_retry_attempts = newAttempts;
        newPayload.piperun_retry_last_error = String(errMsg).slice(0, 500);
      }
      await supabase.from("lia_attendances").update({ raw_payload: newPayload }).eq("id", lead.id);

      // On success, fire seller summary note (fire-and-forget)
      if (ok) {
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
      } else {
        // Per-lead failure log so the cause is auditable.
        try {
          await supabase.from("system_health_logs").insert({
            function_name: "smart-ops-piperun-retry-failed-leads",
            severity: newAttempts >= MAX_ATTEMPTS ? "error" : "warning",
            error_type: newAttempts >= MAX_ATTEMPTS ? "piperun_assign_exhausted" : "piperun_retry_failed",
            lead_email: lead.email,
            details: { lead_id: lead.id, attempts: newAttempts, max_attempts: MAX_ATTEMPTS, error: errMsg, lia_assign_response: json },
          });
        } catch (logErr) {
          console.warn("[retry-failed] health log insert failed:", logErr);
        }
      }

      console.log(`[retry-failed] ← lead=${lead.id} ok=${ok} piperun_id=${json.piperun_id || "-"} attempts=${ok ? 0 : newAttempts}`);
      results.push({ lead_id: lead.id, email: lead.email, ok, attempts: ok ? 0 : newAttempts, piperun_id: json.piperun_id || null, error: errMsg || undefined });
    } catch (e) {
      const errMsg = String(e);
      console.error(`[retry-failed] ✖ lead=${lead.id} threw:`, errMsg);
      // Even on throw, increment attempts so backoff applies.
      try {
        const newPayload: Record<string, unknown> = {
          ...rp,
          piperun_retry_last_attempt_at: new Date().toISOString(),
          piperun_retry_attempts: newAttempts,
          piperun_retry_last_error: errMsg.slice(0, 500),
        };
        delete (newPayload as Record<string, unknown>)["piperun_retry_attempted_at"];
        await supabase.from("lia_attendances").update({ raw_payload: newPayload }).eq("id", lead.id);
        await supabase.from("system_health_logs").insert({
          function_name: "smart-ops-piperun-retry-failed-leads",
          severity: newAttempts >= MAX_ATTEMPTS ? "error" : "warning",
          error_type: newAttempts >= MAX_ATTEMPTS ? "piperun_assign_exhausted" : "piperun_retry_threw",
          lead_email: lead.email,
          details: { lead_id: lead.id, attempts: newAttempts, error: errMsg },
        });
      } catch {}
      results.push({ lead_id: lead.id, email: lead.email, ok: false, attempts: newAttempts, error: errMsg });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log(`[retry-failed] Sweep done: ${results.length} processed, ${okCount} succeeded, ${results.length - okCount} failed`);

  return new Response(
    JSON.stringify({ checked: candidates.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});