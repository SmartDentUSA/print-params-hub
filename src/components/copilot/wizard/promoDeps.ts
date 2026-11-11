// Leituras do passo a passo da tabela promocional — as mesmas consultas da tela.
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_CATALOG_ENTITY_TYPES } from "@/lib/catalogEntityTypes";
import type { CatalogHit, PromoDeps, PromoRef } from "@/lib/copilotPromoWizard";

const clean = (t: string) => t.replace(/[%,()*]/g, " ").trim();

export const promoDeps: PromoDeps = {
  async loadEvents() {
    const { data } = await supabase.from("smartops_events" as any)
      .select("id,name,start_date").order("start_date", { ascending: false }).limit(100);
    return ((data as any[]) || []).map((e): PromoRef => ({ id: e.id, label: e.name, date: e.start_date }));
  },
  async loadDistributors() {
    const { data } = await supabase.from("distributors" as any)
      .select("id,razao_social,nome_fantasia").eq("active", true).order("razao_social");
    return ((data as any[]) || []).map((d): PromoRef => ({ id: d.id, label: d.nome_fantasia || d.razao_social }));
  },
  async loadSellers(eventId) {
    const ids: string[] = [];
    if (eventId) {
      const { data } = await supabase.from("smartops_forms" as any).select("event_consultant_ids").eq("event_id", eventId);
      for (const f of ((data as any[]) || [])) for (const id of (f.event_consultant_ids || [])) if (!ids.includes(id)) ids.push(id);
    }
    const { data } = await supabase.from("team_members" as any)
      .select("id,nome_completo").eq("ativo", true).order("nome_completo");
    const sellers = ((data as any[]) || []).map((r): PromoRef => ({ id: r.id, label: r.nome_completo }));
    return { sellers, preselected: ids.filter((id) => sellers.some((s) => s.id === id)) };
  },
  async searchCatalog(term, currency) {
    const t = clean(term);
    if (t.length < 2) return [];
    const priceKey = currency === "USD" ? "price_usd" : currency === "EUR" ? "price_eur" : "price_brl";
    const [{ data: byName }, { data: bySku }] = await Promise.all([
      supabase.from("system_a_catalog" as any).select("id,name,price")
        .in("category", [...PRODUCT_CATALOG_ENTITY_TYPES]).eq("active", true).eq("approved", true)
        .ilike("name", `%${t}%`).order("name").limit(10),
      supabase.from("catalog_product_variations" as any).select("catalog_product_id").ilike("sku", `%${t}%`).limit(10),
    ]);
    const prods = new Map<string, any>(((byName as any[]) || []).map((p) => [p.id, p]));
    const skuIds = [...new Set(((bySku as any[]) || []).map((v) => v.catalog_product_id))].filter((id) => !prods.has(id));
    if (skuIds.length) {
      const { data } = await supabase.from("system_a_catalog" as any).select("id,name,price")
        .in("id", skuIds).in("category", [...PRODUCT_CATALOG_ENTITY_TYPES]).eq("active", true).eq("approved", true);
      for (const p of ((data as any[]) || [])) prods.set(p.id, p);
    }
    const ids = [...prods.keys()];
    if (!ids.length) return [];
    const { data: vars } = await supabase.from("catalog_product_variations" as any)
      .select("id,catalog_product_id,presentation_qty,sku,price_brl,price_usd,price_eur,sort_order")
      .in("catalog_product_id", ids).order("sort_order");
    const out: CatalogHit[] = [];
    for (const p of prods.values()) {
      const pv = ((vars as any[]) || []).filter((v) => v.catalog_product_id === p.id);
      if (!pv.length) out.push({ productId: p.id, variationId: null, name: p.name, variation: null, sku: null, price: Number(p.price || 0) });
      for (const v of pv) out.push({ productId: p.id, variationId: v.id, name: p.name, variation: v.presentation_qty, sku: v.sku, price: Number(v[priceKey] ?? p.price ?? 0) });
    }
    return out.slice(0, 10);
  },
};
