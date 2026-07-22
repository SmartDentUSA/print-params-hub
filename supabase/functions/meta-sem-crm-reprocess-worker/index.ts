// Worker for meta_sem_crm_reprocess_queue.
// Runs every 30 minutes via pg_cron. Processes up to 10 rows per invocation
// (only rows whose scheduled_at <= now()).
//
// Absolute guardrail: NEVER touches deals in the Vendas (18784) or CS
// (83896/102893/104500) pipelines. If the lead has any deal in those
// pipelines, the row is marked `skipped_protected_pipeline` and left alone.
//
// Otherwise (lead absent from CRM, or only in Estagnados 72938), the row
// is forwarded to smart-ops-ingest-lead with source `meta_lead_ads`, which
// applies the standard reactivation hatch (close Estagnados as Lost →
// open new Deal in Vendas + assign via round-robin).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROTECTED_PIPELINES = new Set<number>([18784, 83896, 102893, 104500]);
const BATCH_SIZE = 10;
const FN = "meta-sem-crm-reprocess-worker";

function phoneDigits(s: string | null): string {
  return String(s || "").replace(/\D/g, "");
}

async function log(supabase: any, severity: string, error_type: string, details: Record<string, unknown>) {
  try {
    await supabase.from("system_health_logs").insert({
      function_name: FN, severity, error_type,
      details: { ...details, ts: new Date().toISOString() },
    });
  } catch (_) {}
}

async function findCanonical(supabase: any, email: string | null, phone: string | null) {
  if (email) {
    const { data } = await supabase
      .from("lia_attendances")
      .select("id, piperun_id, pessoa_piperun_id")
      .eq("email", email).is("merged_into", null).maybeSingle();
    if (data) return data;
  }
  const digits = phoneDigits(phone);
  if (digits.length >= 8) {
    const suffix = digits.slice(-11);
    const { data } = await supabase
      .from("lia_attendances")
      .select("id, piperun_id, pessoa_piperun_id")
      .is("merged_into", null)
      .ilike("telefone_normalized", `%${suffix}`)
      .order("created_at", { ascending: true })
      .limit(1).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function protectedDeal(supabase: any, leadId: string): Promise<number | null> {
  const { data } = await supabase
    .from("deals").select("pipeline_id").eq("lead_id", leadId);
  for (const d of (data || []) as Array<{ pipeline_id: number | null }>) {
    if (d.pipeline_id && PROTECTED_PIPELINES.has(Number(d.pipeline_id))) return Number(d.pipeline_id);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const batchSize = Math.max(1, Math.min(50, Number((body as any).batch_size ?? BATCH_SIZE)));

  // Atomically claim up to N pending rows.
  const { data: claimed, error: claimErr } = await supabase.rpc("meta_sem_crm_claim_batch", { p_batch: batchSize });
  let rows: any[] = [];
  if (!claimErr && Array.isArray(claimed)) {
    rows = claimed;
  } else {
    // Fallback: SELECT then UPDATE (no atomic claim). Safe because cron runs
    // every 30 min so there is no concurrent invocation.
    const { data: pend } = await supabase
      .from("meta_sem_crm_reprocess_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(batchSize);
    rows = pend || [];
    if (rows.length > 0) {
      await supabase.from("meta_sem_crm_reprocess_queue")
        .update({ status: "processing", processed_at: new Date().toISOString() })
        .in("id", rows.map((r) => r.id));
    }
  }

  const results: any[] = [];
  for (const row of rows) {
    try {
      const canon = await findCanonical(supabase, row.email, row.telefone_normalized || row.telefone_raw);
      let pipeline_before: number | null = null;
      if (canon?.id) {
        pipeline_before = await protectedDeal(supabase, canon.id);
        if (pipeline_before) {
          await supabase.from("meta_sem_crm_reprocess_queue").update({
            status: "skipped_protected_pipeline",
            canonical_id_before: canon.id,
            canonical_pipeline_before: pipeline_before,
            skip_reason: `deal existente em pipeline ${pipeline_before} (Vendas/CS) — não tocar`,
            processed_at: new Date().toISOString(),
          }).eq("id", row.id);
          results.push({ csv_row: row.csv_row, status: "skipped_protected_pipeline", pipeline_before });
          continue;
        }
      }

      // Forward to smart-ops-ingest-lead. source `meta_lead_ads` triggers
      // the Estagnados → Vendas hatch (close Lost + open new Vendas deal).
      const syntheticLeadgenId = `reprocess_${row.csv_row}_${Date.now()}`;
      const ingestRes = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-ingest-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE}` },
        body: JSON.stringify({
          source: "meta_lead_ads",
          form_name: row.form_name,
          origem_campanha: row.form_name,
          utm_source: "facebook",
          utm_medium: "paid",
          utm_campaign: row.form_name,
          form_purpose: "sdr_captacao",
          name: row.nome,
          email: row.email,
          phone: row.telefone_normalized || row.telefone_raw,
          produto_interesse: row.produto_interesse,
          meta_created_time: row.created_time,
          platform_lead_id: syntheticLeadgenId,
          leadgen_id: syntheticLeadgenId,
          platform_form_id: row.form_name,
          new_conversion_confirmed: true,
          force_reactivation: true,
          _reprocess_reason: "meta_sem_crm_queue",
        }),
      });
      const okBody = await ingestRes.text().catch(() => "");
      if (!ingestRes.ok) {
        await supabase.from("meta_sem_crm_reprocess_queue").update({
          status: "failed",
          attempts: (row.attempts || 0) + 1,
          last_error: `ingest ${ingestRes.status}: ${okBody.slice(0, 300)}`,
          processed_at: new Date().toISOString(),
        }).eq("id", row.id);
        results.push({ csv_row: row.csv_row, status: "failed", http: ingestRes.status });
        continue;
      }

      // Try to capture the Vendas deal id created.
      let deal_vendas_id: number | null = null;
      try {
        const parsed = JSON.parse(okBody);
        if (parsed?.piperun_deal_id) deal_vendas_id = Number(parsed.piperun_deal_id);
      } catch (_) {}

      await supabase.from("meta_sem_crm_reprocess_queue").update({
        status: "done",
        attempts: (row.attempts || 0) + 1,
        canonical_id_before: canon?.id || null,
        deal_vendas_id_after: deal_vendas_id,
        processed_at: new Date().toISOString(),
      }).eq("id", row.id);
      results.push({ csv_row: row.csv_row, status: "done", deal_vendas_id });

      // gentle pacing
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      await supabase.from("meta_sem_crm_reprocess_queue").update({
        status: "failed",
        attempts: (row.attempts || 0) + 1,
        last_error: String(e).slice(0, 500),
        processed_at: new Date().toISOString(),
      }).eq("id", row.id);
      results.push({ csv_row: row.csv_row, status: "exception", error: String(e) });
    }
  }

  await log(supabase, "info", "worker_batch_completed", {
    batch_claimed: rows.length,
    done: results.filter((r) => r.status === "done").length,
    skipped: results.filter((r) => r.status === "skipped_protected_pipeline").length,
    failed: results.filter((r) => r.status === "failed" || r.status === "exception").length,
  });

  return new Response(JSON.stringify({
    claimed: rows.length,
    results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});