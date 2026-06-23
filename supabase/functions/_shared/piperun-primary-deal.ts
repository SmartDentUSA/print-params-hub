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
  status_oportunidade: string | null;
  valor_oportunidade: number | null;
  data_fechamento_crm: string | null;
}

// Pipelines onde o deal canônico NÃO pode ser substituído por um deal
// novo só por ter sido criado depois (regra de ouro): VENDAS, CS Onboarding
// e Ganhos Aleatórios (CS). Hardcoded para não criar dependência circular
// com piperun-field-map.
const DEFAULT_PROTECTED_PIPELINES = new Set<number>([18784, 83896, 102893]);

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
  // Only consider deals with numeric Piperun deal_id (hash entries are legacy/garbage).
  const valid = history.filter((d) => /^\d+$/.test(String(d?.deal_id ?? "")));
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => {
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

/**
 * Variante protegida: se o lead já tem um `currentPiperunId` apontando para
 * um deal ABERTO em pipeline protegido (VENDAS / CS), esse deal permanece
 * canônico mesmo que outro deal mais novo apareça no histórico (ex.: deal
 * duplicado criado por automação externa do PipeRun). Só promove um deal
 * novo quando o canônico atual não está mais aberto ou não está mais em
 * pipeline protegido.
 */
export function pickPrimaryDealProtected(
  history: any[] | null | undefined,
  currentPiperunId: string | number | null | undefined,
  protectedPipelines: Set<number> = DEFAULT_PROTECTED_PIPELINES,
): any | null {
  if (Array.isArray(history) && currentPiperunId != null && String(currentPiperunId).trim() !== "") {
    const want = String(currentPiperunId);
    const canonical = history.find((d) => String(d?.deal_id ?? "") === want);
    if (canonical && isOpen(canonical) && protectedPipelines.has(Number(canonical.pipeline_id))) {
      return canonical;
    }
  }
  return pickPrimaryDeal(history);
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
    status_oportunidade: d.status ?? null,
    valor_oportunidade: d.value != null ? Number(d.value) : null,
    data_fechamento_crm: d.closed_at ?? null,
  };
}

export function buildPrimarySnapshotProtected(
  history: any[] | null | undefined,
  currentPiperunId: string | number | null | undefined,
): PrimaryDealSnapshot | null {
  const d = pickPrimaryDealProtected(history, currentPiperunId);
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

/**
 * Versão protegida do applyPrimarySnapshot: preserva o deal canônico atual
 * quando ele ainda está aberto em pipeline protegido (VENDAS / CS).
 */
export function applyPrimarySnapshotProtected(
  updateData: Record<string, unknown>,
  history: any[] | null | undefined,
  currentPiperunId: string | number | null | undefined,
): Record<string, unknown> {
  const snap = buildPrimarySnapshotProtected(history, currentPiperunId);
  if (!snap) return updateData;
  for (const [k, v] of Object.entries(snap)) {
    if (v === null || v === undefined) continue;
    updateData[k] = v;
  }
  return updateData;
}