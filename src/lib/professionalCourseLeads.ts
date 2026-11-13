import { supabase } from "@/integrations/supabase/client";

/** Leads gerados pelas inscrições públicas (link /inscricao e lista de espera) dos cursos do profissional. */
export interface ProfessionalCourseLeadRow {
  course_id: string;
  course_title: string;
  course_slug: string | null;
  leads: number;
  won_leads: number;
  won_deals: number;
  won_value: number;
}

export interface ProfessionalCourseLeads {
  courses: ProfessionalCourseLeadRow[];
  totals: { leads: number; wonLeads: number; wonDeals: number; wonValue: number };
}

export const EMPTY_COURSE_LEADS: ProfessionalCourseLeads = {
  courses: [],
  totals: { leads: 0, wonLeads: 0, wonDeals: 0, wonValue: 0 },
};

/** Agrupa as linhas por profissional e soma os totais (cada curso tem leads próprios). */
export function groupCourseLeadRows(rows: Array<Record<string, unknown>>): Record<string, ProfessionalCourseLeads> {
  const out: Record<string, ProfessionalCourseLeads> = {};
  for (const r of rows) {
    const pid = String(r.professional_id ?? "");
    if (!pid) continue;
    const row: ProfessionalCourseLeadRow = {
      course_id: String(r.course_id ?? ""),
      course_title: String(r.course_title ?? ""),
      course_slug: r.course_slug ? String(r.course_slug) : null,
      leads: Number(r.leads) || 0,
      won_leads: Number(r.won_leads) || 0,
      won_deals: Number(r.won_deals) || 0,
      won_value: Number(r.won_value) || 0,
    };
    const cur = (out[pid] ??= { courses: [], totals: { leads: 0, wonLeads: 0, wonDeals: 0, wonValue: 0 } });
    cur.courses.push(row);
    cur.totals.leads += row.leads;
    cur.totals.wonLeads += row.won_leads;
    cur.totals.wonDeals += row.won_deals;
    cur.totals.wonValue += row.won_value;
  }
  for (const v of Object.values(out)) v.courses.sort((a, b) => b.leads - a.leads || a.course_title.localeCompare(b.course_title));
  return out;
}

export async function fetchProfessionalCourseLeads(professionalIds: string[]): Promise<Record<string, ProfessionalCourseLeads>> {
  if (professionalIds.length === 0) return {};
  const { data, error } = await (supabase as any).rpc("fn_professional_course_lead_stats", {
    p_professional_ids: professionalIds,
  });
  if (error) throw error;
  return groupCourseLeadRows((data ?? []) as Array<Record<string, unknown>>);
}
