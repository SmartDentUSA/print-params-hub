import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Star, Send, CheckCircle2, AlertTriangle, MessageSquare } from "lucide-react";

interface NpsRow {
  enrollment_id: string;
  person_name: string;
  course_title: string;
  turma_label: string;
  end_date: string | null;
  sent_at: string | null;
  status: string | null;
  responded_at: string | null;
  satisfacao: number | null;
  treinamentos: number | null;
  recomendacao: number | null;
  comment: string | null;
}

const ONLINE_MODALITIES = ["online", "online_ao_vivo"];

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const fmtDT = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function Stars({ value }: { value: number | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={i <= value ? "w-3.5 h-3.5 fill-amber-400 text-amber-400" : "w-3.5 h-3.5 text-muted-foreground/40"}
        />
      ))}
    </span>
  );
}

function npsLabel(recomendacao: number | null) {
  if (!recomendacao) return null;
  const nps10 = recomendacao * 2;
  const cls = nps10 >= 9 ? "Promotor" : nps10 >= 7 ? "Neutro" : "Detrator";
  const color =
    cls === "Promotor" ? "bg-emerald-500/15 text-emerald-600" : cls === "Neutro" ? "bg-amber-500/15 text-amber-600" : "bg-red-500/15 text-red-600";
  return { nps10, cls, color };
}

