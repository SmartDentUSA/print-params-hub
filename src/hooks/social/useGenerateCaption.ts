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
      // supabase-js stuffs the function's JSON error body into `data` even on non-2xx,
      // and `error` only carries the generic "Edge Function returned a non-2xx status".
      const serverMsg =
        (data && typeof data === "object" && "error" in data && (data as any).error) ||
        (error && (error as any).context?.responseJson?.error) ||
        null;
      if (serverMsg) throw new Error(String(serverMsg));
      if (error) throw new Error(error.message);
      return data as GenerateCaptionResult;
    },
  });
}