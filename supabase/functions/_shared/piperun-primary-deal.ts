/**
 * Primary Deal Selector
 *
 * Single source of truth for which deal in `piperun_deals_history`
 * should populate the row-level CRM snapshot fields of `lia_attendances`.
 *
 * Policy (in order):
 *   1) Most recent OPEN deal (status='aberta'), by created_at desc
 *   2) Else most recent by closed_at desc
 *   3) Else most recent by created_at desc
 *   4) Tie-break: highest deal_id
 *
 * Used by:
 *   - smart-ops-piperun-webhook
 *   - smart-ops-sync-piperun
 *   - piperun-full-sync
 *   - backfill-primary-deal
 */

// deno-lint-ignore-file no-explicit-any

export interface PrimaryDealSnapshot {
  piperun_id: string | null;
  proprietario_lead_crm: string | null;
  status_atual_lead_crm: string | null;
  funil_entrada_crm: string | null;
  piperun_pipeline_id: number | null;
  piperun_pipeline_name: string | null;
  piperun_stage_id: number | null;
  piperun_stage_name: string | null;
  piperun_owner_id: number | null;
  piperun_owner_email: string | null;
  status_oportunidade: string | null;
  valor_oportunidade: number | null;
  data_fechamento_crm: string | null;
}

function parseTs(v: unknown): number {
  if (!v) return 0;
  const t = Date.parse(String(v).replace(" ", "T"));
  return Number.isFinite(t) ? t : 0;
}

function isOpen(d: any): boolean {
  const s = String(d?.status ?? d?.status_oportunidade ?? "").toLowerCase();
  return s === "aberta" || s === "open" || s === "0";
}

export function pickPrimaryDeal(history: any[] | null | undefined): any | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const sorted = [...history].sort((a, b) => {
    const aOpen = isOpen(a) ? 1 : 0;
    const bOpen = isOpen(b) ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen; // open first
    if (aOpen && bOpen) {
      const t = parseTs(b.created_at) - parseTs(a.created_at);
      if (t !== 0) return t;
    } else {
      const tc = parseTs(b.closed_at) - parseTs(a.closed_at);
      if (tc !== 0) return tc;
      const tcr = parseTs(b.created_at) - parseTs(a.created_at);
      if (tcr !== 0) return tcr;
    }
    return Number(b.deal_id || 0) - Number(a.deal_id || 0);
  });
  return sorted[0];
}

export function buildPrimarySnapshot(history: any[] | null | undefined): PrimaryDealSnapshot | null {
  const d = pickPrimaryDeal(history);
  if (!d) return null;
  return {
    piperun_id: d.deal_id != null ? String(d.deal_id) : null,
    proprietario_lead_crm: d.owner_name ?? null,
    status_atual_lead_crm: d.stage_name ?? null,
    funil_entrada_crm: d.pipeline_name ?? null,
    piperun_pipeline_id: d.pipeline_id ?? null,
    piperun_pipeline_name: d.pipeline_name ?? null,
    piperun_stage_id: d.stage_id ?? null,
    piperun_stage_name: d.stage_name ?? null,
    piperun_owner_id: d.owner_id ?? null,
    piperun_owner_email: d.owner_email ?? null,
    status_oportunidade: d.status ?? null,
    valor_oportunidade: d.value != null ? Number(d.value) : null,
    data_fechamento_crm: d.closed_at ?? null,
  };
}

/**
 * Apply non-null fields of the primary snapshot onto an update payload,
 * overwriting any conflicting keys. Returns the mutated payload for chaining.
 */
export function applyPrimarySnapshot(
  updateData: Record<string, unknown>,
  history: any[] | null | undefined,
): Record<string, unknown> {
  const snap = buildPrimarySnapshot(history);
  if (!snap) return updateData;
  for (const [k, v] of Object.entries(snap)) {
    if (v === null || v === undefined) continue;
    updateData[k] = v;
  }
  return updateData;
}