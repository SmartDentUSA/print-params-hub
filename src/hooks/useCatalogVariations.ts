import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogVariation {
  id: string;
  catalog_product_id: string;
  sku: string | null;
  presentation: string | null;
  presentation_qty: string | null;
  unidade: string | null;
  ncm_hs: string | null;
  gtin_ean: string | null;
  weight_kg: number | null;
  dimensions_cm: string | null;
  price_brl: number | null;
  price_usd: number | null;
  price_eur: number | null;
  color: string | null;
  sort_order: number | null;
  source: string | null;
}

/**
 * CRUD para catalog_product_variations, uma variação por linha da tabela
 * de Gestão de Catálogo. Não toca em system_a_catalog nem em resins.
 */
export function useCatalogVariations() {
  const [variationsByProduct, setVariationsByProduct] = useState<
    Record<string, CatalogVariation[]>
  >({});
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async (productIds: string[]) => {
    if (productIds.length === 0) {
      setVariationsByProduct({});
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("catalog_product_variations")
        .select(
          "id, catalog_product_id, sku, presentation, presentation_qty, unidade, ncm_hs, gtin_ean, weight_kg, dimensions_cm, price_brl, price_usd, price_eur, color, sort_order, source",
        )
        .in("catalog_product_id", productIds)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const map: Record<string, CatalogVariation[]> = {};
      for (const row of (data as any[]) || []) {
        const key = row.catalog_product_id as string;
        (map[key] = map[key] || []).push(row as CatalogVariation);
      }
      setVariationsByProduct(map);
    } finally {
      setLoading(false);
    }
  }, []);

  const upsertField = useCallback(
    async (
      variationId: string,
      patch: Partial<CatalogVariation>,
    ): Promise<CatalogVariation | null> => {
      const { data, error } = await supabase
        .from("catalog_product_variations")
        .update(patch)
        .eq("id", variationId)
        .select()
        .single();
      if (error) throw error;
      const updated = data as CatalogVariation;
      setVariationsByProduct((prev) => {
        const key = updated.catalog_product_id;
        const list = (prev[key] || []).map((v) =>
          v.id === updated.id ? updated : v,
        );
        return { ...prev, [key]: list };
      });
      return updated;
    },
    [],
  );

  const addVariation = useCallback(
    async (productId: string): Promise<CatalogVariation | null> => {
      const existing = variationsByProduct[productId] || [];
      const nextOrder =
        existing.reduce((m, v) => Math.max(m, v.sort_order ?? 0), 0) + 1;
      const { data, error } = await supabase
        .from("catalog_product_variations")
        .insert({
          catalog_product_id: productId,
          sort_order: nextOrder,
          source: "admin_catalog_ui",
        })
        .select()
        .single();
      if (error) throw error;
      const created = data as CatalogVariation;
      setVariationsByProduct((prev) => ({
        ...prev,
        [productId]: [...(prev[productId] || []), created],
      }));
      return created;
    },
    [variationsByProduct],
  );

  const removeVariation = useCallback(async (variationId: string) => {
    const { error } = await supabase
      .from("catalog_product_variations")
      .delete()
      .eq("id", variationId);
    if (error) throw error;
    setVariationsByProduct((prev) => {
      const out: Record<string, CatalogVariation[]> = {};
      for (const [k, list] of Object.entries(prev)) {
        out[k] = list.filter((v) => v.id !== variationId);
      }
      return out;
    });
  }, []);

  return { variationsByProduct, loading, loadAll, upsertField, addVariation, removeVariation };
}

/**
 * Linha "default" sintética para produtos ainda sem variação. Não persiste
 * até o usuário editar algum campo (o componente cria a variação real na hora).
 */
export function makePlaceholderVariation(productId: string): CatalogVariation {
  return {
    id: `__placeholder__:${productId}`,
    catalog_product_id: productId,
    sku: null,
    presentation: null,
    presentation_qty: null,
    unidade: null,
    ncm_hs: null,
    gtin_ean: null,
    weight_kg: null,
    dimensions_cm: null,
    price_brl: null,
    price_usd: null,
    price_eur: null,
    color: null,
    sort_order: 0,
    source: null,
  };
}

export const isPlaceholderVariation = (v: CatalogVariation) =>
  v.id.startsWith("__placeholder__:");

/** Wrap para uso em effects: dispara loadAll quando a lista de produtos muda. */
export function useCatalogVariationsFor(productIds: string[]) {
  const hook = useCatalogVariations();
  const key = productIds.slice().sort().join(",");
  useEffect(() => {
    hook.loadAll(productIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return hook;
}