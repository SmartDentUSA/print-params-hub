import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CatalogVariationOption } from "@/hooks/useSkuMappingInbox";

export interface KitComponent {
  id: string;
  kit_alias_id: number;
  component_variation_id: string | null;
  component_catalog_product_id?: string | null;
  quantity: number;
  sort_order: number;
  // joined for display
  variation_sku?: string | null;
  variation_presentation?: string | null;
  parent_name?: string | null;
}

export function useKitComponents(aliasId: number | null) {
  const [components, setComponents] = useState<KitComponent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!aliasId) {
      setComponents([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("catalog_kit_components")
        .select(
          "id, kit_alias_id, component_variation_id, component_catalog_product_id, quantity, sort_order, catalog_product_variations:component_variation_id ( sku, presentation, system_a_catalog:catalog_product_id ( name ) ), system_a_catalog:component_catalog_product_id ( name, slug, extra_data )",
        )
        .eq("kit_alias_id", aliasId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setComponents(
        ((data || []) as any[]).map((r) => ({
          id: r.id,
          kit_alias_id: r.kit_alias_id,
          component_variation_id: r.component_variation_id,
          component_catalog_product_id: r.component_catalog_product_id,
          quantity: Number(r.quantity ?? 1),
          sort_order: r.sort_order ?? 0,
          variation_sku: r.catalog_product_variations?.sku ?? r.system_a_catalog?.extra_data?.sku ?? r.system_a_catalog?.slug ?? null,
          variation_presentation: r.catalog_product_variations?.presentation ?? null,
          parent_name: r.catalog_product_variations?.system_a_catalog?.name ?? r.system_a_catalog?.name ?? null,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [aliasId]);

  useEffect(() => {
    load();
  }, [load]);

  const addComponent = useCallback(
    async (variation: CatalogVariationOption, quantity: number) => {
      if (!aliasId) throw new Error("Salve o item como kit antes de adicionar componentes.");
      const nextOrder =
        components.reduce((m, c) => Math.max(m, c.sort_order), 0) + 1;
      const { error } = await (supabase as any)
        .from("catalog_kit_components")
        .insert([
          {
            kit_alias_id: aliasId,
            component_variation_id: variation.id.startsWith("cat:") ? null : variation.id,
            component_catalog_product_id: variation.id.startsWith("cat:")
              ? variation.catalog_product_id
              : null,
            quantity,
            sort_order: nextOrder,
          },
        ]);
      if (error) throw error;
      await load();
    },
    [aliasId, components, load],
  );

  const updateQuantity = useCallback(
    async (id: string, quantity: number) => {
      const { error } = await (supabase as any)
        .from("catalog_kit_components")
        .update({ quantity })
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const removeComponent = useCallback(
    async (id: string) => {
      const { error } = await (supabase as any)
        .from("catalog_kit_components")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  return { components, loading, load, addComponent, updateQuantity, removeComponent };
}