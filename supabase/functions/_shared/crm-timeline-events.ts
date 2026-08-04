/**
 * Emissor único de eventos de timeline vindos do CRM (PipeRun).
 * ------------------------------------------------------------
 * Usado por:
 *  - smart-ops-piperun-webhook (tempo real)
 *  - crm-timeline-reconciler   (cron 30min / backfill por API)
 *  - crm-xlsx-timeline-ingest  (planilhas)
 *
 * REGRAS:
 *  - event_timestamp SEMPRE a data real do evento no CRM (nunca now()).
 *  - dedupe por `event_data.dedupe_key` (índice único uq_lal_dedupe).
 *  - NUNCA altera deals/funis: apenas escreve eventos de leitura.
 */

type Sb = { from: (t: string) => any };

const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 && s.toLowerCase() !== "nan" ? s : null;
};

const numOf = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const isoOf = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + (s.length <= 10 ? "T12:00:00Z" : "Z"));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export interface DealContext {
  dealId: string | number | null;
  pipelineName?: string | null;
  stageName?: string | null;
  stageId?: number | string | null;
  status?: string | null;
  ownerName?: string | null;
  originName?: string | null;
  value?: number | null;
  createdAt?: string | null;
  closedAt?: string | null;
  lossReason?: string | null;
}

export interface TimelineRow {
  lead_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  event_timestamp: string;
  source_channel: string;
  value_numeric?: number | null;
  event_data: Record<string, unknown>;
}

/** Constrói eventos `crm_proposal` a partir do array bruto `deal.proposals`. */
export function buildProposalEvents(
  leadId: string,
  ctx: DealContext,
  rawProposals: unknown,
): TimelineRow[] {
  if (!Array.isArray(rawProposals) || rawProposals.length === 0) return [];
  const rows: TimelineRow[] = [];
  const seen = new Set<string>();

  for (const raw of rawProposals) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const pid = str(p.id) || str(p.proposal_id) || str(p.hash) || str(p.sigla);
    if (!pid || seen.has(pid)) continue;

    // Data real da proposta no CRM (nunca now()).
    const ts = isoOf(p.created_at) || isoOf(p.sent_at) || isoOf(p.date) ||
      isoOf(p.updated_at) || isoOf(ctx.createdAt);
    if (!ts) continue;
    seen.add(pid);

    const items = Array.isArray(p.items) ? (p.items as Record<string, unknown>[]) : [];
    const total = numOf(p.value) ?? numOf(p.total) ?? numOf(p.valor_ps) ??
      (items.length > 0
        ? items.reduce((s, it) => s + (numOf(it.total) ?? (numOf(it.price) ?? 0) * (numOf(it.quantity) ?? numOf(it.qtd) ?? 1)), 0)
        : null);

    rows.push({
      lead_id: leadId,
      event_type: "crm_proposal",
      entity_type: "piperun_proposal",
      entity_id: pid,
      entity_name: str(p.title) || str(p.sigla) || `Proposta ${pid}`,
      event_timestamp: ts,
      source_channel: "crm",
      value_numeric: total,
      event_data: {
        kind: "proposta",
        kind_label: "Proposta",
        icon: "📄",
        status: str(p.status) || str((p.status_name as unknown)) || null,
        valor: total,
        valor_frete: numOf(p.valor_frete) ?? numOf(p.freight_value),
        parcelas: numOf(p.parcelas) ?? numOf(p.installments),
        vendedor: str(p.vendedor) || str((p.user as Record<string, unknown> | undefined)?.name) || ctx.ownerName || null,
        versao: numOf(p.version) ?? numOf(p.versao),
        link: str(p.link) || str(p.url),
        deal_id: ctx.dealId != null ? Number(ctx.dealId) : null,
        funil: ctx.pipelineName ?? null,
        etapa: ctx.stageName ?? null,
        items: items.slice(0, 40),
        fonte: "piperun",
        dedupe_key: `proposal:${pid}`,
      },
    });
  }
  return rows;
}

