/** Padrão de comissão KOL: chave estável de linha e comparação com a cópia do profissional. */
export type KolChannel = "indicacao" | "cupom" | "formulario";

export const KOL_CHANNELS: { id: KolChannel; label: string; description: string; hasDiscount: boolean }[] = [
  { id: "indicacao", label: "Formulários de indicação", description: "Percentual do KOL sobre vendas de leads que chegarem pelos formulários de indicação dele.", hasDiscount: false },
  { id: "cupom", label: "Cupons do e-commerce", description: "Percentual do KOL sobre vendas com os cupons dele na loja, e desconto do cupom ao cliente.", hasDiscount: true },
  { id: "formulario", label: "Formulários do profissional", description: "Percentual do KOL sobre vendas de leads que chegarem por formulários específicos do profissional.", hasDiscount: false },
];

export interface KolDefaultRow {
  kind: "category" | "product" | "referral";
  channel?: KolChannel;
  category: string | null;
  subcategory: string | null;
  product_id: string;
  product_name?: string;
  percent: number | null;
  coupon_discount_percent: number | null;
}

/** Canal da regra; regras antigas sem canal valem para cupons (e "referral" legado para indicação). */
export const ruleChannel = (r: { kind?: string; channel?: string | null }): KolChannel =>
  (r.channel as KolChannel) || (r.kind === "referral" ? "indicacao" : "cupom");

export const kolRowKey = (r: { kind?: string; channel?: string | null; category?: string | null; subcategory?: string | null; product_id?: string | null }) =>
  [ruleChannel(r), r.kind === "category" ? "category" : r.kind === "referral" ? "referral" : "product", r.category ?? "", r.subcategory ?? "", r.product_id ?? ""].join("::");

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Linha "personalizada": source='custom' gravado na linha, ou percentuais diferentes do padrão atual. */
export function isKolRowCustomized(
  row: { percent?: number | null; coupon_discount_percent?: number | null; source?: string },
  def: KolDefaultRow | undefined,
): boolean {
  if (row.source === "custom") return true;
  if (!def) return false;
  return num(row.percent) !== num(def.percent) || num(row.coupon_discount_percent) !== num(def.coupon_discount_percent);
}

/** Converte linhas de kol_commission_template_items para o formato do padrão. */
export function mapTemplateItems(items: any[]): Map<string, KolDefaultRow> {
  const m = new Map<string, KolDefaultRow>();
  for (const i of items ?? []) {
    const row: KolDefaultRow = {
      kind: i.kind === "produto" ? "product" : i.kind === "indicacao" ? "referral" : "category",
      channel: (i.channel as KolChannel) || (i.kind === "indicacao" ? "indicacao" : "cupom"),
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

/** Regra de cupom de uma categoria (canal cupom): subcategoria > categoria. */
export function couponRuleFor<T extends { kind?: string; channel?: string | null; category?: string | null; subcategory?: string | null }>(
  rules: T[], category: string, subcategory: string | null,
): T | undefined {
  const cats = rules.filter((r) => r.kind === "category" && ruleChannel(r) === "cupom" && r.category === category);
  return (subcategory ? cats.find((r) => (r.subcategory ?? null) === subcategory) : undefined)
    ?? cats.find((r) => !r.subcategory);
}

/** Formulário de indicação: propósito kol_referral ou nome com "indica". */
export const isReferralForm = (f: { form_purpose?: string | null; name?: string | null }) =>
  f.form_purpose === "kol_referral" || /indica/i.test(f.name ?? "");
