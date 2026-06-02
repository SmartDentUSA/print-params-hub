import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReadyCopy {
  id: string;
  source: "cs" | "aftersales" | "google_ads" | "seo";
  label: string;
  text: string;
}

export interface ProductKnowledgeResult {
  matched: boolean;
  product: { name: string; slug: string; category?: string; url?: string | null } | null;
  ready_copies: ReadyCopy[];
  enrichment: any | null;
}

export function useProductKnowledgeCopies(productSlug?: string, productName?: string) {
  const enabled = !!(productSlug || productName);
  return useQuery<ProductKnowledgeResult>({
    queryKey: ["social-knowledge-fetch", productSlug || "", productName || ""],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("social-knowledge-fetch", {
        body: { product_slug: productSlug, product_name: productName },
      });
      if (error) throw new Error(error.message);
      return data as ProductKnowledgeResult;
    },
  });
}