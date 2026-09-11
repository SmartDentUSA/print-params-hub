export type PromotionalStatus = "draft" | "active" | "archived";

export type PromotionalTable = {
  id: string;
  name: string;
  pdf_title: string;
  distributor_id: string | null;
  currency: string;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  status: PromotionalStatus;
  created_at: string;
  updated_at: string;
};

export type PromotionalSection = {
  id: string;
  promotional_table_id: string;
  title: string;
  description: string | null;
  sort_order: number;
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
};

export type PromotionalSectionWithItems = PromotionalSection & { items: PromotionalItem[] };

export const itemTotals = (item: PromotionalItem) => {
  const market = Number(item.market_unit_price || 0) * Number(item.quantity || 0);
  const promotional = Number(item.promotional_unit_price || 0) * Number(item.quantity || 0);
  const savings = market - promotional;
  return { market, promotional, savings, discount: market > 0 ? (savings / market) * 100 : 0 };
};