export function NpsDemosTab() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "respondidos" | "pendentes" | "falhados">("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["smartops-nps-demos-overview"],
    queryFn: async (): Promise<NpsRow[]> => {
      // Cursos online (origem do NPS de demonstrações ao vivo)
      const { data: onlineCourses, error: coursesErr } = await supabase
        .from("smartops_courses")
        .select("id, title")
        .in("modality", ONLINE_MODALITIES)
        .limit(1000);
      if (coursesErr) throw coursesErr;
      const onlineCourseIds = (onlineCourses || []).map((c: any) => c.id);
      if (!onlineCourseIds.length) return [];

      const { data: enrollments, error } = await supabase
        .from("smartops_course_enrollments")
        .select("id, person_name, nps_sent_at, nps_status, turma_id, course_id, created_at")
        .in("course_id", onlineCourseIds)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const rows = enrollments || [];
      const turmaIds = [...new Set(rows.map((r: any) => r.turma_id).filter(Boolean))];
      const enrollmentIds = rows.map((r: any) => r.id);

      const [turmas, responses] = await Promise.all([
        turmaIds.length
          ? supabase.from("smartops_course_turmas").select("id, label, end_date").in("id", turmaIds)
          : Promise.resolve({ data: [] as any[] }),
        enrollmentIds.length
          ? supabase
              .from("smartops_nps_responses")
              .select("enrollment_id, created_at, score_satisfacao, score_treinamentos, score_recomendacao, comment")
              .in("enrollment_id", enrollmentIds)
              .eq("survey_type", "demonstracao_ao_vivo")
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const turmaMap = new Map((turmas.data || []).map((t: any) => [t.id, t]));
      const courseMap = new Map((onlineCourses || []).map((c: any) => [c.id, c.title]));
      const respMap = new Map<string, any>();
      for (const r of responses.data || []) if (!respMap.has(r.enrollment_id)) respMap.set(r.enrollment_id, r);

      const today = new Date().toISOString().slice(0, 10);
      return rows
        .filter((e: any) => courseMap.has(e.course_id))
        .map((e: any) => {
          const t: any = turmaMap.get(e.turma_id);
          const r = respMap.get(e.id);
          return {
            enrollment_id: e.id,
            person_name: e.person_name || "Sem nome",
            course_title: courseMap.get(e.course_id) || "—",
            turma_label: t?.label || "—",
            end_date: t?.end_date ?? null,
            sent_at: e.nps_sent_at ?? null,
            status: e.nps_status ?? null,
            responded_at: r?.created_at ?? null,
            satisfacao: r?.score_satisfacao ?? null,
            treinamentos: r?.score_treinamentos ?? null,
            recomendacao: r?.score_recomendacao ?? null,
            comment: r?.comment ?? null,
          } as NpsRow;
        })
        // respondidos, disparados, ou turmas já encerradas (elegíveis a NPS)
        .filter((r) => r.responded_at || r.sent_at || (r.end_date && r.end_date < today));
    },
  });

  const rows = data || [];

  const stats = useMemo(() => {
    const disparados = rows.filter((r) => r.sent_at).length;
    const respondidos = rows.filter((r) => r.responded_at).length;
    const falhados = rows.filter((r) => !r.sent_at).length;
    const withScore = rows.filter((r) => r.recomendacao);
    const promotores = withScore.filter((r) => r.recomendacao! * 2 >= 9).length;
    const detratores = withScore.filter((r) => r.recomendacao! * 2 <= 6).length;
    const nps = withScore.length ? Math.round(((promotores - detratores) / withScore.length) * 100) : null;
    const media = withScore.length
      ? (withScore.reduce((s, r) => s + r.recomendacao! * 2, 0) / withScore.length).toFixed(1)
      : null;
    return { disparados, respondidos, falhados, nps, media, total: withScore.length };
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (filter === "respondidos" && !r.responded_at) return false;
    if (filter === "pendentes" && (!r.sent_at || r.responded_at)) return false;
    if (filter === "falhados" && r.sent_at) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.person_name, r.course_title, r.turma_label, r.comment].some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={<Send className="w-4 h-4" />} label="NPS disparados" value={stats.disparados} />
        <StatCard icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} label="Respondidos" value={stats.respondidos} />
        <StatCard icon={<AlertTriangle className="w-4 h-4 text-red-600" />} label="Falhados / não enviados" value={stats.falhados} />
        <StatCard icon={<Star className="w-4 h-4 text-amber-500" />} label="NPS (-100 a 100)" value={stats.nps ?? "—"} />
        <StatCard icon={<MessageSquare className="w-4 h-4" />} label="Nota média (0-10)" value={stats.media ?? "—"} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por participante, curso, turma ou comentário…"
          className="max-w-sm"
        />
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="respondidos">Somente respondidos</SelectItem>
            <SelectItem value="pendentes">Enviados sem resposta</SelectItem>
            <SelectItem value="falhados">Falhados / não enviados</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} registro(s)</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando NPS…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Nenhum registro de NPS encontrado.</div>
      ) : (
        <div className="rounded-xl border overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Participante</th>
                <th className="text-left p-3">Curso / Turma</th>
                <th className="text-left p-3">Data de envio</th>
                <th className="text-left p-3">Data da resposta</th>
                <th className="text-left p-3">NPS</th>
                <th className="text-left p-3">Satisfação</th>
                <th className="text-left p-3">Treinamentos</th>
                <th className="text-left p-3">Recomendação</th>
                <th className="text-left p-3 min-w-[260px]">Observação do participante</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const n = npsLabel(r.recomendacao);
                return (
                  <tr key={r.enrollment_id} className="border-t align-top">
                    <td className="p-3 font-medium">{r.person_name}</td>
                    <td className="p-3">
                      <div>{r.course_title}</div>
                      <div className="text-xs text-muted-foreground">{r.turma_label} · fim {fmt(r.end_date)}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {r.sent_at ? fmtDT(r.sent_at) : <Badge variant="destructive" className="text-[10px]">não enviado</Badge>}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {r.responded_at ? (
                        fmtDT(r.responded_at)
                      ) : r.sent_at ? (
                        <Badge variant="secondary" className="text-[10px]">aguardando</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      {n ? (
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${n.color}`}>
                          {n.nps10}/10 · {n.cls}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3"><Stars value={r.satisfacao} /></td>
                    <td className="p-3"><Stars value={r.treinamentos} /></td>
                    <td className="p-3"><Stars value={r.recomendacao} /></td>
                    <td className="p-3 text-muted-foreground whitespace-pre-wrap">{r.comment || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}