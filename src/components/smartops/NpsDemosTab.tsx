import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Star, TrendingUp, MessageSquare, Users, CheckCircle2 } from "lucide-react";

const SURVEY_TYPE = "demonstracao_ao_vivo";
// Origem do NPS de Demonstrações: formulário público usado nos Cursos Online
const ORIGIN_FORM_SLUG = "curso-online-qualificacao";
const ONLINE_MODALITIES = ["online", "online_ao_vivo"];

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
          className={
            i <= value ? "w-3.5 h-3.5 fill-amber-400 text-amber-400" : "w-3.5 h-3.5 text-muted-foreground/40"
          }
        />
      ))}
    </span>
  );
}

function npsClass(recomendacao: number | null) {
  if (!recomendacao) return null;
  const nps10 = recomendacao * 2;
  const cls = nps10 >= 9 ? "Promotor" : nps10 >= 7 ? "Neutro" : "Detrator";
  const color =
    cls === "Promotor"
      ? "bg-emerald-500/15 text-emerald-600"
      : cls === "Neutro"
      ? "bg-amber-500/15 text-amber-600"
      : "bg-red-500/15 text-red-600";
  return { nps10, cls, color };
}

interface Row {
  id: string;
  person_name: string;
  course_id: string | null;
  course_title: string;
  created_at: string;
  satisfacao: number | null;
  demos: number | null;
  recomendacao: number | null;
  comment: string | null;
  lead_id: string | null;
}

