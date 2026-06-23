// Backfill `pessoa_piperun_id` (and `empresa_piperun_id`) on canonical
// `lia_attendances` rows that already carry `piperun_id` (deal) but lost
// the person/company link. Idempotent, rate-limited, read-only against
// PipeRun (GET /deals/{id}) + UPDATE on `lia_attendances` only.
//
// **Respects the golden rule**: never touches deals (no PUT/POST to PipeRun
// deals/persons/companies). Only writes back the IDs we learn from GET.
//
// Auth: requires `x-admin-key` header matching ADMIN_BACKFILL_KEY secret.
// Body: { limit?: number (default 200, max 500), dry_run?: boolean }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { piperunGet } from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_KEY = Deno.env.get("ADMIN_BACKFILL_KEY") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: x-admin-key OR service-role bearer
  const adminHeader = req.headers.get("x-admin-key") || "";
  const authBearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const authorized = (ADMIN_KEY && adminHeader === ADMIN_KEY) || authBearer === SERVICE_ROLE;
  if (!authorized) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { limit?: number; dry_run?: boolean } = {};
  try { body = await req.json(); } catch {}
  const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 500);
  const dryRun = body.dry_run === true;

  // Fetch candidates: canonical leads with deal id but no person id
  const { data: candidates, error: qErr } = await supabase
    .from("lia_attendances")
    .select("id, piperun_id, pessoa_piperun_id, empresa_piperun_id, email")
    .is("merged_into", null)
    .is("pessoa_piperun_id", null)
    .not("piperun_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = {
    scanned: candidates?.length ?? 0,
    updated: 0,
    skipped_deal_missing: 0,
    skipped_no_person: 0,
    errors: 0,
    dry_run: dryRun,
    samples: [] as Array<Record<string, unknown>>,
  };

  for (const lead of candidates ?? []) {
    const dealId = String(lead.piperun_id);
    try {
      // Rate-limit: 5 req/s
      await sleep(220);
      const res = await piperunGet(PIPERUN_API_KEY, `deals/${dealId}`, {
        "with[]": ["persons", "companies"],
      });
      const data = (res?.data as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
      if (!data || data.deleted === 1 || data.deleted === true) {
        results.skipped_deal_missing++;
        continue;
      }
      const personId = Number(
        (data.person_id as number | string | undefined) ??
          ((data.person as Record<string, unknown> | undefined)?.id as number | string | undefined) ??
          0,
      );
      const companyId = Number(
        (data.company_id as number | string | undefined) ??
          ((data.company as Record<string, unknown> | undefined)?.id as number | string | undefined) ??
          0,
      );
      if (!personId) {
        results.skipped_no_person++;
        continue;
      }
      const patch: Record<string, unknown> = { pessoa_piperun_id: personId };
      if (companyId && !lead.empresa_piperun_id) patch.empresa_piperun_id = companyId;

      if (dryRun) {
        if (results.samples.length < 10) {
          results.samples.push({ lead_id: lead.id, deal_id: dealId, patch });
        }
        results.updated++;
        continue;
      }

      const { error: uErr } = await supabase
        .from("lia_attendances")
        .update(patch)
        .eq("id", lead.id)
        .is("pessoa_piperun_id", null); // idempotency guard
      if (uErr) {
        results.errors++;
        console.warn(`[backfill-pessoa] update failed lead=${lead.id}:`, uErr.message);
        continue;
      }
      try {
        await supabase.from("lead_activity_log").insert({
          lead_id: lead.id,
          event_type: "pessoa_piperun_id_backfilled",
          entity_id: dealId,
          event_data: { ...patch, source: "backfill_pessoa_piperun_id" },
        });
      } catch {}
      results.updated++;
    } catch (e) {
      results.errors++;
      console.warn(`[backfill-pessoa] error lead=${lead.id}:`, e);
    }
  }

  try {
    await supabase.from("system_health_logs").insert({
      function_name: "smart-ops-backfill-pessoa-piperun-id",
      severity: results.errors > 0 ? "warning" : "info",
      error_type: "backfill_pessoa_run",
      details: results,
    });
  } catch {}

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});