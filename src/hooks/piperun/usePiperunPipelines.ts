import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PiperunItem {
  id: string;
  name: string;
  pipeline_id?: string;
}

async function fetchPiperun(resource: string, pipelineId?: string): Promise<PiperunItem[]> {
  const params = new URLSearchParams({ resource });
  if (pipelineId) params.set("pipeline_id", pipelineId);
  const { data, error } = await supabase.functions.invoke(`piperun-list-pipelines?${params.toString()}`, {
    method: "GET",
  });
  if (error) throw error;
  return (data as any)?.items ?? [];
}

export function usePiperunPipelines() {
  return useQuery({
    queryKey: ["piperun", "pipelines"],
    queryFn: () => fetchPiperun("pipelines"),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePiperunStages(pipelineId?: string | null) {
  return useQuery({
    queryKey: ["piperun", "stages", pipelineId],
    queryFn: () => fetchPiperun("stages", pipelineId ?? undefined),
    enabled: !!pipelineId,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePiperunLossReasons() {
  return useQuery({
    queryKey: ["piperun", "loss_reasons"],
    queryFn: () => fetchPiperun("loss_reasons"),
    staleTime: 5 * 60 * 1000,
  });
}