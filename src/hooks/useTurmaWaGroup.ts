import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TurmaWaGroup {
  id: string;
  nome: string | null;
}

export function useTurmaWaGroup(turmaId: string) {
  const [group, setGroup] = useState<TurmaWaGroup | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("wa_groups" as any)
      .select("id, nome")
      .eq("turma_id", turmaId)
      .maybeSingle();
    setGroup((data as any) ?? null);
    setLoading(false);
  }, [turmaId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("wa_groups" as any)
        .select("id, nome")
        .eq("turma_id", turmaId)
        .maybeSingle();
      if (!cancelled) {
        setGroup((data as any) ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [turmaId]);

  return { group, loading, refetch, setGroup };
}