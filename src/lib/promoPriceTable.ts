/**
 * Tabela exclusiva de promoção: regras puras (sem Supabase) para copiar a
 * tabela da Loja Oficial como base e para sincronizar a base depois.
 *
 * Regra: o "preço tabela" da promoção é o preço de venda da Loja Oficial
 * (price_dealer), e o desconto da campanha começa em 0%. Ao sincronizar, o
 * desconto que o usuário já aplicou em cada item é preservado.
 */
export type PriceRow = {
  id?: string;
  catalog_product_id?: string | null;
  cod?: string | null;
  sku?: string | null;
  name: string;
  name_en?: string | null;
  name_es?: string | null;
  image_url?: string | null;
  category?: string | null;
  subcategory?: string | null;
  variant?: string | null;
  ncm_hs?: string | null;
  gtin_ean?: string | null;
  unidade?: string | null;
  description?: string | null;
  presentation?: string | null;
  quantity_multiplier?: number | null;
  presentation_qty?: string | null;
  color?: string | null;
  price_base?: number | null;
  discount_pct?: number | null;
  price_dealer?: number | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const norm = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");

/** Preço de venda da Loja Oficial (com o desconto dela já aplicado). */
export const officialSellPrice = (row: PriceRow) => {
  const dealer = Number(row.price_dealer);
  if (Number.isFinite(dealer) && dealer > 0) return round2(dealer);
  const base = Number(row.price_base);
  return Number.isFinite(base) && base > 0 ? round2(base) : 0;
};

export const promoPrice = (base: number, discountPct: number) =>
  round2(Number(base || 0) * (1 - Number(discountPct || 0) / 100));

/** Chave estável de um item: SKU da variação; senão produto + apresentação. */
export const priceRowKey = (row: PriceRow) =>
  row.sku ? `sku::${norm(row.sku)}` : `${row.catalog_product_id ?? norm(row.name)}::${norm(row.presentation_qty)}`;

const metadata = (row: PriceRow) => ({
  catalog_product_id: row.catalog_product_id ?? null,
  cod: row.cod ?? null,
  sku: row.sku ?? null,
  name: row.name,
  name_en: row.name_en ?? null,
  name_es: row.name_es ?? null,
  image_url: row.image_url ?? null,
  category: row.category ?? null,
  subcategory: row.subcategory ?? null,
  variant: row.variant ?? null,
  ncm_hs: row.ncm_hs ?? null,
  gtin_ean: row.gtin_ean ?? null,
  unidade: row.unidade || "UN",
  description: row.description ?? null,
  presentation: row.presentation || "Unit",
  quantity_multiplier: Number(row.quantity_multiplier ?? 1) || 1,
  presentation_qty: row.presentation_qty ?? null,
  color: row.color ?? null,
});

/** Linha da tabela exclusiva criada a partir de um item da Loja Oficial. */
export function promoRowFromOfficial(official: PriceRow, priceListId: string, sortOrder: number) {
  const base = officialSellPrice(official);
  return {
    price_list_id: priceListId,
    ...metadata(official),
    price_base: base,
    discount_pct: 0,
    price_dealer: base,
    sort_order: sortOrder,
    is_active: true,
  };
}

/**
 * Planeja a atualização da tabela exclusiva a partir da Loja Oficial:
 * itens novos entram com 0% de desconto; itens existentes recebem o preço
 * atual da loja mantendo o desconto da campanha; itens extras ficam intocados.
 */
export function planOfficialSync(existing: PriceRow[], official: PriceRow[], priceListId: string) {
  const byKey = new Map(existing.map((row) => [priceRowKey(row), row]));
  const inserts: ReturnType<typeof promoRowFromOfficial>[] = [];
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  let cursor = existing.length;
  for (const row of official) {
    if (row.is_active === false) continue;
    const current = byKey.get(priceRowKey(row));
    if (!current) { inserts.push(promoRowFromOfficial(row, priceListId, cursor++)); continue; }
    const base = officialSellPrice(row);
    if (!current.id || base === round2(Number(current.price_base || 0))) continue;
    const discount = Number(current.discount_pct || 0);
    updates.push({ id: current.id, patch: { ...metadata(row), price_base: base, price_dealer: promoPrice(base, discount) } });
  }
  return { inserts, updates };
}

/**
 * Clonagem de outra promoção: copia cada item exatamente como está na origem
 * (preço tabela, desconto e preço final), para depois editar os descontos.
 */
export function clonedPromoRows(source: PriceRow[], priceListId: string) {
  return source
    .filter((row) => row.is_active !== false)
    .map((row, index) => {
      const base = round2(Number(row.price_base || 0));
      const discount = Number(row.discount_pct || 0);
      const dealer = Number(row.price_dealer);
      return {
        price_list_id: priceListId,
        ...metadata(row),
        price_base: base,
        discount_pct: discount,
        price_dealer: Number.isFinite(dealer) && dealer > 0 ? round2(dealer) : promoPrice(base, discount),
        sort_order: row.sort_order ?? index,
        is_active: true,
      };
    });
}
