import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DocCount {
  catalog: number;
  resins: number;
  total: number;
}

/**
 * Contagem unificada de documentos por produto do catálogo, somando:
 *  - catalog_documents.product_id = system_a_catalog.id
 *  - resin_documents.resin_id = resins.id (match por slug)
 *
 * Nenhum dado é modificado — apenas leitura para exibição.
 */
export function useCatalogDocCounts(products: Array<{ id: string; slug?: string | null }>) {
  const [counts, setCounts] = useState<Record<string, DocCount>>({});

  const key = products.map((p) => `${p.id}:${p.slug ?? ""}`).join("|");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (products.length === 0) {
        setCounts({});
        return;
      }
      const ids = products.map((p) => p.id);
      const slugs = products.map((p) => p.slug).filter(Boolean) as string[];

      const [catRes, resinsRes] = await Promise.all([
        supabase
          .from("catalog_documents")
          .select("product_id")
          .in("product_id", ids)
          .eq("active", true),
        slugs.length > 0
          ? supabase.from("resins").select("id, slug").in("slug", slugs)
          : Promise.resolve({ data: [] as Array<{ id: string; slug: string }>, error: null }),
      ]);

      const catalogMap: Record<string, number> = {};
      for (const r of (catRes.data as any[]) || []) {
        catalogMap[r.product_id] = (catalogMap[r.product_id] || 0) + 1;
      }

      const slugToResinId = new Map<string, string>();
      for (const r of (resinsRes.data as any[]) || []) {
        if (r?.slug) slugToResinId.set(r.slug, r.id);
      }

      const resinIds = Array.from(slugToResinId.values());
      const resinMap: Record<string, number> = {};
      if (resinIds.length > 0) {
        const { data } = await supabase
          .from("resin_documents")
          .select("resin_id")
          .in("resin_id", resinIds);
        for (const r of (data as any[]) || []) {
          resinMap[r.resin_id] = (resinMap[r.resin_id] || 0) + 1;
        }
      }

      const out: Record<string, DocCount> = {};
      for (const p of products) {
        const cat = catalogMap[p.id] || 0;
        const resinId = p.slug ? slugToResinId.get(p.slug) : undefined;
        const res = resinId ? resinMap[resinId] || 0 : 0;
        out[p.id] = { catalog: cat, resins: res, total: cat + res };
      }
      if (!cancelled) setCounts(out);
    })().catch((e) => console.warn("[useCatalogDocCounts]", e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return counts;
}