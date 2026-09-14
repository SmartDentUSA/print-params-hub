export type PromotionalStatus = "draft" | "active" | "archived";

export type PromotionalTable = {
  id: string;
  name: string;
  pdf_title: string;
  distributor_id: string | null;
  event_id?: string | null;
  currency: string;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  status: PromotionalStatus;
  include_official_price_table?: boolean;
  /** Vendedores autorizados a divulgar a promoção (mesma lista do formulário do evento). */
  coupon_seller_ids?: string[] | null;
  coupon_discount_type?: "percent" | "fixed" | null;
  coupon_discount_value?: number | null;
  coupon_prefix?: string | null;
  coupon_usage_limit?: number | null;
  coupon_valid_from?: string | null;
  coupon_valid_until?: string | null;
  coupon_li_category_ids?: number[] | null;
  coupon_li_category_labels?: string[] | null;
  coupon_freight_discount_value?: number | null;
  coupon_freight_valid_from?: string | null;
  coupon_freight_valid_until?: string | null;
  coupon_freight_usage_limit?: number | null;
  created_at: string;
  updated_at: string;
};

export type PromotionalCoupon = {
  id: string;
  promotional_table_id: string;
  team_member_id: string | null;
  seller_name: string | null;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit: number | null;
  active: boolean;
  li_coupon_id: string | null;
  li_synced_at: string | null;
  li_sync_error: string | null;
};

export type PromotionalSection = {
  id: string;
  promotional_table_id: string;
  title: string;
  description: string | null;
  image_url?: string | null;
  sort_order: number;
  group_labels?: string[] | null;
  /** Produto principal do combo — vira "produto de interesse" no PipeRun. */
  main_product_name?: string | null;
  main_product_catalog_id?: string | null;
};


export type PromotionalItem = {
  id: string;
  section_id: string;
  catalog_product_id: string | null;
  catalog_variation_id: string | null;
  item_type: "catalog" | "custom";
  name: string;
  sku: string | null;
  image_url: string | null;
  description: string | null;
  quantity: number;
  market_unit_price: number;
  promotional_unit_price: number;
  sort_order: number;
  group_label?: string | null;

};

export type PromotionalSectionWithItems = PromotionalSection & { items: PromotionalItem[] };

export const itemTotals = (item: PromotionalItem) => {
  const market = Number(item.market_unit_price || 0) * Number(item.quantity || 0);
  const promotional = Number(item.promotional_unit_price || 0) * Number(item.quantity || 0);
  const savings = market - promotional;
  return { market, promotional, savings, discount: market > 0 ? (savings / market) * 100 : 0 };
};