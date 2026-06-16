import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GenerateCaptionInput {
  product_name?: string;
  product_slug?: string;
  platform?: string;
  instructions?: string;
  tone?: string;
  language?: string;
  external_enrichment?: any;
}

export interface GenerateCaptionResult {
  caption: string;
  hashtags: string[];
  first_comment: string;
  fallback?: boolean;
  error?: string;
  message?: string;
  _meta?: {
    product_hits: number;
    rag_hits: number;
    export_hits?: number;
    export_matched_slug?: string | null;
    model: string;
  };
}

export function useGenerateCaption() {
  return useMutation<GenerateCaptionResult, Error, GenerateCaptionInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("social-caption-generator", {
        body: input,
      });
      // Fallback estruturado (200 com fallback:true) → erro amigável
      if (data && typeof data === "object" && (data as any).fallback) {
        const d = data as any;
        const err: any = new Error(d.message || d.error || "IA indisponível");
        err.code = d.error || "AI_UNAVAILABLE";
        err.fallback = true;
        throw err;
      }
      // supabase-js empacota o JSON de erro em `error.context.responseJson` (ou `data`)
      const serverMsg =
        (data && typeof data === "object" && "error" in data && (data as any).error) ||
        (error && (error as any).context?.responseJson?.message) ||
        (error && (error as any).context?.responseJson?.error) ||
        null;
      if (serverMsg) throw new Error(String(serverMsg));
      if (error) throw new Error(error.message);
      return data as GenerateCaptionResult;
    },
  });
}