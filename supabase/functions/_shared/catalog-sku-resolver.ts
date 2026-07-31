/**
 * catalog-sku-resolver
 * Resolve nomes livres de produtos (propostas PipeRun, pedidos e-commerce,
 * itens parseados) para o SKU oficial e a nomenclatura canônica do catálogo.
 *
 * Fontes (nesta ordem de prioridade):
 *   1) produto_aliases  → nome_variante ⇒ nome_canonico (+ sku_interno quando existir)
 *   2) catalog_product_variations ⋈ system_a_catalog → SKU oficial por
 *      (produto pai + apresentação/qtd + cor)
 *
 * Nunca inventa SKU: se não houver match confiável, devolve matched=false e o
 * chamador mantém o valor original.
 */

export interface CatalogResolution {
  sku: string | null;
  canonical_name: string;
  category: string | null;
  matched: boolean;
  source: "alias" | "variation" | "none";
}

export type CatalogIndex = Record<string, CatalogResolution>;

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function normName(raw: unknown): string {
  return stripAccents(String(raw ?? "").toLowerCase())
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "250" + "grs" → "250g" ; 1000 grs → "1kg" */
function qtyToken(qty: number | null, unidade: string | null): string | null {
  if (!qty || qty <= 0) return null;
  const u = normName(unidade || "");
  const isMass = !u || u.startsWith("g") || u.startsWith("kg") || u.startsWith("gr");
  if (!isMass) return `${qty}${u}`.replace(/\s/g, "");
  if (qty >= 1000 && qty % 1000 === 0) return `${qty / 1000}kg`;
  return `${qty}g`;
}

/** Extrai tokens de cor relevantes ("A2 Classic" → ["a2","classic"]). */
function colorTokens(color: string | null): string[] {
  const n = normName(color || "");
  if (!n) return [];
  return n.split(" ").filter((t) => t && t !== "unica" && t !== "universal" && t !== "multi");
}

interface VariationRow {
  sku: string | null;
  presentation: string | null;
  presentation_qty: number | null;
  unidade: string | null;
  color: string | null;
  parent_name: string;
  category: string | null;
}

interface AliasRow {
  nome_variante: string | null;
  nome_canonico: string | null;
  sku_interno: string | null;
  categoria: string | null;
}

export interface CatalogResolver {
  resolve: (rawName: string) => CatalogResolution;
  size: number;
}

// deno-lint-ignore no-explicit-any
export async function loadCatalogResolver(supabase: any): Promise<CatalogResolver> {
  const [{ data: variations }, { data: aliases }] = await Promise.all([
    supabase
      .from("catalog_product_variations")
      .select("sku, presentation, presentation_qty, unidade, color, catalog_product_id")
      .limit(2000),
    supabase
      .from("produto_aliases")
      .select("nome_variante, nome_canonico, sku_interno, categoria")
      .eq("ativo", true)
      .limit(2000),
  ]);

  const parentIds = Array.from(
    new Set(((variations || []) as any[]).map((v) => v.catalog_product_id).filter(Boolean)),
  );
  const parentMap = new Map<string, { name: string; category: string | null }>();
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from("system_a_catalog")
      .select("id, name, category")
      .in("id", parentIds);
    for (const p of ((parents || []) as any[])) {
      parentMap.set(p.id, { name: p.name || "", category: p.category ?? null });
    }
  }

  const variationRows: VariationRow[] = ((variations || []) as any[])
    .map((v) => {
      const parent = parentMap.get(v.catalog_product_id);
      if (!parent?.name) return null;
      return {
        sku: v.sku ? String(v.sku) : null,
        presentation: v.presentation ?? null,
        presentation_qty: v.presentation_qty ?? null,
        unidade: v.unidade ?? null,
        color: v.color ?? null,
        parent_name: parent.name,
        category: parent.category,
      } as VariationRow;
    })
    .filter(Boolean) as VariationRow[];

  // Índice de aliases por nome normalizado
  const aliasMap = new Map<string, AliasRow>();
  for (const a of ((aliases || []) as AliasRow[])) {
    const key = normName(a.nome_variante);
    if (key) aliasMap.set(key, a);
    const canonKey = normName(a.nome_canonico);
    if (canonKey && !aliasMap.has(canonKey)) aliasMap.set(canonKey, a);
  }

  function canonicalFromVariation(v: VariationRow): string {
    const qt = qtyToken(v.presentation_qty, v.unidade);
    const parts = [v.parent_name, qt, v.color].filter(Boolean);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function matchVariation(nameNorm: string): VariationRow | null {
    const tokens = new Set(nameNorm.split(" "));
    let best: { row: VariationRow; score: number } | null = null;

    for (const v of variationRows) {
      const parentTokens = normName(v.parent_name)
        .split(" ")
        .filter((t) => t.length > 2);
      if (parentTokens.length === 0) continue;
      const parentHits = parentTokens.filter((t) => tokens.has(t)).length;
      // exige forte aderência ao produto pai
      if (parentHits / parentTokens.length < 0.6) continue;

      const qt = qtyToken(v.presentation_qty, v.unidade);
      if (qt && !nameNorm.includes(normName(qt))) continue;

      const cTokens = colorTokens(v.color);
      if (cTokens.length > 0) {
        // pelo menos o primeiro token de cor (ex.: "a2", "clear") tem de aparecer
        if (!tokens.has(cTokens[0])) continue;
      }
      const colorHits = cTokens.filter((t) => tokens.has(t)).length;
      const score = parentHits * 2 + colorHits * 3 + (qt ? 2 : 0);
      if (!best || score > best.score) best = { row: v, score };
    }
    return best?.row ?? null;
  }

  const cache = new Map<string, CatalogResolution>();

  function resolve(rawName: string): CatalogResolution {
    const key = normName(rawName);
    const miss: CatalogResolution = {
      sku: null,
      canonical_name: String(rawName || "").trim(),
      category: null,
      matched: false,
      source: "none",
    };
    if (!key) return miss;
    const cached = cache.get(key);
    if (cached) return cached;

    let out = miss;
    const alias = aliasMap.get(key);
    const variation = matchVariation(key);

    if (variation) {
      out = {
        sku: variation.sku,
        canonical_name: alias?.nome_canonico?.trim() || canonicalFromVariation(variation),
        category: variation.category ?? alias?.categoria ?? null,
        matched: true,
        source: "variation",
      };
    } else if (alias) {
      out = {
        sku: alias.sku_interno ? String(alias.sku_interno) : null,
        canonical_name: alias.nome_canonico?.trim() || miss.canonical_name,
        category: alias.categoria ?? null,
        matched: true,
        source: "alias",
      };
    }

    cache.set(key, out);
    return out;
  }

  return { resolve, size: variationRows.length + aliasMap.size };
}

/** Constrói um índice pronto para o front (chave = nome normalizado). */
export function buildCatalogIndex(
  resolver: CatalogResolver,
  names: Iterable<string>,
): CatalogIndex {
  const index: CatalogIndex = {};
  for (const n of names) {
    const key = normName(n);
    if (!key || index[key]) continue;
    const r = resolver.resolve(n);
    if (r.matched) index[key] = r;
  }
  return index;
}