import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NpsQuestionStat {
  label: string;
  counts: number[];
  total: number;
  avg: number | null;
  score: number | null;
}

/** Análise por pergunta gerada pela IA do sistema (Lovable AI Gateway). */
export function useNpsQuestionInsights(surveyLabel: string, questions: NpsQuestionStat[]) {
  const hasData = questions.some((q) => q.total > 0);
  const signature = JSON.stringify(questions.map((q) => [q.total, q.avg, q.score, q.counts]));

  const { data, isLoading } = useQuery({
    queryKey: ["nps-question-insights", surveyLabel, signature],
    enabled: hasData,
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<Record<number, string>> => {
      const { data, error } = await supabase.functions.invoke("nps-question-insight", {
        body: { survey_label: surveyLabel, questions },
      });
      if (error) throw error;
      const out: Record<number, string> = {};
      for (const it of (data as any)?.insights ?? []) {
        if (it?.analysis) out[Number(it.index)] = String(it.analysis);
      }
      return out;
    },
  });

  return { insights: data ?? {}, isLoading: hasData && isLoading };
}
