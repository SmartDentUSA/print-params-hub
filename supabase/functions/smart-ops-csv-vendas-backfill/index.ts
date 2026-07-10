// One-off backfill: for each email in `_csv_leads_check`, resolve to the
// canonical `lia_attendances` row (following `merged_into` chain). SKIP any
// canonical that already has a deal in Funil de Vendas (18784) or CS
// pipelines (83896, 102893). For the rest, invoke `smart-ops-lia-assign`
// with `commercial_override: true` + `force_new_deal: true` so a fresh
// Deal is opened in Vendas without touching leads that already have
// active commercial/success cycles.
//
// Query params:
//   ?dry_run=1 → only reports what would be done, no invocation
//   ?limit=N   → cap eligible leads processed this run (default 500)
//   ?concurrency=N → parallelism (default 3)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VENDAS = 18784;
const CS_PIPELINES = [83896, 102893];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const limit = Math.max(1, Math.min(2000, Number(url.searchParams.get("limit") || "500")));
  const concurrency = Math.max(1, Math.min(6, Number(url.searchParams.get("concurrency") || "3")));
  const fireAndForget = url.searchParams.get("async") === "1";

  const startedAt = Date.now();

  // 1. Load all CSV emails
  const { data: csvRows, error: csvErr } = await supabase
    .from("_csv_leads_check")
    .select("email")
    .not("email", "is", null);
  if (csvErr) {
    return new Response(JSON.stringify({ error: csvErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const emails = Array.from(new Set((csvRows ?? []).map((r) => String(r.email).trim().toLowerCase()).filter(Boolean)));

  // 2. Fetch every lia_attendances row that matches those emails (canonical + secondary)
  const leadsByEmail = new Map<string, Array<{ id: string; piperun_id: string | null; merged_into: string | null }>>();
  for (let i = 0; i < emails.length; i += 200) {
    const slice = emails.slice(i, i + 200);
    const { data, error } = await supabase
      .from("lia_attendances")
      .select("id, email, piperun_id, merged_into")
      .in("email", slice);
    if (error) continue;
    for (const row of data ?? []) {
      const key = String(row.email ?? "").toLowerCase();
      if (!leadsByEmail.has(key)) leadsByEmail.set(key, []);
      leadsByEmail.get(key)!.push({ id: row.id, piperun_id: row.piperun_id ?? null, merged_into: row.merged_into ?? null });
    }
  }

  // 3. Resolve canonical: follow merged_into chain (max 5 hops)
  const canonicalCache = new Map<string, { id: string; piperun_id: string | null }>();
  const resolveCanonical = async (leadId: string): Promise<{ id: string; piperun_id: string | null } | null> => {
    if (canonicalCache.has(leadId)) return canonicalCache.get(leadId)!;
    let currentId = leadId;
    for (let hops = 0; hops < 5; hops++) {
      const { data } = await supabase
        .from("lia_attendances")
        .select("id, piperun_id, merged_into")
        .eq("id", currentId)
        .maybeSingle();
      if (!data) return null;
      if (!data.merged_into) {
        const val = { id: data.id, piperun_id: data.piperun_id ?? null };
        canonicalCache.set(leadId, val);
        return val;
      }
      currentId = data.merged_into;
    }
    return null;
  };

  const skipped: Array<{ email: string; reason: string; canonical_id?: string }> = [];
  const truly_missing: string[] = [];
  const eligible: Array<{ email: string; lead_id: string }> = [];

  for (const email of emails) {
    const rows = leadsByEmail.get(email) ?? [];
    if (rows.length === 0) {
      truly_missing.push(email);
      continue;
    }
    // Pick canonical (merged_into IS NULL) preferentially; otherwise resolve chain from first
    let canonical = rows.find((r) => r.merged_into == null);
    let canonicalResolved: { id: string; piperun_id: string | null } | null = null;
    if (canonical) {
      canonicalResolved = { id: canonical.id, piperun_id: canonical.piperun_id };
    } else {
      canonicalResolved = await resolveCanonical(rows[0].id);
    }
    if (!canonicalResolved) {
      skipped.push({ email, reason: "canonical_unresolved" });
      continue;
    }

    // Check if canonical has any deal in Vendas or CS (any status)
    const { data: dealRows } = await supabase
      .from("deals")
      .select("pipeline_id, status, is_deleted")
      .eq("lead_id", canonicalResolved.id);
    const active = (dealRows ?? []).filter((d) => d.is_deleted !== true);
    const inVendas = active.some((d) => Number(d.pipeline_id) === VENDAS);
    const inCs = active.some((d) => CS_PIPELINES.includes(Number(d.pipeline_id)));
    if (inVendas) {
      skipped.push({ email, reason: "already_in_vendas", canonical_id: canonicalResolved.id });
      continue;
    }
    if (inCs) {
      skipped.push({ email, reason: "already_in_cs", canonical_id: canonicalResolved.id });
      continue;
    }
    eligible.push({ email, lead_id: canonicalResolved.id });
  }

  const toProcess = eligible.slice(0, limit);

  if (dryRun) {
    return new Response(JSON.stringify({
      dry_run: true,
      total_csv_emails: emails.length,
      skipped_vendas: skipped.filter((s) => s.reason === "already_in_vendas").length,
      skipped_cs: skipped.filter((s) => s.reason === "already_in_cs").length,
      truly_missing_count: truly_missing.length,
      eligible_count: eligible.length,
      would_process_now: toProcess.length,
      truly_missing_sample: truly_missing.slice(0, 20),
      eligible_sample: eligible.slice(0, 20),
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 4. Fire lia-assign for each eligible lead with commercial_override + force_new_deal.
  const invokeUrl = `${SUPABASE_URL}/functions/v1/smart-ops-lia-assign`;
  const results: Array<{ email: string; lead_id: string; status: number; ok: boolean; body?: string }> = [];

  const runOne = async (item: { email: string; lead_id: string }) => {
    try {
      const call = fetch(invokeUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: item.lead_id,
          commercial_override: true,
          force_new_deal: true,
          new_conversion_confirmed: true,
          conversion_key: `csv_vendas_backfill_${new Date().toISOString().slice(0, 10)}`,
          source: "csv_import_commercial",
          trigger: "csv_vendas_backfill",
        }),
      });
      if (fireAndForget) {
        // Do not await — schedule and move on. Best-effort catch.
        call.catch((e) => console.warn("[backfill async] fire-and-forget err:", (e as Error).message));
        results.push({ email: item.email, lead_id: item.lead_id, status: 202, ok: true, body: "queued" });
      } else {
        const res = await call;
        const bodyTxt = await res.text().catch(() => "");
        results.push({ email: item.email, lead_id: item.lead_id, status: res.status, ok: res.ok, body: bodyTxt.slice(0, 300) });
      }
    } catch (e) {
      results.push({ email: item.email, lead_id: item.lead_id, status: 0, ok: false, body: (e as Error).message });
    }
  };

  // Bounded concurrency
  const queue = [...toProcess];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      await runOne(item);
      // small breather to avoid PipeRun rate limits
      await new Promise((r) => setTimeout(r, 250));
    }
  });
  await Promise.all(workers);

  const okCount = results.filter((r) => r.ok).length;
  const errCount = results.length - okCount;

  await supabase.from("system_health_logs").insert({
    function_name: "csv_vendas_backfill",
    severity: errCount > 0 ? "warning" : "info",
    error_type: "backfill_completed",
    details: {
      total_csv_emails: emails.length,
      eligible_count: eligible.length,
      processed: results.length,
      ok: okCount,
      err: errCount,
      skipped_vendas: skipped.filter((s) => s.reason === "already_in_vendas").length,
      skipped_cs: skipped.filter((s) => s.reason === "already_in_cs").length,
      truly_missing_count: truly_missing.length,
      elapsed_ms: Date.now() - startedAt,
      sample_errors: results.filter((r) => !r.ok).slice(0, 10),
    },
  });

  return new Response(JSON.stringify({
    total_csv_emails: emails.length,
    skipped_vendas: skipped.filter((s) => s.reason === "already_in_vendas").length,
    skipped_cs: skipped.filter((s) => s.reason === "already_in_cs").length,
    truly_missing_count: truly_missing.length,
    eligible_count: eligible.length,
    processed: results.length,
    ok: okCount,
    err: errCount,
    elapsed_ms: Date.now() - startedAt,
    sample_errors: results.filter((r) => !r.ok).slice(0, 10),
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});