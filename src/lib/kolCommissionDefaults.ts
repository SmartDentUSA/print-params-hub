/** Padrão de comissão KOL: chave estável de linha e comparação com a cópia do profissional. */
export interface KolDefaultRow {
  kind: "category" | "product" | "referral";
  category: string | null;
  subcategory: string | null;
  product_id: string;
  product_name?: string;
  percent: number | null;
  coupon_discount_percent: number | null;
}

export const kolRowKey = (r: { kind?: string; category?: string | null; subcategory?: string | null; product_id?: string | null }) =>
  [r.kind === "category" ? "category" : r.kind === "referral" ? "referral" : "product", r.category ?? "", r.subcategory ?? "", r.product_id ?? ""].join("::");

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Linha "personalizada" = percentuais diferentes do padrão atual (ou sem linha no padrão). */
export function isKolRowCustomized(
  row: { percent?: number | null; coupon_discount_percent?: number | null },
  def: KolDefaultRow | undefined,
): boolean {
  if (!def) return false;
  return num(row.percent) !== num(def.percent) || num(row.coupon_discount_percent) !== num(def.coupon_discount_percent);
}

/** Converte linhas de kol_commission_template_items para o formato do padrão. */
export function mapTemplateItems(items: any[]): Map<string, KolDefaultRow> {
  const m = new Map<string, KolDefaultRow>();
  for (const i of items ?? []) {
    const row: KolDefaultRow = {
      kind: i.kind === "produto" ? "product" : i.kind === "indicacao" ? "referral" : "category",
      category: i.category ?? null,
      subcategory: i.subcategory ?? null,
      product_id: i.product_id ?? "",
      percent: num(i.percent),
      coupon_discount_percent: num(i.coupon_discount_percent),
    };
    m.set(kolRowKey(row), row);
  }
  return m;
}

/** Regra de cupom de uma categoria: subcategoria > categoria. */
export function couponRuleFor<T extends { kind?: string; category?: string | null; subcategory?: string | null }>(
  rules: T[], category: string, subcategory: string | null,
): T | undefined {
  const cats = rules.filter((r) => r.kind === "category" && r.category === category);
  return (subcategory ? cats.find((r) => (r.subcategory ?? null) === subcategory) : undefined)
    ?? cats.find((r) => !r.subcategory);
}
