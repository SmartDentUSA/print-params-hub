import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPrimarySnapshot } from "../_shared/piperun-primary-deal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * One-shot backfill: realigns row-level CRM snapshot fields on every canonical
 * lead with multiple deals so they reflect the currently-relevant deal
 * (open > newest closed > newest created). Idempotent: only writes when a
 * snapshot field actually changes.
 *
 * Body: { limit?: number, offset?: number, dry_run?: boolean }
 * Defaults: limit=200, offset=0, dry_run=false
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { limit?: number; offset?: number; dry_run?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body OK */ }
  const limit = Math.min(Math.max(Number(body.limit ?? 200), 1), 500);
  const offset = Math.max(Number(body.offset ?? 0), 0);
  const dryRun = !!body.dry_run;

  const { data: leads, error } = await supabase
    .from("lia_attendances")
    .select(
      "id,piperun_id,proprietario_lead_crm,status_atual_lead_crm,funil_entrada_crm,status_oportunidade,valor_oportunidade,data_fechamento_crm,piperun_pipeline_id,piperun_pipeline_name,piperun_stage_id,piperun_stage_name,piperun_owner_id,piperun_owner_email,piperun_deals_history",
    )
    .is("merged_into", null)
    .not("piperun_deals_history", "is", null)
    .order("id")
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let scanned = 0, changed = 0, skipped = 0;
  const samples: Array<Record<string, unknown>> = [];

  for (const lead of leads ?? []) {
    scanned++;
    const history = (lead as any).piperun_deals_history as unknown[] | null;
    if (!Array.isArray(history) || history.length < 2) { skipped++; continue; }
    const snap = buildPrimarySnapshot(history);
    if (!snap) { skipped++; continue; }

    const diff: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(snap)) {
      if (v === null || v === undefined) continue;
      if ((lead as any)[k] !== v) diff[k] = v;
    }
    if (Object.keys(diff).length === 0) { skipped++; continue; }

    if (samples.length < 10) {
      samples.push({ id: (lead as any).id, before: { piperun_id: (lead as any).piperun_id, owner: (lead as any).proprietario_lead_crm, stage: (lead as any).status_atual_lead_crm }, after: diff });
    }

    if (!dryRun) {
      const { error: upErr } = await supabase
        .from("lia_attendances")
        .update(diff)
        .eq("id", (lead as any).id);
      if (upErr) { console.error("[backfill] update", (lead as any).id, upErr.message); continue; }
      await supabase.from("lead_enrichment_audit").insert({
        lead_id: (lead as any).id,
        source: "backfill_primary_deal",
        source_priority: 2,
        fields_updated: Object.keys(diff),
        new_values: diff,
        timestamp: new Date().toISOString(),
      }).then(() => {}, () => {});
    }
    changed++;
  }

  return new Response(JSON.stringify({
    scanned, changed, skipped, next_offset: offset + (leads?.length ?? 0),
    has_more: (leads?.length ?? 0) === limit, dry_run: dryRun, samples,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});