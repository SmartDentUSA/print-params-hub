/**
 * crm-timeline-reconciler
 * ----------------------------------------------------------------------------
 * Completa na timeline (`lead_activity_log`) os eventos que o webhook do PipeRun
 * pode ter perdido: `crm_proposal`, `crm_deal_snapshot` e `crm_activity`.
 *
 * Fonte: espelho local `public.deals` (deals alterados na janela) + GET /deals/{id}
 * completo via `hydrateDealPayload` (API do PipeRun = estado atual).
 *
 * REGRAS:
 *  - Somente leads canônicos (`merged_into IS NULL`).
 *  - event_timestamp = data real do CRM (nunca now()).
 *  - NUNCA altera deals, funis, CS ou Vendas — apenas escreve timeline.
 *
 * Body (opcional):
 *   { since_minutes?: number, from?: ISO, to?: ISO, limit?: number, dry_run?: boolean }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hydrateDealPayload } from "../_shared/piperun-deal-hydrate.ts";
import { normalizePiperunActivities } from "../_shared/piperun-activity-normalizer.ts";
import {
  buildProposalEvents,
  buildStageSnapshotEvent,
  insertTimelineEvents,
  recordUnresolved,
  type DealContext,
  type TimelineRow,
} from "../_shared/crm-timeline-events.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const apiToken = Deno.env.get("PIPERUN_API_KEY") || Deno.env.get("PIPERUN_API_TOKEN") || "";
  if (!apiToken) return json({ ok: false, error: "PIPERUN_API_KEY ausente" }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* GET/cron sem body */ }

  const sinceMinutes = Number(body.since_minutes ?? 45);
  const limit = Math.min(Number(body.limit ?? 120), 400);
  const dryRun = body.dry_run === true;
  const fromIso = typeof body.from === "string"
    ? new Date(body.from).toISOString()
    : new Date(Date.now() - sinceMinutes * 60_000).toISOString();
  const toIso = typeof body.to === "string" ? new Date(body.to).toISOString() : null;

  try {
    // ─── Deals candidatos: espelho local alterado na janela ───
    let q = supabase
      .from("deals")
      .select("piperun_deal_id, lead_id, updated_at")
      .not("lead_id", "is", null)
      .not("piperun_deal_id", "is", null)
      .gte("updated_at", fromIso)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (toIso) q = q.lte("updated_at", toIso);
    const { data: candidates, error: candErr } = await q;
    if (candErr) return json({ ok: false, error: candErr.message }, 500);

    const list = (candidates || []) as Array<{ piperun_deal_id: number; lead_id: string }>;
    if (list.length === 0) {
      return json({ ok: true, window: { from: fromIso, to: toIso }, deals: 0, inserted: 0 });
    }

    // Confirma que os leads são canônicos
    const leadIds = [...new Set(list.map((d) => d.lead_id))];
    const canonical = new Set<string>();
    for (let i = 0; i < leadIds.length; i += 200) {
      const { data } = await supabase
        .from("lia_attendances")
        .select("id")
        .is("merged_into", null)
        .in("id", leadIds.slice(i, i + 200));
      for (const l of data || []) canonical.add(l.id as string);
    }

    const rows: TimelineRow[] = [];
    const unresolved: Parameters<typeof recordUnresolved>[1] = [];
    let hydrated = 0;
    let skippedNonCanonical = 0;

    for (const cand of list) {
      if (!canonical.has(cand.lead_id)) {
        skippedNonCanonical++;
        unresolved.push({
          source: "reconciler",
          kind: "deal",
          entity_id: String(cand.piperun_deal_id),
          deal_id: Number(cand.piperun_deal_id),
          payload: { reason: "lead_not_canonical", lead_id: cand.lead_id },
        });
        continue;
      }

      const res = await hydrateDealPayload(apiToken, String(cand.piperun_deal_id), {});
      if (!res.hydrated) {
        unresolved.push({
          source: "reconciler",
          kind: "deal",
          entity_id: String(cand.piperun_deal_id),
          deal_id: Number(cand.piperun_deal_id),
          payload: { reason: res.error ?? "hydrate_failed" },
        });
        continue;
      }
      hydrated++;
      const deal = res.deal;

      const ctx: DealContext = {
        dealId: cand.piperun_deal_id,
        pipelineName: (deal.pipeline as Record<string, unknown> | undefined)?.name as string ?? null,
        stageName: (deal.stage as Record<string, unknown> | undefined)?.name as string ?? null,
        stageId: (deal.stage_id ?? (deal.stage as Record<string, unknown> | undefined)?.id) as number ?? null,
        status: deal.status != null ? String(deal.status) : null,
        ownerName: (deal.owner as Record<string, unknown> | undefined)?.name as string ?? null,
        originName: ((deal.origin as Record<string, unknown> | undefined)?.name ?? deal.origin_name) as string ?? null,
        value: deal.value != null ? Number(deal.value) : null,
        createdAt: (deal.created_at as string) ?? null,
        closedAt: (deal.closed_at as string) ?? null,
        lossReason: ((deal.lost_reason ?? deal.loss_reason) as Record<string, unknown> | string | null) as string ?? null,
      };

      rows.push(...buildProposalEvents(cand.lead_id, ctx, deal.proposals));
      const stageRow = buildStageSnapshotEvent(
        cand.lead_id,
        ctx,
        deal.last_stage_updated_at ?? deal.stage_updated_at ?? deal.created_at,
      );
      if (stageRow) rows.push(stageRow);
      rows.push(...normalizePiperunActivities(cand.lead_id, deal.activities) as unknown as TimelineRow[]);
    }

    if (dryRun) {
      return json({
        ok: true, dry_run: true, window: { from: fromIso, to: toIso },
        deals: list.length, hydrated, would_insert: rows.length,
        unresolved: unresolved.length, skipped_non_canonical: skippedNonCanonical,
      });
    }

    const ins = await insertTimelineEvents(supabase, rows);
    if (unresolved.length > 0) await recordUnresolved(supabase, unresolved);

    const summary = {
      ok: true,
      window: { from: fromIso, to: toIso },
      deals: list.length,
      hydrated,
      candidates_rows: rows.length,
      inserted: ins.inserted,
      duplicates: ins.duplicates,
      unresolved: unresolved.length,
      skipped_non_canonical: skippedNonCanonical,
      error: ins.error ?? null,
    };

    await supabase.from("system_health_logs").insert({
      function_name: "crm-timeline-reconciler",
      severity: ins.error ? "warning" : "info",
      error_type: ins.error ? "insert_error" : "run_summary",
      details: summary,
    }).then(() => {}, () => {});

    return json(summary);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
