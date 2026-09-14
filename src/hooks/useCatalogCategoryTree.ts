import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_CATALOG_ENTITY_TYPES } from "@/lib/catalogEntityTypes";

export interface CatalogCategoryNode {
  category: string;
  subcategories: { label: string; count: number }[];
}

/** Chave estável usada para habilitar categorias em formulários de feira. */
export const catKey = (category: string, subcategory?: string | null) =>
  subcategory ? `${category} > ${subcategory}` : category;

/**
 * Árvore de categorias vinda do catálogo de produtos
 * (`system_a_catalog.product_category` / `product_subcategory`).
 */
export function useCatalogCategoryTree() {
  return useQuery({
    queryKey: ["catalog-category-tree"],
    queryFn: async (): Promise<CatalogCategoryNode[]> => {
      const { data, error } = await (supabase as any)
        .from("system_a_catalog")
        .select("product_category, product_subcategory")
        .in("category", [...PRODUCT_CATALOG_ENTITY_TYPES])
        .eq("active", true)
        .not("product_category", "is", null)
        .limit(5000);
      if (error) throw error;

      const map = new Map<string, Map<string, number>>();
      for (const row of (data ?? []) as any[]) {
        const cat = String(row.product_category || "").trim();
        if (!cat) continue;
        const sub = String(row.product_subcategory || "").trim();
        if (!map.has(cat)) map.set(cat, new Map());
        if (sub) {
          const subs = map.get(cat)!;
          subs.set(sub, (subs.get(sub) ?? 0) + 1);
        }
      }

      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
        .map(([category, subs]) => ({
          category,
          subcategories: Array.from(subs.entries())
            .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
            .map(([label, count]) => ({ label, count })),
        }));
    },
    staleTime: 10 * 60 * 1000,
  });
}
