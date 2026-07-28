/**
 * Identity + Funnel Resolver — pure decision layer (no side effects).
 *
 * Regra de Ouro (v-final):
 *  - Telefone é identificador primário; e-mail é secundário.
 *  - Deals candidatos = deals da PESSOA ∪ deals da ORGANIZAÇÃO.
 *  - Vendas aberto        -> enrich_only (nunca cria deal novo)
 *  - CS (sem Vendas)      -> open_new_vendas_keep_cs (CS intocado)
 *  - Estagnado/perdido    -> close_estagnado_and_open_new
 *  - Nada                 -> create_all_new
 *  - >1 Vendas aberto     -> needs_human_review
 */

export type FunnelClass = "vendas_open" | "cs" | "estagnado" | "other";

export type DecisionAction =
  | "enrich_only"
  | "open_new_vendas_keep_cs"
  | "close_estagnado_and_open_new"
  | "create_all_new"
  | "needs_human_review";

export interface CandidateDeal {
  id: number;
  pipeline_id?: number | null;
  pipeline_name?: string | null;
  stage_name?: string | null;
  status?: string | number | null; // piperun: 1=aberto, 2=ganho, 3=perdido
  owner_id?: number | null;
  owner_name?: string | null;
  source: "person" | "company";
}

export interface Decision {
  action: DecisionAction;
  reason: string;
  classified: Array<CandidateDeal & { funnel: FunnelClass }>;
  deals_to_close: number[];
  deal_to_enrich: number | null;
  needs_new_seller: boolean;
  previous_owner_ids: number[];
}

const CS_PATTERNS = [/\bcs\b/i, /customer\s*success/i, /onboard/i, /p[óo]s[-\s]?venda/i];
const VENDAS_PATTERNS = [/vendas/i];

export function isLostStatus(status: unknown): boolean {
  if (status === null || status === undefined) return false;
  const s = String(status).toLowerCase();
  return s === "3" || s === "lost" || s === "perdido" || s === "perdida";
}

export function isWonStatus(status: unknown): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "2" || s === "won" || s === "ganho" || s === "ganha";
}

export function classifyDeal(deal: CandidateDeal): FunnelClass {
  const pipeline = `${deal.pipeline_name ?? ""}`;
  if (CS_PATTERNS.some((r) => r.test(pipeline))) return "cs";
  // "Estagnado" = qualquer deal com status perdido (decisão confirmada).
  if (isLostStatus(deal.status)) return "estagnado";
  if (isWonStatus(deal.status)) return "other";
  if (VENDAS_PATTERNS.some((r) => r.test(pipeline))) return "vendas_open";
  return "other";
}

/** Deduplica por id, preferindo a origem "person". */
export function dedupeDeals(deals: CandidateDeal[]): CandidateDeal[] {
  const map = new Map<number, CandidateDeal>();
  for (const d of deals) {
    const prev = map.get(d.id);
    if (!prev || (prev.source === "company" && d.source === "person")) map.set(d.id, d);
  }
  return [...map.values()];
}

export function decide(rawDeals: CandidateDeal[]): Decision {
  const classified = dedupeDeals(rawDeals).map((d) => ({ ...d, funnel: classifyDeal(d) }));
  const vendas = classified.filter((d) => d.funnel === "vendas_open");
  const cs = classified.filter((d) => d.funnel === "cs");
  const estag = classified.filter((d) => d.funnel === "estagnado");
  const ownerIds = (arr: typeof classified) =>
    [...new Set(arr.map((d) => Number(d.owner_id)).filter((n) => Number.isFinite(n) && n > 0))];

  if (vendas.length > 1) {
    return {
      action: "needs_human_review",
      reason: `${vendas.length} deals abertos em Vendas simultaneamente — duplicação intra-funil`,
      classified, deals_to_close: [], deal_to_enrich: null,
      needs_new_seller: false, previous_owner_ids: ownerIds(vendas),
    };
  }
  if (vendas.length === 1) {
    return {
      action: "enrich_only",
      reason: "Deal aberto em Vendas — apenas enriquecer/registrar sinal, não criar novo",
      classified, deals_to_close: [], deal_to_enrich: vendas[0].id,
      needs_new_seller: false, previous_owner_ids: ownerIds(vendas),
    };
  }
  if (cs.length > 0) {
    return {
      action: "open_new_vendas_keep_cs",
      reason: "Deal em CS — CS intocado, abrir novo deal em Vendas",
      classified, deals_to_close: [], deal_to_enrich: null,
      needs_new_seller: true, previous_owner_ids: ownerIds(cs),
    };
  }
  if (estag.length > 0) {
    return {
      action: "close_estagnado_and_open_new",
      reason: `${estag.length} deal(s) perdido/estagnado — fechar e abrir novo em Vendas`,
      classified, deals_to_close: estag.map((d) => d.id), deal_to_enrich: null,
      needs_new_seller: true, previous_owner_ids: ownerIds(estag),
    };
  }
  return {
    action: "create_all_new",
    reason: "Nenhum deal encontrado — criar pessoa/organização/deal",
    classified, deals_to_close: [], deal_to_enrich: null,
    needs_new_seller: true, previous_owner_ids: [],
  };
}

export interface ActiveSeller { piperun_owner_id: number; name?: string | null }

/**
 * Sorteio de vendedor entre membros ativos.
 * `excludeOwnerIds` implementa o "outro vendedor" da especificação: o dono do
 * deal de CS/Estagnado é removido do pool. Se a exclusão esvaziar o pool,
 * o sorteio volta ao pool completo (fail-open) para nunca travar a criação.
 */
export function pickActiveSeller(
  sellers: ActiveSeller[],
  excludeOwnerIds: number[] = [],
): { seller: ActiveSeller | null; pool_size: number; excluded: number[]; fell_back: boolean } {
  const valid = sellers.filter((s) => Number.isFinite(Number(s.piperun_owner_id)) && Number(s.piperun_owner_id) > 0);
  const excl = new Set(excludeOwnerIds.filter((n) => Number.isFinite(n)));
  let pool = valid.filter((s) => !excl.has(Number(s.piperun_owner_id)));
  let fellBack = false;
  if (pool.length === 0) { pool = valid; fellBack = valid.length > 0 && excl.size > 0; }
  if (pool.length === 0) return { seller: null, pool_size: 0, excluded: [...excl], fell_back: false };
  const seller = pool[Math.floor(Math.random() * pool.length)];
  return { seller, pool_size: pool.length, excluded: [...excl], fell_back: fellBack };
}
