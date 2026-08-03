import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TurmaParticipant {
  key: string;
  enrollment_id: string;
  companion_id: string | null;
  name: string;
  type: "principal" | "acompanhante";
  status: string | null;
  instagram: string | null;
}

const BLOCKED = ["cancelado", "cancelada", "ausente", "no_show"];

export function isBlockedStatus(status?: string | null) {
  return BLOCKED.includes(String(status || "").toLowerCase());
}

export function useTurmaParticipants(turmaId: string, enabled = true) {
  return useQuery({
    queryKey: ["turma-participants-media", turmaId],
    enabled: enabled && !!turmaId,
    queryFn: async (): Promise<TurmaParticipant[]> => {
      const { data: enrollments, error } = await supabase
        .from("smartops_course_enrollments")
        .select("id, person_name, instagram, status")
        .eq("turma_id", turmaId)
        .order("person_name");
      if (error) throw error;

      const ids = (enrollments || []).map((e) => e.id);
      let companions: any[] = [];
      if (ids.length) {
        const { data: comps, error: cErr } = await supabase
          .from("smartops_enrollment_companions")
          .select("id, name, instagram, enrollment_id")
          .in("enrollment_id", ids);
        if (cErr) throw cErr;
        companions = comps || [];
      }

      const list: TurmaParticipant[] = [];
      for (const e of enrollments || []) {
        list.push({
          key: `e:${e.id}`,
          enrollment_id: e.id,
          companion_id: null,
          name: e.person_name || "Sem nome",
          type: "principal",
          status: e.status ?? null,
          instagram: e.instagram ?? null,
        });
        for (const c of companions.filter((c) => c.enrollment_id === e.id)) {
          list.push({
            key: `c:${c.id}`,
            enrollment_id: e.id,
            companion_id: c.id,
            name: c.name || "Acompanhante",
            type: "acompanhante",
            status: e.status ?? null,
            instagram: c.instagram ?? null,
          });
        }
      }
      return list;
    },
  });
}
