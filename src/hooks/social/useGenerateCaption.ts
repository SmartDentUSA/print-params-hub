import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GenerateCaptionInput {
  product_name?: string;
  product_slug?: string;
  platform?: string;
  instructions?: string;
  tone?: string;
  language?: string;
}

export interface GenerateCaptionResult {
  caption: string;
  hashtags: string[];
  first_comment: string;
  _meta?: { product_hits: number; rag_hits: number; model: string };
}

export function useGenerateCaption() {
  return useMutation<GenerateCaptionResult, Error, GenerateCaptionInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("social-caption-generator", {
        body: input,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as GenerateCaptionResult;
    },
  });
}