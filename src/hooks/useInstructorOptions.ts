import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InstructorSource = "team" | "kol" | "professional" | "author";

export interface InstructorOption {
  id: string;
  name: string;
  source: InstructorSource;
  detail?: string | null;
  /** Dados extras para pré-preencher fichas (palestrantes, profissionais) */
  email?: string | null;
  instagram?: string | null;
  photo_url?: string | null;
  specialty?: string | null;
  mini_bio?: string | null;
}

const SOURCE_LABEL: Record<InstructorSource, string> = {
  team: "Team Members",
  kol: "KOLs",
  professional: "Profissionais",
  author: "Autores",
};

export const INSTRUCTOR_SOURCE_LABEL = SOURCE_LABEL;

function handleFromUrl(v?: string | null): string {
  const raw = String(v || "").trim();
  if (!raw) return "";
  const cleaned = raw
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\?.*$/, "")
    .replace(/\/+$/, "")
    .replace(/^@+/, "")
    .replace(/\s+/g, "");
  return cleaned ? `@${cleaned}` : "";
}

/**
 * Lista unificada de possíveis instrutores/palestrantes: Team Members ativos, KOLs,
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
          .select("id, nome_completo, role, email")
          .eq("ativo", true)
          .order("nome_completo"),
        (supabase as any)
          .from("lia_attendances")
          .select(
            "id, nome, email, especialidade, prof_cro, prof_photo_url, prof_mini_cv, instagram, prof_kol_form_ids, prof_kol_coupons",
          )
          .not("prof_updated_at", "is", null)
          .is("merged_into", null)
          .order("prof_updated_at", { ascending: false })
          .limit(300),
        supabase
          .from("authors")
          .select("id, name, academic_title, specialty, photo_url, instagram_url, mini_bio")
          .eq("active", true)
          .order("name"),
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
        push({ id: `team:${t.id}`, name: t.nome_completo, source: "team", detail: t.role, email: t.email ?? null });
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
          email: p.email ?? null,
          instagram: handleFromUrl(p.instagram) || null,
          photo_url: p.prof_photo_url ?? null,
          specialty: p.especialidade ?? null,
          mini_bio: p.prof_mini_cv ?? null,
        });
      }
      for (const a of (authors.data ?? []) as any[]) {
        push({
          id: `author:${a.id}`,
          name: a.name,
          source: "author",
          detail: a.academic_title || a.specialty || null,
          instagram: handleFromUrl(a.instagram_url) || null,
          photo_url: a.photo_url ?? null,
          specialty: a.specialty ?? null,
          mini_bio: a.mini_bio ?? null,
        });
      }

      return out;
    },
  });
}
