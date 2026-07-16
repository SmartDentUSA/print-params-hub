import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OperationalFlow {
  id: string;
  flow_key: string;
  name: string;
  description: string | null;
  graph: any;
  current_version: number;
  rollout_mode: string;
  active: boolean;
  updated_at: string;
}

export function useOperationalFlowsList() {
  return useQuery({
    queryKey: ["operational_flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operational_flows")
        .select("*")
        .order("flow_key");
      if (error) throw error;
      return (data ?? []) as OperationalFlow[];
    },
    staleTime: 30_000,
  });
}

export interface SaveFlowInput {
  id: string;
  currentVersion: number;
  graph: { nodes: any[]; edges: any[] };
  rollout_mode: string;
  active: boolean;
  note?: string;
}

export function useSaveOperationalFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveFlowInput) => {
      const nextVersion = (input.currentVersion ?? 0) + 1;
      const { error: vErr } = await supabase.from("operational_flow_versions").insert({
        flow_id: input.id,
        version: nextVersion,
        graph: input.graph as any,
        status: "draft",
        note: input.note ?? null,
      });
      if (vErr) throw vErr;
      const { error: uErr } = await supabase
        .from("operational_flows")
        .update({
          graph: input.graph as any,
          current_version: nextVersion,
          rollout_mode: input.rollout_mode,
          active: input.active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (uErr) throw uErr;
      return nextVersion;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operational_flows"] });
    },
  });
}