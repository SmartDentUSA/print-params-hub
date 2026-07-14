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
  presentation_qty?: number | null;
  is_active?: boolean;
};

export type PresentationType = "g" | "Kg" | "ml" | "mg" | "Unid";
export const PRESENTATION_OPTIONS: PresentationType[] = ["g", "Kg", "ml", "mg", "Unid"];

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