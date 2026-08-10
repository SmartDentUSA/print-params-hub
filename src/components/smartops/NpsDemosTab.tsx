import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Star, CheckCircle2, ThumbsUp, ThumbsDown, Minus, Sparkles } from "lucide-react";
import { useNpsQuestionInsights } from "@/hooks/useNpsQuestionInsights";

interface NpsRow {
  enrollment_id: string;
  person_name: string;
  email: string | null;
  lead_id: string | null;
  course_title: string;
  turma_label: string;
  end_date: string | null;
  enrolled_at: string | null;
  responded_at: string | null;
  satisfacao: number | null;
  treinamentos: number | null;
  recomendacao: number | null;
  comment: string | null;
}

interface Participant {
  key: string;
  name: string;
  email: string | null;
  demos: number;
  lastResponse: string | null;
  lastDays: number | null;
  satisfacao: number | null;
  treinamentos: number | null;
  recomendacao: number | null;
  comment: string | null;
}

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
          className={i <= value ? "w-3.5 h-3.5 fill-amber-400 text-amber-400" : "w-3.5 h-3.5 text-muted-foreground/40"}
        />
      ))}
    </span>
  );
}

function npsLabel(recomendacao: number | null) {
  if (!recomendacao) return null;
  const cls = recomendacao === 5 ? "Promotor" : recomendacao === 4 ? "Neutro" : "Detrator";
  const color =
    cls === "Promotor"
      ? "bg-emerald-500/15 text-emerald-600"
      : cls === "Neutro"
      ? "bg-amber-500/15 text-amber-600"
      : "bg-red-500/15 text-red-600";
  return { score: recomendacao, cls, color };
}

const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

