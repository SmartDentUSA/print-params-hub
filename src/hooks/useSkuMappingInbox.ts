import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SkuInboxRow {
  name_key: string;
  sample_name: string;
  sample_code: string | null;
  sample_sku: string | null;
  sources: string;
  occurrences: number;
  gmv: number;
  alias_id: number | null;
  nome_canonico: string | null;
  sku_interno: string | null;
  categoria: string | null;
  subcategoria: string | null;
  is_kit: boolean;
  alias_ativo: boolean | null;
}

export interface CatalogVariationOption {
  id: string;
  sku: string | null;
  presentation: string | null;
  color: string | null;
  catalog_product_id: string;
  parent_name: string | null;
  parent_category: string | null;
}

export function useSkuMappingInbox() {
  const [rows, setRows] = useState<SkuInboxRow[]>([]);
  const [variations, setVariations] = useState<CatalogVariationOption[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inbox, vars] = await Promise.all([
        (supabase as any)
          .from("v_sku_mapping_inbox")
          .select("*")
          .order("gmv", { ascending: false })
          .limit(2000),
        (supabase as any)
          .from("catalog_product_variations")
          .select(
            "id, sku, presentation, color, catalog_product_id, system_a_catalog:catalog_product_id ( name, product_category )",
          )
          .limit(5000),
      ]);
      if (inbox.error) throw inbox.error;
      if (vars.error) throw vars.error;
      setRows((inbox.data || []) as SkuInboxRow[]);
      const variationOptions: CatalogVariationOption[] = ((vars.data || []) as any[]).map((v) => ({
        id: v.id,
        sku: v.sku,
        presentation: v.presentation,
        color: v.color,
        catalog_product_id: v.catalog_product_id,
        parent_name: v.system_a_catalog?.name ?? null,
        parent_category: v.system_a_catalog?.product_category ?? null,
      }));

      // Fallback: system_a_catalog products (allowlist) when there are no
      // granular variations. Each catalog row is exposed as a single option.
      const { data: catalogRows } = await (supabase as any)
        .from("system_a_catalog")
        .select("id, name, slug, category, product_category, extra_data")
        .in("category", ["product", "resin", "Resinas", "consumables", "Serviços"])
        .eq("active", true)
        .limit(5000);

      const seenIds = new Set(variationOptions.map((v) => v.catalog_product_id));
      for (const c of (catalogRows || []) as any[]) {
        if (seenIds.has(c.id)) continue;
        const sku =
          c?.extra_data?.sku ||
          c?.extra_data?.SKU ||
          c?.extra_data?.codigo ||
          c.slug ||
          null;
        variationOptions.push({
          id: `cat:${c.id}`,
          sku,
          presentation: null,
          color: null,
          catalog_product_id: c.id,
          parent_name: c.name,
          parent_category: c.product_category || c.category || null,
        });
      }

      setVariations(variationOptions);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Upsert-by-name (case-insensitive) in produto_aliases. Preserves duplicates
   * by updating the newest row matching the name; creates one if none exists.
   */
  const saveMapping = useCallback(
    async (row: SkuInboxRow, variation: CatalogVariationOption | null, isKit: boolean) => {
      const nameVariant = row.sample_name.trim();
      const nomeCanonico = variation
        ? [variation.parent_name, variation.presentation].filter(Boolean).join(" — ") ||
          variation.sku ||
          nameVariant
        : nameVariant;
      const skuInterno = isKit
        ? `KIT-${nameVariant.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
        : variation?.sku ?? null;

      const { data, error } = await (supabase as any).rpc("save_produto_alias", {
        p_alias_id: row.alias_id ?? null,
        p_nome_variante: nameVariant,
        p_nome_canonico: nomeCanonico,
        p_sku_interno: skuInterno,
        p_categoria: variation?.parent_category ?? null,
        p_is_kit: isKit,
      });
      if (error) throw error;

      await load();
      return data as number;
    },
    [load],
  );

  return { rows, variations, loading, load, saveMapping };
}