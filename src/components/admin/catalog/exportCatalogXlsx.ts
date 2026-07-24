import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { CatalogProduct } from "@/hooks/useCatalogCRUD";

/**
 * Exports the full product catalog (products + variations) to XLSX so users
 * can share the complete product dataset (SKU, NCM, GTIN, prices, dimensions,
 * colors, etc.) with partners, distributors or internal teams.
 */
export async function exportCatalogXlsx(products: CatalogProduct[]) {
  const productIds = products.map((p) => p.id);
  let variations: any[] = [];
  if (productIds.length > 0) {
    const { data } = await supabase
      .from("catalog_product_variations")
      .select(
        "catalog_product_id, sku, presentation, presentation_qty, unidade, ncm_hs, gtin_ean, weight_kg, dimensions_cm, price_brl, price_usd, price_eur, color, source, is_active",
      )
      .in("catalog_product_id", productIds)
      .order("sort_order", { ascending: true });
    variations = (data as any[]) ?? [];
  }
  const byProduct = new Map<string, any[]>();
  for (const v of variations) {
    const list = byProduct.get(v.catalog_product_id) ?? [];
    list.push(v);
    byProduct.set(v.catalog_product_id, list);
  }

  const header = [
    "Categoria", "Subcategoria", "Produto", "Slug",
    "SKU", "NCM", "GTIN", "Variante", "Pres", "Un", "Cor",
    "Peso (kg)", "Dimensões (cm)",
    "Preço BRL", "Preço USD", "Preço EUR",
    "Fabricante", "Distribuir", "Ativo", "Visível", "Origem", "Fonte variação",
  ];
  const aoa: any[][] = [header];

  for (const p of products) {
    const extra: any = (p as any).extra_data ?? {};
    const manufacturer = extra?.manufacturer ?? "";
    const distribute = extra?.distribute_enabled ? "Sim" : "Não";
    const vs = byProduct.get(p.id) ?? [];
    if (vs.length === 0) {
      aoa.push([
        p.product_category ?? p.category ?? "",
        (p as any).subcategory ?? "",
        p.name ?? "",
        (p as any).slug ?? "",
        "", "", "", "", "", "", "",
        "", "",
        "", "", "",
        manufacturer, distribute,
        (p as any).is_active ? "Sim" : "Não",
        (p as any).is_visible ? "Sim" : "Não",
        (p as any).origin ?? (p as any).source ?? "",
        "",
      ]);
      continue;
    }
    for (const v of vs) {
      aoa.push([
        p.product_category ?? p.category ?? "",
        (p as any).subcategory ?? "",
        p.name ?? "",
        (p as any).slug ?? "",
        v.sku ?? "",
        v.ncm_hs ?? "",
        v.gtin_ean ?? "",
        v.presentation_qty ?? "",
        v.presentation ?? "",
        v.unidade ?? "",
        v.color ?? "",
        v.weight_kg ?? "",
        v.dimensions_cm ?? "",
        v.price_brl ?? "",
        v.price_usd ?? "",
        v.price_eur ?? "",
        manufacturer, distribute,
        (p as any).is_active ? "Sim" : "Não",
        (p as any).is_visible ? "Sim" : "Não",
        (p as any).origin ?? (p as any).source ?? "",
        v.source ?? "",
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 26 }, { wch: 22 }, { wch: 38 }, { wch: 30 },
    { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 14 },
    { wch: 10 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 16 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Catálogo");
  const ts = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `catalogo-produtos-${ts}.xlsx`);
}