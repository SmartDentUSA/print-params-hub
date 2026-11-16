import { PRODUCT_CATALOG_ENTITY_TYPES } from "./catalogEntityTypes";

export interface CatalogRow {
  id: string;
  name: string | null;
  category: string | null;
  active?: boolean | null;
  product_category?: string | null;
}

export interface CatalogProductOption {
  id: string;
  name: string;
  productCategory: string | null;
  /** Já estava vinculado, mas não é (mais) um produto ativo do catálogo comercial. */
  outsideCatalog: boolean;
}

/** Só produtos comerciais ativos: clientes/depoimentos, categorias e dados da empresa ficam fora. */
export function isCommercialCatalogItem(row: CatalogRow): boolean {
  return (
    (PRODUCT_CATALOG_ENTITY_TYPES as readonly string[]).includes(row.category ?? "") &&
    row.active !== false &&
    !!row.name?.trim()
  );
}

/**
 * Lista do seletor: produtos comerciais ativos em ordem alfabética, mais os itens
 * já vinculados que não passam no filtro (para o vínculo salvo continuar visível).
 */
export function buildCatalogProductOptions(rows: CatalogRow[], alreadyLinked: CatalogRow[] = []): CatalogProductOption[] {
  const seen = new Set<string>();
  const out: CatalogProductOption[] = [];
  for (const r of rows) {
    if (seen.has(r.id) || !isCommercialCatalogItem(r)) continue;
    seen.add(r.id);
    out.push({ id: r.id, name: r.name!.trim(), productCategory: r.product_category ?? null, outsideCatalog: false });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  for (const r of alreadyLinked) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({ id: r.id, name: (r.name ?? "").trim() || "Produto removido", productCategory: r.product_category ?? null, outsideCatalog: true });
  }
  return out;
}
