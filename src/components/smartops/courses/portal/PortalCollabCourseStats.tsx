import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Star } from "lucide-react";

interface Confirmed {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  area_atuacao: string | null;
  especialidade: string | null;
  cliente_smartdent: boolean;
}
interface WaitEntry { id: string; nome: string | null; email: string | null; telefone: string | null }
interface CollabCourse {
  course: { id: string; title: string; modality: string; cover_image_url: string | null };
  turmas: { id: string; label: string | null; start_date: string | null }[];
  metrics: {
    views: number; inscritos: number; confirmados: number; lista_espera: number;
    avaliacoes: number; avaliacao_media: number | null;
    clientes_smartdent: number; nao_clientes: number;
  };
  audience: { question: string; answers: { value: string; count: number }[] }[];
  confirmed_list: Confirmed[];
  waitlist_list: WaitEntry[];
}

const digits = (v?: string | null) => (v ?? "").replace(/\D/g, "");
const waLink = (phone: string | null, msg: string) => {
  const d = digits(phone);
  if (d.length < 10) return null;
  const full = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
};

const fmtDate = (d?: string | null) =>
  d ? d.slice(0, 10).split("-").reverse().join("/") : null;

/** Cursos em colaboração Smart Dent: métricas, perfil do público e listas de contato. */
export default function PortalCollabCourseStats({
  call, profName,
}: {
  call: (action: string, extra?: Record<string, unknown>) => Promise<any>;
  profName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CollabCourse[]>([]);

  useEffect(() => {
    let alive = true;
    call("course_stats")
      .then((d) => { if (alive) setCourses(d.collab_courses ?? []); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
  }, [call]);

  if (loading) return <Card><CardContent className="py-6"><Loader2 className="w-4 h-4 animate-spin" /></CardContent></Card>;
  if (courses.length === 0) return null;

  const firstName = profName.trim().split(/\s+/)[0] || "profissional";

  const feedbackMsg = (nome: string | null, npsUrl: string) =>
    `Olá ${(nome ?? "").split(" ")[0]}, tudo bem?\nAqui é o ${firstName}.\nO que você achou do curso?\nSe puder faça uma avaliação, seu feedback é muito importante para nós\n${npsUrl}`;
  const waitlistMsg = (nome: string | null) =>
    `Olá ${(nome ?? "").split(" ")[0]}, tudo bem?\nAqui é o ${firstName}.\nQue pena que desta vez você não consegui participar do curso, quando liberar a próxima turma, você teria interesse em participar?\nVamos avisar com 30 dias de antecedência.`;

  const logClick = (nome: string | null, courseId: string) => {
    void call("log_wa_click", { target_name: nome ?? "inscrito", course_id: courseId }).catch(() => {});
  };

  return (
    <section className="space-y-3">
      <h2 className="font-medium">Cursos em colaboração com a Smart Dent ({courses.length})</h2>
      {courses.map((c) => {
        const npsUrl = `${window.location.origin}/nps?curso=${c.course.id}`;
        return (
          <Card key={c.course.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                {c.course.title}
                <Badge variant="outline">{c.course.modality}</Badge>
                {c.turmas[0]?.start_date && <span className="text-xs text-muted-foreground font-normal">{fmtDate(c.turmas[0].start_date)}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-center">
                {[
                  ["Visualizações", c.metrics.views],
                  ["Inscritos", c.metrics.inscritos],
                  ["Confirmados", c.metrics.confirmados],
                  ["Lista de espera", c.metrics.lista_espera],
                  ["Avaliações", c.metrics.avaliacoes],
                ].map(([label, v]) => (
                  <div key={label as string} className="rounded bg-muted/40 py-1.5 px-1">
                    <div className="font-semibold">{v}</div>
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                  </div>
                ))}
                <div className="rounded bg-muted/40 py-1.5 px-1">
                  <div className="font-semibold flex items-center justify-center gap-0.5">
                    {c.metrics.avaliacao_media != null ? <><Star className="w-3 h-3 text-amber-500" />{c.metrics.avaliacao_media}</> : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Nota média</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Clientes Smart Dent: {c.metrics.clientes_smartdent}</Badge>
                <Badge variant="outline">Não clientes: {c.metrics.nao_clientes}</Badge>
              </div>

              {c.audience.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Perfil do público (respostas do formulário)</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {c.audience.map((a) => (
                      <div key={a.question} className="rounded-md border p-2.5">
                        <p className="text-xs font-medium mb-1 break-words">{a.question}</p>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {a.answers.slice(0, 8).map((ans) => (
                            <li key={ans.value} className="flex justify-between gap-2">
                              <span className="break-words">{ans.value}</span>
                              <span className="font-medium text-foreground shrink-0">{ans.count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Inscritos confirmados ({c.confirmed_list.length})</p>
                {c.confirmed_list.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum inscrito confirmado.</p> : (
                  <ul className="divide-y rounded-md border">
                    {c.confirmed_list.map((e) => {
                      const link = waLink(e.telefone, feedbackMsg(e.nome, npsUrl));
                      return (
                        <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
                          <span className="font-medium">{e.nome ?? "—"}</span>
                          {e.cliente_smartdent && <Badge variant="secondary" className="text-[10px]">Cliente Smart Dent</Badge>}
                          <span className="text-muted-foreground">{[e.email, e.area_atuacao, e.especialidade, e.telefone].filter(Boolean).join(" · ")}</span>
                          {link && (
                            <Button asChild size="sm" variant="outline" className="ml-auto h-7">
                              <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => logClick(e.nome, c.course.id)}>
                                <MessageCircle className="w-3.5 h-3.5 mr-1" /> Chamar no WhatsApp
                              </a>
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Lista de espera ({c.waitlist_list.length})</p>
                {c.waitlist_list.length === 0 ? <p className="text-xs text-muted-foreground">Lista de espera vazia.</p> : (
                  <ul className="divide-y rounded-md border">
                    {c.waitlist_list.map((w) => {
                      const link = waLink(w.telefone, waitlistMsg(w.nome));
                      return (
                        <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
                          <span className="font-medium">{w.nome ?? "—"}</span>
                          <span className="text-muted-foreground">{[w.email, w.telefone].filter(Boolean).join(" · ")}</span>
                          {link && (
                            <Button asChild size="sm" variant="outline" className="ml-auto h-7">
                              <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => logClick(w.nome, c.course.id)}>
                                <MessageCircle className="w-3.5 h-3.5 mr-1" /> Chamar no WhatsApp
                              </a>
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
