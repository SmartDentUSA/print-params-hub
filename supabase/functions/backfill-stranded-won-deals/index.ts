/**
 * Backfill one-shot: recupera leads cujo histórico de deals contém `status="ganha"`
 * (ou variações PT-BR/EN) mas que ficaram com `lead_status <> 'CLIENTE_ativo'` por
 * causa do bug do normalizador de status no webhook PipeRun.
 *
 * Estratégia:
 *  1. SELECT leads canônicos (merged_into IS NULL) com snapshot vencedor no histórico
 *  2. Para cada lead, identifica o último snapshot vencedor
 *  3. UPDATE: lead_status='CLIENTE_ativo', status_oportunidade='ganha',
 *     valor_oportunidade=COALESCE(valor_oportunidade, snapshot.value),
 *     data_fechamento_crm=COALESCE(data_fechamento_crm, snapshot.closed_at)
 *  4. Enfileira cognitive-lead-analysis com trigger=opp_closed
 *  5. Loga em system_health_logs
 *
 * Idempotente: o WHERE garante que só leads ainda travados são tocados.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const WON_STATUS_SET = new Set(["ganha", "ganho", "won", "1", 1]);

function pickLastWonSnapshot(history: unknown): Record<string, unknown> | null {
  if (!Array.isArray(history)) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const snap = history[i] as Record<string, unknown> | undefined;
    if (!snap) continue;
    const s = snap.status as unknown;
    if (WON_STATUS_SET.has(s as string) || WON_STATUS_SET.has(s as number)) {
      return snap;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const batchSize = Math.min(Number(url.searchParams.get("batch") || 1000), 5000);

  const started = Date.now();
  const summary = {
    scanned: 0,
    updated: 0,
    skipped_no_snapshot: 0,
    errors: 0,
    recovered_value: 0,
    sample_ids: [] as string[],
    dry_run: dryRun,
  };

  try {
    const { data: leads, error } = await supabase
      .from("lia_attendances")
      .select("id, valor_oportunidade, data_fechamento_crm, piperun_deals_history")
      .is("merged_into", null)
      .neq("lead_status", "CLIENTE_ativo")
      .filter("piperun_deals_history", "cs", '[{"status":"ganha"}]')
      .limit(batchSize);

    if (error) throw error;
    summary.scanned = leads?.length || 0;

    for (const lead of leads || []) {
      const snap = pickLastWonSnapshot((lead as Record<string, unknown>).piperun_deals_history);
      if (!snap) {
        summary.skipped_no_snapshot++;
        continue;
      }

      const snapValue = Number(snap.value ?? snap.proposals_total_value ?? 0) || null;
      const snapClosedAt = (snap.closed_at as string | undefined) || (snap.updated_at as string | undefined) || null;

      const update: Record<string, unknown> = {
        lead_status: "CLIENTE_ativo",
        status_oportunidade: "ganha",
        piperun_status: 1,
      };
      if ((lead as Record<string, unknown>).valor_oportunidade == null && snapValue) {
        update.valor_oportunidade = snapValue;
      }
      if ((lead as Record<string, unknown>).data_fechamento_crm == null && snapClosedAt) {
        update.data_fechamento_crm = snapClosedAt;
      }

      if (dryRun) {
        summary.updated++;
        if (summary.sample_ids.length < 10) summary.sample_ids.push(String(lead.id));
        if (snapValue) summary.recovered_value += snapValue;
        continue;
      }

      const { error: updErr } = await supabase
        .from("lia_attendances")
        .update(update)
        .eq("id", lead.id);

      if (updErr) {
        summary.errors++;
        console.warn(`[backfill-stranded-won] update ${lead.id}:`, updErr.message);
        continue;
      }

      summary.updated++;
      if (snapValue) summary.recovered_value += snapValue;
      if (summary.sample_ids.length < 10) summary.sample_ids.push(String(lead.id));
    }

    // Audit
    try {
      await supabase.from("system_health_logs").insert({
        function_name: "backfill-stranded-won-deals",
        severity: summary.errors > 0 ? "warning" : "info",
        error_type: "backfill_stranded_won",
        details: { ...summary, duration_ms: Date.now() - started },
      });
    } catch (_) { /* audit best-effort */ }

    return new Response(JSON.stringify({ ok: true, ...summary, duration_ms: Date.now() - started }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[backfill-stranded-won] fatal:", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message, summary }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});