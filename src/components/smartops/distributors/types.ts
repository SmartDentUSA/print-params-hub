export type Distributor = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  logo_url?: string | null;
  pais?: string | null;
  estado?: string | null;
  cidade?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  active?: boolean | null;
  preferred_currency?: string | null;
  language_preference?: string | null;
};

export type DealerPriceList = {
  id: string;
  distributor_id: string;
  name: string;
  currency: string;
  language: string;
  exchange_rate: number | null;
  version: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DealerPriceItem = {
  id: string;
  price_list_id: string;
  catalog_product_id: string | null;
  cod: string | null;
  sku?: string | null;
  name: string;
  name_en?: string | null;
  name_es?: string | null;
  image_url: string | null;
  category: string | null;
  subcategory: string | null;
  variant: string | null;
  ncm_hs: string | null;
  gtin_ean: string | null;
  unidade: string;
  description: string | null;
  price_base: number;
  discount_pct: number;
  price_dealer: number;
  sort_order: number;
  presentation?: PresentationType | null;
  quantity_multiplier?: number | null;
  presentation_qty?: string | null;
  is_active?: boolean;
  color?: string | null;
};

export type PresentationType = "grs" | "Kg" | "Item" | "ml" | "Un";
export const PRESENTATION_OPTIONS: PresentationType[] = ["grs", "Kg", "Item", "ml", "Un"];

export type DealerSnapshot = {
  id: string;
  distributor_id: string;
  price_list_id: string | null;
  label: string | null;
  currency: string;
  language: string;
  items: any;
  totals: any;
  created_at: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  name_en?: string | null;
  name_es?: string | null;
  category: string | null;
  product_category?: string | null;
  product_subcategory?: string | null;
  image_url: string | null;
  price: number | null;
  currency: string | null;
  description: string | null;
  active: boolean | null;
};

export type ProposalStatus = "draft" | "sent" | "accepted" | "expired" | "rejected";

export type DealerProposal = {
  id: string;
  distributor_id: string;
  price_list_id: string | null;
  proposal_number: string | null;
  language: string;
  currency: string;
  header_data: Record<string, any>;
  items: DealerPriceItem[];
  totals: { subtotal?: number; discount_total?: number; total?: number };
  status: ProposalStatus;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
};

export function recalcDealerPrice(base: number, discountPct: number): number {
  const d = Math.max(0, Math.min(100, Number(discountPct) || 0));
  const b = Number(base) || 0;
  return Math.round(b * (1 - d / 100) * 100) / 100;
}

export function recalcDiscount(base: number, dealer: number): number {
  const b = Number(base) || 0;
  if (b <= 0) return 0;
  const d = ((b - (Number(dealer) || 0)) / b) * 100;
  return Math.round(Math.max(0, Math.min(100, d)) * 100) / 100;
}

export function formatMoney(v: number | null | undefined, currency = "BRL"): string {
  const n = Number(v ?? 0);
  try {
    return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
      style: "currency", currency,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

/** Rank a (category, subcategory) pair by leading numeric prefix
 * (e.g. "3. IMPRESSÃO 3D" / "3.1 RESINAS 3D" → 3.01). Categories without a
 * numeric prefix fall back to a high rank so callers can localeCompare them. */
export function categoryRank(cat?: string | null, sub?: string | null): number {
  const c = (cat ?? "").toString().trim();
  const s = (sub ?? "").toString().trim();
  if (!c) return 9999;
  const catMatch = c.match(/^\s*(\d+)\./);
  if (!catMatch) return 9999;
  const intPart = parseInt(catMatch[1], 10);
  const subMatch = s.match(/^\s*\d+\.(\d+)/);
  const decPart = subMatch ? parseInt(subMatch[1], 10) : 0;
  return intPart + decPart / 100;
}