/**
 * Constrói o evento `crm_deal_snapshot` (funil/etapa/origem/valor) com a data
 * real de entrada na etapa. Dedupe por deal + etapa + timestamp.
 */
export function buildStageSnapshotEvent(
  leadId: string,
  ctx: DealContext,
  stageEnteredAt: unknown,
): TimelineRow | null {
  const dealId = ctx.dealId != null ? String(ctx.dealId) : null;
  if (!dealId) return null;
  const ts = isoOf(stageEnteredAt) || isoOf(ctx.createdAt);
  if (!ts) return null;
  const stageKey = str(ctx.stageId) ?? str(ctx.stageName) ?? "";

  return {
    lead_id: leadId,
    event_type: "crm_deal_snapshot",
    entity_type: "deal",
    entity_id: dealId,
    entity_name: ctx.pipelineName ?? ctx.stageName ?? null,
    event_timestamp: ts,
    source_channel: "crm",
    value_numeric: ctx.value ?? null,
    event_data: {
      kind: "oportunidade",
      kind_label: "Oportunidade",
      icon: "📈",
      funil: ctx.pipelineName ?? null,
      etapa: ctx.stageName ?? null,
      stage_id: ctx.stageId ?? null,
      status: ctx.status ?? null,
      origem: ctx.originName ?? null,
      owner: ctx.ownerName ?? null,
      valor: ctx.value ?? null,
      loss_reason: ctx.lossReason ?? null,
      data_fechamento: isoOf(ctx.closedAt),
      stage_entered_at: ts,
      fonte: "piperun",
      dedupe_key: `deal_snapshot:${dealId}:${stageKey}:${ts}`,
    },
  };
}

/**
 * Insere eventos ignorando duplicados (índice único uq_lal_dedupe).
 * Em caso de conflito no lote, refaz linha por linha.
 */
export async function insertTimelineEvents(
  supabase: Sb,
  rows: TimelineRow[],
): Promise<{ inserted: number; duplicates: number; error?: string }> {
  if (rows.length === 0) return { inserted: 0, duplicates: 0 };
  let inserted = 0;
  let duplicates = 0;
  let firstError: string | undefined;

  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase.from("lead_activity_log").insert(chunk);
    if (!error) { inserted += chunk.length; continue; }
    // Conflito de dedupe (23505) ou erro pontual → tenta linha a linha
    for (const row of chunk) {
      const { error: e2 } = await supabase.from("lead_activity_log").insert(row);
      if (!e2) inserted++;
      else if (String(e2.code) === "23505" || /duplicate key/i.test(e2.message ?? "")) duplicates++;
      else if (!firstError) firstError = e2.message;
    }
  }
  return { inserted, duplicates, error: firstError };
}

/** Registra um evento cujo lead não foi resolvido, para reprocesso posterior. */
export async function recordUnresolved(
  supabase: Sb,
  entries: Array<{
    source: string;
    kind: string;
    entity_id: string | null;
    deal_id?: number | null;
    person_piperun_id?: number | null;
    email?: string | null;
    event_timestamp?: string | null;
    payload: Record<string, unknown>;
  }>,
): Promise<{ recorded: number; error?: string }> {
  if (entries.length === 0) return { recorded: 0 };
  const rows = entries.map((e) => ({
    source: e.source,
    kind: e.kind,
    entity_id: e.entity_id,
    deal_id: e.deal_id ?? null,
    person_piperun_id: e.person_piperun_id ?? null,
    email: e.email ? e.email.toLowerCase() : null,
    event_timestamp: e.event_timestamp ?? null,
    payload: e.payload,
  }));
  const { error } = await supabase
    .from("crm_timeline_unresolved")
    .upsert(rows, { onConflict: "kind,entity_id", ignoreDuplicates: false });
  if (error) return { recorded: 0, error: error.message };
  return { recorded: rows.length };
}
