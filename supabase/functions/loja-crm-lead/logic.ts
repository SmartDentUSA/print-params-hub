// Regras puras do cadastro de leads da loja (carrinho abandonado / pedido cancelado).
export type LojaKind = "carrinho" | "cancelado";
export const ABANDON_AFTER_MS = 2 * 60 * 60 * 1000; // 2 h sem pagamento

export const LOJA_ORIGINS: Record<LojaKind, string> = {
  carrinho: "[LOJA] - Carrinho abandonado",
  cancelado: "[LOJA] - Pedido cancelado",
};

export interface LojaItem { nome: string; qty: number; preco: number; sku?: string | null }
export interface CatalogRow { name: string; product_category: string | null; product_subcategory: string | null }

export const submissionKey = (kind: LojaKind, pedido: string | number) => `loja:${kind}:${pedido}`;

export function normName(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Casa o item com o catálogo: nome exato normalizado, senão o nome de catálogo mais longo contido no item. */
export function matchCatalog(item: string, catalog: CatalogRow[]): CatalogRow | null {
  const n = normName(item);
  const exact = catalog.find((c) => normName(c.name) === n);
  if (exact) return exact;
  let best: CatalogRow | null = null;
  for (const c of catalog) {
    const cn = normName(c.name);
    if (cn.length >= 6 && n.includes(cn) && (!best || cn.length > normName(best.name).length)) best = c;
  }
  return best;
}

export function categoryLabel(c: CatalogRow | null): string | null {
  if (!c) return null;
  return [c.product_category, c.product_subcategory].filter(Boolean).join(" › ") || null;
}

/** Produto de interesse = item de maior valor (nome do catálogo quando casado). */
export function pickInterest(items: LojaItem[], catalog: CatalogRow[]): { produto: string | null; categorias: string[] } {
  const enriched = items.map((i) => ({ i, c: matchCatalog(i.nome, catalog) }));
  const top = [...enriched].sort((a, b) => b.i.preco * b.i.qty - a.i.preco * a.i.qty)[0];
  const categorias = [...new Set(enriched.map((e) => categoryLabel(e.c)).filter((x): x is string => !!x))];
  return { produto: top ? (top.c?.name ?? top.i.nome) : null, categorias };
}

export function isAbandoned(createdAt: string, now: number, status: string | null): boolean {
  return status === "active" && now - new Date(createdAt).getTime() >= ABANDON_AFTER_MS;
}

const brl = (v: number | null | undefined) =>
  v == null ? null : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface OrderInfo {
  pedido: string; data?: string | null; status?: string | null; itens: LojaItem[]; valor?: number | null;
  valor_envio?: number | null; forma_pagamento?: string | null; forma_envio?: string | null; cupom?: string | null;
}

export function buildResponses(kind: LojaKind, o: OrderInfo, produto: string | null, categorias: string[], catalog: CatalogRow[]) {
  const itens = o.itens.map((i) => {
    const cat = categoryLabel(matchCatalog(i.nome, catalog));
    return `${i.qty}x ${i.nome} (${brl(i.preco)})${cat ? ` — ${cat}` : ""}`;
  }).join("; ");
  return [
    { label: "Origem", value: LOJA_ORIGINS[kind] },
    { label: "Pedido", value: o.pedido },
    ...(o.data ? [{ label: "Data do pedido", value: o.data }] : []),
    ...(o.status ? [{ label: "Situação", value: o.status }] : []),
    { label: "Itens", value: itens || "—" },
    { label: "Categorias", value: categorias.join(", ") || "Não identificada no catálogo" },
    ...(produto ? [{ label: "Produto de interesse", value: produto }] : []),
    ...(o.valor != null ? [{ label: "Valor do pedido", value: brl(o.valor) }] : []),
    ...(o.valor_envio != null ? [{ label: "Frete", value: brl(o.valor_envio) }] : []),
    ...(o.forma_pagamento ? [{ label: "Forma de pagamento", value: o.forma_pagamento }] : []),
    ...(o.forma_envio ? [{ label: "Forma de envio", value: o.forma_envio }] : []),
    ...(o.cupom ? [{ label: "Cupom", value: o.cupom }] : []),
  ];
}
