import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Star, Send, CheckCircle2, ThumbsUp, ThumbsDown, Minus, Sparkles, MessageSquare } from "lucide-react";
import { useNpsQuestionInsights } from "@/hooks/useNpsQuestionInsights";

interface NpsRow {
  enrollment_id: string;
  person_name: string;
  course_title: string;
  turma_label: string;
  end_date: string | null;
  sent_at: string | null;
  wa_sent_at: string | null;
  sms_sent_at: string | null;
  sms_count: number;
  status: string | null;
  responded_at: string | null;
  satisfacao: number | null;
  treinamentos: number | null;
  recomendacao: number | null;
  comment: string | null;
}

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
  const cls = recomendacao === 5 ? "Promotor" : recomendacao === 4 ? "Neutro" : "Detrator";
  const color =
    cls === "Promotor" ? "bg-emerald-500/15 text-emerald-600" : cls === "Neutro" ? "bg-amber-500/15 text-amber-600" : "bg-red-500/15 text-red-600";
  return { score: recomendacao, cls, color };
}

export function CoursesNpsTab() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "respondidos" | "pendentes" | "falhados">("todos");
  const [sending, setSending] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const enviarAgora = async (ids: string[], label: string) => {
    if (!ids.length) return;
    setSending(label);
    try {
      const { data, error } = await supabase.functions.invoke("cs-nps-sms-followup", {
        body: { enrollment_ids: ids, force: true },
      });
      if (error) throw error;
      const enviados = (data as any)?.enviados ?? 0;
      const falhas = (data as any)?.falhas ?? 0;
      if (enviados > 0) toast.success(`SMS enviado para ${enviados} participante(s).`);
      if (!enviados) toast.error(`Nenhum SMS enviado${falhas ? ` — ${falhas} falha(s)` : ""}.`);
      queryClient.invalidateQueries({ queryKey: ["smartops-nps-overview"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar SMS.");
    } finally {
      setSending(null);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["smartops-nps-overview"],
    queryFn: async (): Promise<NpsRow[]> => {
      const { data: enrollments, error } = await supabase
        .from("smartops_course_enrollments")
        .select(
          "id, person_name, nps_sent_at, nps_status, turma_id, course_id, nps_sms_count, nps_sms_last_sent_at",
        )
        .order("nps_sent_at", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) throw error;
      const rows = enrollments || [];
      const turmaIds = [...new Set(rows.map((r: any) => r.turma_id).filter(Boolean))];
      const courseIds = [...new Set(rows.map((r: any) => r.course_id).filter(Boolean))];
      const enrollmentIds = rows.map((r: any) => r.id);

      const [turmas, courses, responses] = await Promise.all([
        turmaIds.length
          ? supabase.from("smartops_course_turmas").select("id, label, end_date").in("id", turmaIds)
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length
          ? supabase.from("smartops_courses").select("id, title").in("id", courseIds)
          : Promise.resolve({ data: [] as any[] }),
        enrollmentIds.length
          ? supabase
              .from("smartops_nps_responses")
              .select("enrollment_id, created_at, score_satisfacao, score_treinamentos, score_recomendacao, comment")
              .in("enrollment_id", enrollmentIds)
              .eq("survey_type", "pos_treinamento")
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const turmaMap = new Map((turmas.data || []).map((t: any) => [t.id, t]));
      const courseMap = new Map((courses.data || []).map((c: any) => [c.id, c.title]));
      const respMap = new Map<string, any>();
      for (const r of responses.data || []) if (!respMap.has(r.enrollment_id)) respMap.set(r.enrollment_id, r);

      const today = new Date().toISOString().slice(0, 10);
      return rows
        .map((e: any) => {
          const t: any = turmaMap.get(e.turma_id);
          const r = respMap.get(e.id);
          const waSent: string | null = e.nps_sent_at ?? null;
          const smsSent: string | null = e.nps_sms_last_sent_at ?? null;
          const lastSent =
            waSent && smsSent ? (new Date(smsSent) > new Date(waSent) ? smsSent : waSent) : (smsSent ?? waSent);
          return {
            enrollment_id: e.id,
            person_name: e.person_name || "Sem nome",
            course_title: courseMap.get(e.course_id) || "—",
            turma_label: t?.label || "—",
            end_date: t?.end_date ?? null,
            sent_at: lastSent,
            wa_sent_at: waSent,
            sms_sent_at: smsSent,
            sms_count: Number(e.nps_sms_count ?? 0),
            status: e.nps_status ?? null,
            responded_at: r?.created_at ?? null,
            satisfacao: r?.score_satisfacao ?? null,
            treinamentos: r?.score_treinamentos ?? null,
            recomendacao: r?.score_recomendacao ?? null,
            comment: r?.comment ?? null,
          } as NpsRow;
        })
        // apenas turmas já encerradas (elegíveis a NPS) ou com disparo registrado
        .filter((r) => r.sent_at || (r.end_date && r.end_date < today));
    },
  });

  const rows = data || [];

  const stats = useMemo(() => {
    const disparados = rows.filter((r) => r.sent_at).length;
    const respondidos = rows.filter((r) => r.responded_at).length;
    const withScore = rows.filter((r) => r.recomendacao);
    const promotores = withScore.filter((r) => r.recomendacao === 5).length;
    const neutros = withScore.filter((r) => r.recomendacao === 4).length;
    const detratores = withScore.filter((r) => (r.recomendacao ?? 0) <= 3).length;
    const nps = withScore.length ? Math.round(((promotores - detratores) / withScore.length) * 100) : null;
    const media = withScore.length
      ? (withScore.reduce((s, r) => s + r.recomendacao!, 0) / withScore.length).toFixed(1)
      : null;
    return { disparados, respondidos, promotores, neutros, detratores, nps, media, total: withScore.length };
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
      build("Pergunta 1 — Satisfação geral com o treinamento", (r) => r.satisfacao),
      build("Pergunta 2 — Qualidade dos treinamentos/conteúdo", (r) => r.treinamentos),
      build("Pergunta 3 — Recomendaria para um colega", (r) => r.recomendacao),
    ];
  }, [rows]);

  const { insights, isLoading: insightsLoading } = useNpsQuestionInsights(
    "NPS pós-treinamento",
    questions,
    "pos_treinamento",
  );

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
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard icon={<Send className="w-4 h-4" />} label="NPS disparados" value={stats.disparados} />
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
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={sending === "lote"}
          onClick={() => enviarAgora(filtered.filter((r) => !r.responded_at).map((r) => r.enrollment_id), "lote")}
        >
          {sending === "lote" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5 mr-1.5" />}
          Enviar agora (SMS) — {filtered.filter((r) => !r.responded_at).length} sem resposta
        </Button>
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
                <th className="text-left p-3">Canal</th>
                <th className="text-left p-3">Data da resposta</th>
                <th className="text-left p-3">NPS</th>
                <th className="text-left p-3">Satisfação</th>
                <th className="text-left p-3">Treinamentos</th>
                <th className="text-left p-3">Recomendação</th>
                <th className="text-left p-3 min-w-[260px]">Observação do participante</th>
                <th className="text-left p-3">Ação</th>
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
                    <td className="p-3 whitespace-nowrap text-xs">
                      {r.wa_sent_at || r.sms_sent_at ? (
                        <div className="space-y-1">
                          {r.wa_sent_at && (
                            <div>
                              <Badge variant="secondary" className="text-[10px] mr-1">WhatsApp</Badge>
                              <span className="text-muted-foreground">{fmtDT(r.wa_sent_at)}</span>
                            </div>
                          )}
                          {r.sms_sent_at && (
                            <div>
                              <Badge variant="secondary" className="text-[10px] mr-1">
                                SMS{r.sms_count > 1 ? ` ×${r.sms_count}` : ""}
                              </Badge>
                              <span className="text-muted-foreground">{fmtDT(r.sms_sent_at)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
                          {n.score}/5 · {n.cls}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3"><Stars value={r.satisfacao} /></td>
                    <td className="p-3"><Stars value={r.treinamentos} /></td>
                    <td className="p-3"><Stars value={r.recomendacao} /></td>
                    <td className="p-3 text-muted-foreground whitespace-pre-wrap">{r.comment || "—"}</td>
                    <td className="p-3 whitespace-nowrap">
                      {r.responded_at ? (
                        <span className="text-xs text-muted-foreground">respondido</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sending === r.enrollment_id}
                          onClick={() => enviarAgora([r.enrollment_id], r.enrollment_id)}
                          title="Enviar SMS com o link exclusivo do participante"
                        >
                          {sending === r.enrollment_id
                            ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            : <MessageSquare className="w-3.5 h-3.5 mr-1.5" />}
                          Enviar agora
                        </Button>
                      )}
                    </td>
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