export function NpsDemosTab() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["smartops-nps-demos"],
    queryFn: async () => {
      const { data: responses, error } = await supabase
        .from("smartops_nps_responses")
        .select(
          "id, enrollment_id, course_id, lead_id, email, score_satisfacao, score_treinamentos, score_recomendacao, comment, created_at, survey_type",
        )
        .eq("survey_type", SURVEY_TYPE)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const resp = responses || [];

      const enrollmentIds = [...new Set(resp.map((r: any) => r.enrollment_id).filter(Boolean))];
      const [enrollments, courses, recentEnrollments] = await Promise.all([
        enrollmentIds.length
          ? supabase
              .from("smartops_course_enrollments")
              .select("id, person_name, course_id")
              .in("id", enrollmentIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("smartops_courses")
          .select("id, title, modality")
          .in("modality", ONLINE_MODALITIES)
          .limit(1000),
        supabase
          .from("smartops_course_enrollments")
          .select("id, course_id, created_at, source")
          .order("created_at", { ascending: false })
          .limit(3000),
      ]);

      const enrMap = new Map((enrollments.data || []).map((e: any) => [e.id, e]));
      const courseMap = new Map((courses.data || []).map((c: any) => [c.id, c.title]));

      const rows: Row[] = resp.map((r: any) => {
        const e: any = enrMap.get(r.enrollment_id);
        return {
          id: r.id,
          person_name: e?.person_name || r.email || "Sem nome",
          course_id: r.course_id ?? e?.course_id ?? null,
          course_title: courseMap.get(r.course_id ?? e?.course_id) || "—",
          created_at: r.created_at,
          satisfacao: r.score_satisfacao ?? null,
          demos: r.score_treinamentos ?? null,
          recomendacao: r.score_recomendacao ?? null,
          comment: r.comment ?? null,
          lead_id: r.lead_id ?? null,
        };
      });

      // "Em alta": inscrições dos últimos 30 dias por curso + NPS médio
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const enrollByCourse = new Map<string, number>();
      for (const e of (recentEnrollments.data || []) as any[]) {
        if (!e.course_id || !e.created_at) continue;
        if (!courseMap.has(e.course_id)) continue; // só cursos online
        if (new Date(e.created_at).getTime() < cutoff) continue;
        enrollByCourse.set(e.course_id, (enrollByCourse.get(e.course_id) || 0) + 1);
      }

      const trending = [...enrollByCourse.entries()]
        .map(([courseId, inscritos]) => {
          const courseRows = rows.filter((r) => r.course_id === courseId && r.recomendacao);
          const promot = courseRows.filter((r) => r.recomendacao! * 2 >= 9).length;
          const detra = courseRows.filter((r) => r.recomendacao! * 2 <= 6).length;
          return {
            course_id: courseId,
            title: courseMap.get(courseId) || "—",
            inscritos,
            respostas: courseRows.length,
            nps: courseRows.length ? Math.round(((promot - detra) / courseRows.length) * 100) : null,
            media: courseRows.length
              ? (courseRows.reduce((s, r) => s + r.recomendacao! * 2, 0) / courseRows.length).toFixed(1)
              : null,
          };
        })
        .sort((a, b) => b.inscritos - a.inscritos || (b.nps ?? -101) - (a.nps ?? -101))
        .slice(0, 8);

      return { rows, trending };
    },
  });

  const rows = data?.rows || [];
  const trending = data?.trending || [];

  const stats = useMemo(() => {
    const withScore = rows.filter((r) => r.recomendacao);
    const promot = withScore.filter((r) => r.recomendacao! * 2 >= 9).length;
    const detra = withScore.filter((r) => r.recomendacao! * 2 <= 6).length;
    return {
      respondidos: rows.length,
      nps: withScore.length ? Math.round(((promot - detra) / withScore.length) * 100) : null,
      media: withScore.length
        ? (withScore.reduce((s, r) => s + r.recomendacao! * 2, 0) / withScore.length).toFixed(1)
        : null,
      comentarios: rows.filter((r) => r.comment).length,
    };
  }, [rows]);

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) =>
    !q ? true : [r.person_name, r.course_title, r.comment].some((v) => (v || "").toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Origem: formulário público <code className="font-mono">{ORIGIN_FORM_SLUG}</code> — o mesmo usado nas
        inscrições dos Cursos Online (modalidades ao vivo/online).
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} label="Respostas" value={stats.respondidos} />
        <StatCard icon={<Star className="w-4 h-4 text-amber-500" />} label="NPS (-100 a 100)" value={stats.nps ?? "—"} />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Nota média (0-10)" value={stats.media ?? "—"} />
        <StatCard icon={<MessageSquare className="w-4 h-4" />} label="Com observação" value={stats.comentarios} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> Cursos Online em alta (inscrições nos últimos 30 dias)
          </div>
          {trending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem inscrições nos últimos 30 dias.</p>
          ) : (
            <div className="space-y-2">
              {trending.map((t, i) => {
                const max = trending[0].inscritos || 1;
                return (
                  <div key={t.course_id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm gap-2">
                      <span className="truncate">
                        <span className="text-muted-foreground mr-2">#{i + 1}</span>
                        {t.title}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-[10px]">
                          <Users className="w-3 h-3 mr-1" />
                          {t.inscritos}
                        </Badge>
                        {t.nps !== null && (
                          <Badge variant="outline" className="text-[10px]">NPS {t.nps} · {t.media}/10</Badge>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.round((t.inscritos / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por participante, curso ou observação…"
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando NPS de demonstrações…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Nenhuma resposta de NPS de demonstrações ao vivo ainda.
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Participante</th>
                <th className="text-left p-3">Curso / Demonstração</th>
                <th className="text-left p-3">Data da resposta</th>
                <th className="text-left p-3">NPS</th>
                <th className="text-left p-3">Satisfação</th>
                <th className="text-left p-3">Demonstrações</th>
                <th className="text-left p-3">Recomendação</th>
                <th className="text-left p-3 min-w-[260px]">Observação do participante</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const n = npsClass(r.recomendacao);
                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-3 font-medium">{r.person_name}</td>
                    <td className="p-3">{r.course_title}</td>
                    <td className="p-3 whitespace-nowrap">{fmtDT(r.created_at)}</td>
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
                    <td className="p-3"><Stars value={r.demos} /></td>
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
