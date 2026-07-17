import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DocCount {
  catalog: number;
  resins: number;
  total: number;
}

const SLUG_SUFFIX_RE = /-(duravel|flex|premium|hd|plus)$/i;

function normalizeName(name?: string | null): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^resina\s+3d\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugBase(slug?: string | null): string {
  if (!slug) return "";
  return slug.replace(SLUG_SUFFIX_RE, "");
}

/**
 * Contagem unificada de documentos por produto do catálogo.
 *
 * Agrega por identidade lógica para resistir a:
 *  - Linhas gêmeas em system_a_catalog (mesmo slug/nome, IDs diferentes) —
 *    catalog_documents que apontam para a gêmea inativa aparecem no card visível.
 *  - Drift de slug entre mirror e `resins` (ex.: `-duravel`) —
 *    match por slug idêntico → slug-base → nome normalizado.
 *
 * Deduplicação de docs por (file_hash || file_url).
 * Nenhum dado é modificado — apenas leitura para exibição.
 */
export function useCatalogDocCounts(
  products: Array<{ id: string; slug?: string | null; name?: string | null }>
) {
  const [counts, setCounts] = useState<Record<string, DocCount>>({});

  const key = products
    .map((p) => `${p.id}:${p.slug ?? ""}:${p.name ?? ""}`)
    .join("|");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (products.length === 0) {
        setCounts({});
        return;
      }

      // 1) Descobrir todos os system_a_catalog "irmãos" (mesmo slug OU nome normalizado)
      const slugs = Array.from(
        new Set(products.map((p) => p.slug).filter(Boolean) as string[])
      );
      const names = Array.from(
        new Set(products.map((p) => p.name).filter(Boolean) as string[])
      );

      const [siblingsBySlugRes, siblingsByNameRes] = await Promise.all([
        slugs.length > 0
          ? supabase
              .from("system_a_catalog")
              .select("id, slug, name")
              .in("slug", slugs)
          : Promise.resolve({ data: [] as any[], error: null }),
        names.length > 0
          ? supabase
              .from("system_a_catalog")
              .select("id, slug, name")
              .in("name", names)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const siblingRows: Array<{ id: string; slug: string | null; name: string | null }> = [
        ...((siblingsBySlugRes.data as any[]) || []),
        ...((siblingsByNameRes.data as any[]) || []),
      ];
      const siblingById = new Map<string, { id: string; slug: string | null; name: string | null }>();
      for (const r of siblingRows) siblingById.set(r.id, r);
      // garantir que os próprios produtos estão no set
      for (const p of products) {
        if (!siblingById.has(p.id)) {
          siblingById.set(p.id, { id: p.id, slug: p.slug ?? null, name: p.name ?? null });
        }
      }

      const allSiblingIds = Array.from(siblingById.keys());

      // 2) catalog_documents de TODOS os irmãos, deduplicados por hash/url
      const { data: catDocs } = await supabase
        .from("catalog_documents")
        .select("product_id, file_hash, file_url")
        .in("product_id", allSiblingIds)
        .eq("active", true);

      // 3) resins match: slug → slug-base → nome
      const slugBases = Array.from(
        new Set(
          Array.from(siblingById.values())
            .map((s) => slugBase(s.slug))
            .filter(Boolean)
        )
      );
      const resinLookupSlugs = Array.from(new Set([...slugs, ...slugBases]));

      const [resinsBySlugRes, resinsAllForNameRes] = await Promise.all([
        resinLookupSlugs.length > 0
          ? supabase
              .from("resins")
              .select("id, slug, name")
              .in("slug", resinLookupSlugs)
          : Promise.resolve({ data: [] as any[], error: null }),
        // fallback por nome: buscamos por prefixos comuns; usamos ilike em batches pequenos
        names.length > 0
          ? supabase
              .from("resins")
              .select("id, slug, name")
              .in("name", names)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const resinRows: Array<{ id: string; slug: string | null; name: string | null }> = [
        ...((resinsBySlugRes.data as any[]) || []),
        ...((resinsAllForNameRes.data as any[]) || []),
      ];
      const resinById = new Map<string, { id: string; slug: string | null; name: string | null }>();
      for (const r of resinRows) resinById.set(r.id, r);

      // índices para lookup
      const resinBySlug = new Map<string, string>();
      const resinBySlugBase = new Map<string, string>();
      const resinByName = new Map<string, string>();
      for (const r of resinById.values()) {
        if (r.slug) {
          resinBySlug.set(r.slug, r.id);
          const b = slugBase(r.slug);
          if (b) resinBySlugBase.set(b, r.id);
        }
        const n = normalizeName(r.name);
        if (n) resinByName.set(n, r.id);
      }

      const allResinIds = Array.from(resinById.keys());
      const { data: resinDocs } = allResinIds.length > 0
        ? await supabase
            .from("resin_documents")
            .select("resin_id, file_hash, file_url")
            .in("resin_id", allResinIds)
        : { data: [] as any[] };

      // 4) Índice: catalog_documents agrupados por sibling_id
      const catDocsBySibling = new Map<string, Array<{ hash: string | null; url: string | null }>>();
      for (const d of (catDocs as any[]) || []) {
        const arr = catDocsBySibling.get(d.product_id) || [];
        arr.push({ hash: d.file_hash ?? null, url: d.file_url ?? null });
        catDocsBySibling.set(d.product_id, arr);
      }

      const resinDocsById = new Map<string, Array<{ hash: string | null; url: string | null }>>();
      for (const d of (resinDocs as any[]) || []) {
        const arr = resinDocsById.get(d.resin_id) || [];
        arr.push({ hash: d.file_hash ?? null, url: d.file_url ?? null });
        resinDocsById.set(d.resin_id, arr);
      }

      const out: Record<string, DocCount> = {};

      for (const p of products) {
        // grupo lógico do produto: irmãos com mesmo slug OU mesmo nome normalizado
        const pName = normalizeName(p.name);
        const groupIds = new Set<string>([p.id]);
        for (const s of siblingById.values()) {
          if (p.slug && s.slug && s.slug === p.slug) groupIds.add(s.id);
          if (pName && normalizeName(s.name) === pName) groupIds.add(s.id);
        }

        // catalog docs deduplicados no grupo
        const catDedup = new Set<string>();
        for (const gid of groupIds) {
          for (const d of catDocsBySibling.get(gid) || []) {
            catDedup.add(d.hash || d.url || Math.random().toString());
          }
        }

        // resin match cascata
        const resinIdsForProduct = new Set<string>();
        if (p.slug && resinBySlug.has(p.slug)) resinIdsForProduct.add(resinBySlug.get(p.slug)!);
        const b = slugBase(p.slug);
        if (b && resinBySlugBase.has(b)) resinIdsForProduct.add(resinBySlugBase.get(b)!);
        if (pName && resinByName.has(pName)) resinIdsForProduct.add(resinByName.get(pName)!);

        const resinDedup = new Set<string>();
        for (const rid of resinIdsForProduct) {
          for (const d of resinDocsById.get(rid) || []) {
            resinDedup.add(d.hash || d.url || Math.random().toString());
          }
        }

        out[p.id] = {
          catalog: catDedup.size,
          resins: resinDedup.size,
          total: catDedup.size + resinDedup.size,
        };
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