import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InstructorSource = "team" | "kol" | "professional" | "author";

export interface InstructorOption {
  id: string;
  name: string;
  source: InstructorSource;
  detail?: string | null;
}

const SOURCE_LABEL: Record<InstructorSource, string> = {
  team: "Team Members",
  kol: "KOLs",
  professional: "Profissionais",
  author: "Autores",
};

export const INSTRUCTOR_SOURCE_LABEL = SOURCE_LABEL;

/**
 * Lista unificada de possíveis instrutores: Team Members ativos, KOLs,
 * profissionais cadastrados (portal de cursos) e autores ativos.
 */
export function useInstructorOptions() {
  return useQuery({
    queryKey: ["instructor-options"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<InstructorOption[]> => {
      const [team, profs, authors] = await Promise.all([
        supabase
          .from("team_members")
          .select("id, nome_completo, role")
          .eq("ativo", true)
          .order("nome_completo"),
        (supabase as any)
          .from("lia_attendances")
          .select("id, nome, especialidade, prof_cro, prof_kol_form_ids, prof_kol_coupons")
          .not("prof_updated_at", "is", null)
          .is("merged_into", null)
          .order("prof_updated_at", { ascending: false })
          .limit(300),
        supabase.from("authors").select("id, name, title").eq("active", true).order("name"),
      ]);

      const out: InstructorOption[] = [];
      const seen = new Set<string>();
      const push = (o: InstructorOption) => {
        const name = (o.name ?? "").trim();
        if (!name) return;
        const k = name.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        out.push({ ...o, name });
      };

      for (const t of (team.data ?? []) as any[]) {
        push({ id: `team:${t.id}`, name: t.nome_completo, source: "team", detail: t.role });
      }
      for (const p of (profs.data ?? []) as any[]) {
        const isKol =
          (Array.isArray(p.prof_kol_form_ids) && p.prof_kol_form_ids.length > 0) ||
          (Array.isArray(p.prof_kol_coupons) && p.prof_kol_coupons.length > 0);
        push({
          id: `prof:${p.id}`,
          name: p.nome,
          source: isKol ? "kol" : "professional",
          detail: p.especialidade || (p.prof_cro ? `CRO ${p.prof_cro}` : null),
        });
      }
      for (const a of (authors.data ?? []) as any[]) {
        push({ id: `author:${a.id}`, name: a.name, source: "author", detail: a.title ?? null });
      }

      return out;
    },
  });
}
