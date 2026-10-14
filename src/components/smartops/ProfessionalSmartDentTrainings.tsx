import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { instructorNameMatches } from "@/lib/instructorNameMatch";

type Course = { id: string; title: string; instructor_name: string | null; instructor_lead_id: string | null };
type Turma = { id: string; course_id: string; label: string | null; start_date: string | null; instructor_lead_id: string | null };
type Enr = { id: string; status: string | null; enrolled_at: string | null; course: { title: string } | null; turma: { label: string | null; start_date: string | null } | null };

const fmt = (d?: string | null) => (d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR") : "—");

/** Treinamentos Smart Dent do profissional: como aluno e como instrutor (vínculo ou sugestão por nome). */
export default function ProfessionalSmartDentTrainings({ leadId, leadName, disabled }: { leadId: string; leadName: string | null; disabled?: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [enrs, setEnrs] = useState<Enr[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = supabase as any;
    const [e, c] = await Promise.all([
      sb.from("smartops_course_enrollments")
        .select("id, status, enrolled_at, course:smartops_courses(title), turma:smartops_course_turmas(label, start_date)")
        .eq("lead_id", leadId).order("enrolled_at", { ascending: false }),
      sb.from("smartops_courses").select("id, title, instructor_name, instructor_lead_id").order("title"),
    ]);
    const all: Course[] = c.data ?? [];
    const relevant = all.filter((x) => x.instructor_lead_id === leadId || (!x.instructor_lead_id && instructorNameMatches(x.instructor_name, leadName)));
    let ts: Turma[] = [];
    const ids = all.map((x) => x.id);
    if (ids.length) {
      const { data } = await sb.from("smartops_course_turmas").select("id, course_id, label, start_date, instructor_lead_id")
        .in("course_id", relevant.map((x) => x.id).concat(["00000000-0000-0000-0000-000000000000"]));
      const { data: own } = await sb.from("smartops_course_turmas").select("id, course_id, label, start_date, instructor_lead_id").eq("instructor_lead_id", leadId);
      const map = new Map<string, Turma>();
      for (const t of [...(data ?? []), ...(own ?? [])]) map.set(t.id, t);
      ts = [...map.values()];
      for (const t of own ?? []) if (!relevant.some((r) => r.id === t.course_id)) {
        const cc = all.find((x) => x.id === t.course_id); if (cc) relevant.push(cc);
      }
    }
    setEnrs(e.data ?? []); setCourses(relevant); setTurmas(ts); setLoading(false);
  }, [leadId, leadName]);
  useEffect(() => { void load(); }, [load]);

  const link = async (table: "smartops_courses" | "smartops_course_turmas", id: string, value: string | null) => {
    setBusy(id);
    const { error } = await (supabase as any).from(table).update({ instructor_lead_id: value }).eq("id", id);
    setBusy(null);
    if (error) toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    else { toast({ title: value ? "Instrutor vinculado" : "Vínculo removido" }); void load(); }
  };

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Treinamentos Smart Dent</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
          <>
            <div>
              <p className="font-medium mb-1">Como aluno</p>
              {enrs.length === 0 ? <p className="text-muted-foreground">Nenhum registro.</p> : (
                <ul className="divide-y rounded-md border">
                  {enrs.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <span className="font-medium">{e.course?.title ?? "Treinamento"}</span>
                      {e.turma?.label && <span className="text-muted-foreground">· {e.turma.label}</span>}
                      <span className="text-muted-foreground">· {fmt(e.turma?.start_date ?? e.enrolled_at)}</span>
                      {e.status && <Badge variant="outline" className="ml-auto">{e.status}</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="font-medium mb-1">Como instrutor</p>
              {courses.length === 0 ? <p className="text-muted-foreground">Nenhum registro.</p> : (
                <ul className="space-y-2">
                  {courses.map((c) => {
                    const linked = c.instructor_lead_id === leadId;
                    return (
                      <li key={c.id} className="rounded-md border p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.title}</span>
                          <Badge variant={linked ? "secondary" : "outline"}>{linked ? "Vinculado" : `Sugestão: instrutor "${c.instructor_name}"`}</Badge>
                          <Button size="sm" variant={linked ? "ghost" : "default"} className="ml-auto" disabled={disabled || busy === c.id}
                            onClick={() => link("smartops_courses", c.id, linked ? null : leadId)}>
                            {linked ? "Desvincular" : "Vincular ao curso"}
                          </Button>
                        </div>
                        {turmas.filter((t) => t.course_id === c.id).map((t) => {
                          const tl = t.instructor_lead_id === leadId;
                          return (
                            <div key={t.id} className="flex items-center gap-2 pl-3 text-xs">
                              <span>{t.label ?? "Turma"} · {fmt(t.start_date)}</span>
                              {tl && <Badge variant="secondary">Instrutor da turma</Badge>}
                              <Button size="sm" variant="outline" className="ml-auto h-7" disabled={disabled || busy === t.id}
                                onClick={() => link("smartops_course_turmas", t.id, tl ? null : leadId)}>
                                {tl ? "Desvincular turma" : "Vincular à turma"}
                              </Button>
                            </div>
                          );
                        })}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