export function NpsDemosTab() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["smartops-nps-demos-overview"],
    queryFn: async () => {
      // Cursos online (origem do NPS de demonstrações ao vivo)
      const { data: onlineCourses, error: coursesErr } = await supabase
        .from("smartops_courses")
        .select("id, title")
        .in("modality", ONLINE_MODALITIES)
        .limit(1000);
      if (coursesErr) throw coursesErr;
      const onlineCourseIds = (onlineCourses || []).map((c: any) => c.id);
      if (!onlineCourseIds.length) return { rows: [] as NpsRow[], participants: [] as Participant[] };

      const { data: enrollments, error } = await supabase
        .from("smartops_course_enrollments")
        .select("id, person_name, turma_id, course_id, created_at, lead_id")
        .in("course_id", onlineCourseIds)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const enrollRows = enrollments || [];
      const turmaIds = [...new Set(enrollRows.map((r: any) => r.turma_id).filter(Boolean))];
      const enrollmentIds = enrollRows.map((r: any) => r.id);
      const leadIds = [...new Set(enrollRows.map((r: any) => r.lead_id).filter(Boolean))];

      const [turmas, responses, overrides, leads] = await Promise.all([
        turmaIds.length
          ? supabase.from("smartops_course_turmas").select("id, label, end_date").in("id", turmaIds)
          : Promise.resolve({ data: [] as any[] }),
        enrollmentIds.length
          ? supabase
              .from("smartops_nps_responses")
              .select(
                "enrollment_id, lead_id, email, created_at, score_satisfacao, score_treinamentos, score_recomendacao, comment"
              )
              .in("enrollment_id", enrollmentIds)
              .eq("survey_type", "demonstracao_ao_vivo")
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("smartops_nps_demo_overrides").select("email, force_next"),
        leadIds.length
          ? supabase.from("lia_attendances").select("id, email").in("id", leadIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const turmaMap = new Map((turmas.data || []).map((t: any) => [t.id, t]));
      const leadEmailMap = new Map<string, string | null>((leads.data || []).map((l: any) => [l.id, l.email ?? null]));
      const courseMap = new Map((onlineCourses || []).map((c: any) => [c.id, c.title]));
      const respMap = new Map<string, any>();
      for (const r of responses.data || []) if (!respMap.has(r.enrollment_id)) respMap.set(r.enrollment_id, r);
      const overrideMap = new Map<string, boolean>(
        (overrides.data || []).map((o: any) => [String(o.email).toLowerCase(), !!o.force_next])
      );

      const all: NpsRow[] = enrollRows
        .filter((e: any) => courseMap.has(e.course_id))
        .map((e: any) => {
          const t: any = turmaMap.get(e.turma_id);
          const r = respMap.get(e.id);
          return {
            enrollment_id: e.id,
            person_name: e.person_name || "Sem nome",
            email: r?.email ?? leadEmailMap.get(e.lead_id) ?? null,
            lead_id: e.lead_id ?? r?.lead_id ?? null,
            course_title: courseMap.get(e.course_id) || "—",
            turma_label: t?.label || "—",
            end_date: t?.end_date ?? null,
            enrolled_at: e.created_at ?? null,
            responded_at: r?.created_at ?? null,
            satisfacao: r?.score_satisfacao ?? null,
            treinamentos: r?.score_treinamentos ?? null,
            recomendacao: r?.score_recomendacao ?? null,
            comment: r?.comment ?? null,
          } as NpsRow;
        });

      // Participantes: agrupa por e-mail (fallback lead_id / nome)
      const byKey = new Map<string, Participant & { forceNext: boolean }>();
      for (const r of all) {
        const key = (r.email || r.lead_id || r.person_name).toString().toLowerCase();
        const cur = byKey.get(key);
        if (!cur) {
          byKey.set(key, {
            key,
            name: r.person_name,
            email: r.email,
            demos: 1,
            lastResponse: r.responded_at,
            lastDays: r.responded_at ? daysSince(r.responded_at) : null,
            satisfacao: r.satisfacao,
            treinamentos: r.treinamentos,
            recomendacao: r.recomendacao,
            comment: r.comment,
            forceNext: r.email ? overrideMap.get(r.email.toLowerCase()) ?? false : false,
          });
        } else {
          cur.demos += 1;
          if (!cur.email && r.email) {
            cur.email = r.email;
            cur.forceNext = overrideMap.get(r.email.toLowerCase()) ?? false;
          }
          if (r.responded_at && (!cur.lastResponse || r.responded_at > cur.lastResponse)) {
            cur.lastResponse = r.responded_at;
            cur.lastDays = daysSince(r.responded_at);
            cur.satisfacao = r.satisfacao;
            cur.treinamentos = r.treinamentos;
            cur.recomendacao = r.recomendacao;
            cur.comment = r.comment;
          }
        }
      }

      const participants = [...byKey.values()].sort((a, b) => {
        if (!!b.lastResponse !== !!a.lastResponse) return b.lastResponse ? 1 : -1;
        return (b.lastResponse || "").localeCompare(a.lastResponse || "");
      });

      // KPIs e gráficos representam a última avaliação de cada participante.
      // Avaliações anteriores continuam preservadas no banco, mas não duplicam o resultado atual.
      const latestRows: NpsRow[] = participants
        .filter((p) => p.lastResponse)
        .map((p) => ({
          enrollment_id: p.key,
          person_name: p.name,
          email: p.email,
          lead_id: null,
          course_title: "—",
          turma_label: "—",
          end_date: null,
          enrolled_at: null,
          responded_at: p.lastResponse,
          satisfacao: p.satisfacao,
          treinamentos: p.treinamentos,
          recomendacao: p.recomendacao,
          comment: p.comment,
        }));
      return { rows: latestRows, participants };
    },
  });

  const rows = data?.rows || [];
  const participants = (data?.participants || []) as (Participant & { forceNext: boolean })[];

  const stats = useMemo(() => {
    const respondidos = rows.length;
    const withScore = rows.filter((r) => r.recomendacao);
    const promotores = withScore.filter((r) => r.recomendacao === 5).length;
    const neutros = withScore.filter((r) => r.recomendacao === 4).length;
    const detratores = withScore.filter((r) => (r.recomendacao ?? 0) <= 3).length;
    const nps = withScore.length ? Math.round(((promotores - detratores) / withScore.length) * 100) : null;
    const media = withScore.length
      ? (withScore.reduce((s, r) => s + r.recomendacao!, 0) / withScore.length).toFixed(1)
      : null;
    return { respondidos, promotores, neutros, detratores, nps, media };
  }, [rows]);

  const questions = useMemo(() => {
    const build = (label: string, pick: (r: NpsRow) => number | null) => {
      const values = rows.map(pick).filter((v): v is number => !!v);
      const counts = [1, 2, 3, 4, 5].map((s) => values.filter((v) => v === s).length);
      const total = values.length;
      const avg = total ? values.reduce((a, b) => a + b, 0) / total : null;
      // Cada estrela mantém seu valor literal: 1→1, 2→2, 3→3, 4→4 e 5→5.
      const score = avg;
      return { label, counts, total, avg, score };
    };
    return [
      build("Pergunta 1 — Satisfação com a demonstração", (r) => r.satisfacao),
      build("Pergunta 2 — Qualidade dos treinamentos/conteúdo", (r) => r.treinamentos),
      build("Pergunta 3 — Recomendaria para um colega", (r) => r.recomendacao),
    ];
  }, [rows]);

  const { insights, isLoading: insightsLoading } = useNpsQuestionInsights(
    "Treinamentos Online",
    questions,
    "demonstracao_ao_vivo",
  );

  const filtered = participants.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [p.name, p.email, p.comment].some((v) => (v || "").toLowerCase().includes(q));
  });

  const toggleForce = async (p: Participant & { forceNext: boolean }, next: boolean) => {
    if (!p.email) {
      toast.error("Participante sem e-mail — não é possível controlar o NPS obrigatório.");
      return;
    }
    const email = p.email.toLowerCase();
    const { error } = await supabase
      .from("smartops_nps_demo_overrides")
      .upsert({ email, force_next: next, updated_at: new Date().toISOString() }, { onConflict: "email" });
    if (error) {
      toast.error("Falha ao salvar: " + error.message);
      return;
    }
    toast.success(next ? "NPS obrigatório liberado no próximo agendamento." : "NPS obrigatório desativado.");
    queryClient.invalidateQueries({ queryKey: ["smartops-nps-demos-overview"] });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} label="Respondidos" value={stats.respondidos} />
        <StatCard icon={<ThumbsUp className="w-4 h-4 text-emerald-600" />} label="Promotores" value={stats.promotores} />
        <StatCard icon={<Minus className="w-4 h-4 text-amber-600" />} label="Neutros" value={stats.neutros} />
        <StatCard icon={<ThumbsDown className="w-4 h-4 text-red-600" />} label="Detratores" value={stats.detratores} />
        <StatCard icon={<Star className="w-4 h-4 text-amber-500" />} label="Nota média (1-5)" value={stats.media ?? "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {questions.map((q, i) => (
          <QuestionDistribution
            key={q.label}
            {...q}
            insight={insights[i] ?? null}
            insightLoading={insightsLoading}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar participante, e-mail ou observação…"
          className="max-w-sm"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} participante(s)</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando NPS…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Nenhum participante encontrado.</div>
      ) : (
        <div className="rounded-xl border overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Participante</th>
                <th className="text-left p-3">Demonstrações inscritas</th>
                <th className="text-left p-3">Última avaliação</th>
                <th className="text-left p-3">NPS obrigatório no próximo agendamento</th>
                <th className="text-left p-3">NPS</th>
                <th className="text-left p-3">Satisfação</th>
                <th className="text-left p-3">Treinamentos</th>
                <th className="text-left p-3">Recomendação</th>
                <th className="text-left p-3 min-w-[260px]">Observação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const n = npsLabel(p.recomendacao);
                return (
                  <tr key={p.key} className="border-t align-top">
                    <td className="p-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.email || "sem e-mail"}</div>
                    </td>
                    <td className="p-3 font-semibold">{p.demos}</td>
                    <td className="p-3 whitespace-nowrap">
                      {p.lastResponse ? (
                        <>
                          <div>{p.lastDays === 0 ? "hoje" : `${p.lastDays} dia(s)`}</div>
                          <div className="text-xs text-muted-foreground">{fmtDT(p.lastResponse)}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">sem avaliação</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={p.forceNext}
                          disabled={!p.email}
                          onCheckedChange={(v) => toggleForce(p, v)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {p.forceNext ? "liberado" : "seguir regra de 30 dias"}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      {n ? (
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${n.color}`}>
                          {n.score}/5 · {n.cls}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3"><Stars value={p.satisfacao} /></td>
                    <td className="p-3"><Stars value={p.treinamentos} /></td>
                    <td className="p-3"><Stars value={p.recomendacao} /></td>
                    <td className="p-3 text-muted-foreground whitespace-pre-wrap">{p.comment || "—"}</td>
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

function QuestionDistribution({
  label,
  counts,
  total,
  avg,
  score,
  insight,
  insightLoading,
}: {
  label: string;
  counts: number[];
  total: number;
  avg: number | null;
  score: number | null;
  insight?: string | null;
  insightLoading?: boolean;
}) {
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  const tone = (i: number) =>
    i >= 4 ? "bg-emerald-500" : i === 3 ? "bg-emerald-500/30" : i === 2 ? "bg-muted-foreground/40" : "bg-muted";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground line-clamp-2">{label}</div>
            <div className="text-2xl font-bold mt-1">{score != null ? `${score.toFixed(1)}/5` : "—"}</div>
            <div className="text-xs text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">{total}</span> resposta(s)
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-24">
            {[1, 2, 3, 4, 5].map((s, i) => (
              <div key={s} className="flex flex-col items-center justify-end w-9 h-full">
                <div className="text-[10px] text-muted-foreground mb-1">{s}</div>
                <div className="relative w-full flex-1 rounded-sm bg-muted/40 flex items-end overflow-hidden">
                  <div
                    className={`w-full rounded-sm ${tone(i)}`}
                    style={{ height: `${Math.max(pct(counts[i]), counts[i] ? 4 : 2)}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 leading-tight text-center">{counts[i]}<br />{pct(counts[i]).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          {insightLoading ? (
            <span className="italic">Analisando com IA…</span>
          ) : insight ? (
            <span className="leading-relaxed">{insight}</span>
          ) : (
            <span className="italic">Análise indisponível.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
