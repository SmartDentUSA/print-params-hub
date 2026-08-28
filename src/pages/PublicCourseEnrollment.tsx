import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star, CheckCircle2 } from "lucide-react";
import {
  QualificationFormInline,
  type QualificationSubmitPayload,
} from "@/components/forms/QualificationFormInline";

const QUALIFICATION_FORM_SLUG = "curso-online-qualificacao";

import {
  AREA_ATUACAO_OPTIONS,
  ESPECIALIDADE_OPTIONS,
  canonicalize,
} from "@/lib/dentalTaxonomy";

type LeadLookup = {
  found: boolean;
  nome?: string | null;
  area_atuacao?: string | null;
  especialidade?: string | null;
  cidade?: string | null;
  empresa?: string | null;
  email_masked?: string | null;
  telefone_masked?: string | null;
  is_client?: boolean;
  lead_exists?: boolean;
  client_reason?: string | null;
};

type Course = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  modality: string;
  cover_image_url: string | null;
  instructor_name: string | null;
};

type Turma = {
  id: string;
  label: string;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  sort_order: number;
};

type TurmaDay = {
  turma_id: string;
  day_number: number;
  date: string;
  start_time: string;
  end_time: string;
};

const formSchema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome completo").max(160),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().min(10, "Celular inválido").max(20),
});

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatTurmaDate(t: Turma, days: TurmaDay[]): string {
  const myDays = days.filter((d) => d.turma_id === t.id).sort((a, b) => a.day_number - b.day_number);
  if (myDays.length === 0 && t.start_date) {
    return new Date(`${t.start_date}T00:00:00`).toLocaleDateString("pt-BR");
  }
  if (myDays.length === 0) return t.label;
  const d0 = myDays[0];
  const dt = new Date(`${d0.date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
  return `${dt} · ${d0.start_time.slice(0, 5)} – ${d0.end_time.slice(0, 5)}`;
}

export default function PublicCourseEnrollment() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaDays, setTurmaDays] = useState<TurmaDay[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ nome: "", email: "", telefone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // After submit
  const [phase, setPhase] = useState<
    "form" | "confirm_data" | "qualify" | "nps" | "done"
  >("form");
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [showNps, setShowNps] = useState(false);
  const [lookup, setLookup] = useState<LeadLookup | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [confirmData, setConfirmData] = useState({ area_atuacao: "", especialidade: "", cidade: "" });

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const { data: c } = await (supabase as any)
        .from("smartops_courses")
        .select("id, slug, title, description, modality, cover_image_url, instructor_name, public_enrollment_enabled, active")
        .eq("slug", slug)
        .maybeSingle();
      if (!c || !c.active || !c.public_enrollment_enabled) {
        setLoading(false);
        return;
      }
      setCourse(c);
      const { data: ts } = await (supabase as any)
        .from("smartops_course_turmas")
        .select("id, label, start_date, end_date, active, sort_order")
        .eq("course_id", c.id)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      const todayStr = new Date().toISOString().slice(0, 10);
      const tlist = ((ts ?? []) as Turma[])
        .filter((t) => {
          const ref = (t.end_date || t.start_date) as string | undefined;
          return !ref || ref >= todayStr;
        })
        .sort((a, b) => (a.start_date || "9999").localeCompare(b.start_date || "9999"));
      setTurmas(tlist);
      if (tlist.length > 0) setSelectedTurma(tlist[0].id);

      if (tlist.length > 0) {
        const { data: td } = await (supabase as any)
          .from("smartops_turma_days")
          .select("turma_id, day_number, date, start_time, end_time")
          .in("turma_id", tlist.map((t) => t.id));
        setTurmaDays((td ?? []) as TurmaDay[]);
      }
      setLoading(false);
    })();
  }, [slug]);

  async function submitEnrollment(
    isClient: boolean | null,
    qualification?: QualificationSubmitPayload,
    confirmation?: { area_atuacao?: string; especialidade?: string; cidade?: string; confirmed: boolean },
  ) {
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (v && v[0]) errs[k] = v[0];
      }
      setErrors(errs);
      setPhase("form");
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("smartops-public-enrollment", {
        body: {
          course_slug: slug,
          turma_id: selectedTurma || undefined,
          nome: form.nome,
          email: form.email,
          telefone: form.telefone,
          is_client_smartdent: isClient ?? undefined,
          qualification: qualification ?? undefined,
          confirmation: confirmation ?? undefined,
        },
      });
      if (error) throw error;
      const res = data as { ok: boolean; enrollment_id: string; show_nps: boolean };
      setEnrollmentId(res.enrollment_id);
      setShowNps(res.show_nps);
      // Quem decide o NPS é o servidor: só cliente confirmado no banco e que
      // NÃO respondeu nos últimos 30 dias. Nesse caso o NPS é OBRIGATÓRIO
      // para concluir o agendamento.
      setPhase(res.show_nps ? "nps" : "done");
      toast({
        title: res.show_nps ? "Falta só a avaliação" : "Inscrição confirmada!",
        description: res.show_nps
          ? "Responda as 3 perguntas para concluir seu agendamento."
          : "Em breve você receberá os detalhes no WhatsApp.",
      });

    } catch (err: any) {
      toast({ title: "Erro", description: err.message ?? "Falha ao inscrever.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // Passo 1 → busca imediata no banco. Só quem tem cadastro de CLIENTE
  // confirmado (proposta ganha / funil CS / ERP) segue para confirmação de
  // dados + NPS. Os demais vão direto para a qualificação de lead novo.
  async function lookupAndRoute() {
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (v && v[0]) errs[k] = v[0];
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setLookingUp(true);
    try {
      const { data } = await supabase.functions.invoke("smartops-public-lead-lookup", {
        body: { email: form.email, telefone: form.telefone },
      });
      const res = (data as LeadLookup) ?? { found: false };
      setLookup(res);
      if (res.found && res.is_client !== false) {
        setConfirmData({
          area_atuacao: canonicalize(AREA_ATUACAO_OPTIONS, res.area_atuacao),
          especialidade: canonicalize(ESPECIALIDADE_OPTIONS, res.especialidade),
          cidade: res.cidade ?? "",
        });
        setPhase("confirm_data");
      } else {
        setPhase("qualify");
      }
    } catch {
      setLookup({ found: false, is_client: false });
      setPhase("qualify");
    } finally {
      setLookingUp(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Inscrição indisponível</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Esta página de inscrição não está ativa. Entre em contato com a Smart Dent.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {course.cover_image_url && (
          <img
            src={course.cover_image_url}
            alt={course.title}
            className="w-full h-48 object-cover rounded-xl border border-border"
          />
        )}
        <Card>
          <CardHeader>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {course.modality === "online_ao_vivo"
                ? "Online ao Vivo"
                : course.modality === "online"
                ? "Online"
                : course.modality.charAt(0).toUpperCase() + course.modality.slice(1)}
            </p>
            <CardTitle className="text-2xl">{course.title}</CardTitle>
            {course.instructor_name && (
              <p className="text-sm text-muted-foreground">com {course.instructor_name}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {course.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">{course.description}</p>
            )}

            {phase === "form" && (
              <>
                {turmas.length > 1 && (
                  <div className="space-y-2">
                    <Label>Escolha a data</Label>
                    <div className="grid gap-2">
                      {turmas.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTurma(t.id)}
                          className={`text-left rounded-lg border px-4 py-3 transition ${
                            selectedTurma === t.id
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="font-medium">{t.label}</div>
                          <div className="text-xs text-muted-foreground">{formatTurmaDate(t, turmaDays)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="nome">Nome completo</Label>
                    <Input
                      id="nome"
                      value={form.nome}
                      onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
                      placeholder="Seu nome"
                    />
                    {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
                  </div>
                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                      placeholder="voce@email.com"
                    />
                    {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <Label htmlFor="telefone">Celular (WhatsApp)</Label>
                    <Input
                      id="telefone"
                      value={form.telefone}
                      onChange={(e) => setForm((s) => ({ ...s, telefone: maskPhone(e.target.value) }))}
                      placeholder="(11) 98888-7777"
                      inputMode="tel"
                    />
                    {errors.telefone && <p className="text-xs text-destructive mt-1">{errors.telefone}</p>}
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={submitting || lookingUp}
                  onClick={lookupAndRoute}
                >
                  {lookingUp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Verificando seu cadastro...
                    </>
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </>
            )}


            {phase === "confirm_data" && (
              <div className="space-y-4">
                <div>
                  <p className="font-medium">
                    {lookup?.found ? "Estas informações estão corretas?" : "Complete seus dados"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {lookup?.found
                      ? "Encontramos seu cadastro na Smart Dent. Confirme ou corrija antes de continuar."
                      : "Não localizamos seu cadastro com estes contatos. Informe os dados abaixo."}
                  </p>
                </div>

                {lookup?.found && (
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-1">
                    <div><span className="text-muted-foreground">Nome: </span>{lookup.nome || form.nome}</div>
                    {lookup.empresa && (
                      <div><span className="text-muted-foreground">Empresa: </span>{lookup.empresa}</div>
                    )}
                    <div><span className="text-muted-foreground">E-mail: </span>{lookup.email_masked || form.email}</div>
                    <div><span className="text-muted-foreground">Celular: </span>{lookup.telefone_masked || form.telefone}</div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <Label>Área de atuação</Label>
                    <Select
                      value={confirmData.area_atuacao || undefined}
                      onValueChange={(v) => setConfirmData((s) => ({ ...s, area_atuacao: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione uma opção" />
                      </SelectTrigger>
                      <SelectContent>
                        {AREA_ATUACAO_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="especialidade">Especialidade</Label>
                    <Select
                      value={confirmData.especialidade || undefined}
                      onValueChange={(v) => setConfirmData((s) => ({ ...s, especialidade: v }))}
                    >
                      <SelectTrigger id="especialidade" className="mt-1">
                        <SelectValue placeholder="Selecione uma opção" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESPECIALIDADE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={submitting || !confirmData.area_atuacao}
                  onClick={() =>
                    submitEnrollment(true, undefined, {
                      area_atuacao: confirmData.area_atuacao || undefined,
                      especialidade: confirmData.especialidade.trim() || undefined,
                      confirmed: true,
                    })
                  }
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirmar e continuar
                </Button>
              </div>
            )}

            {phase === "qualify" && (
              <div className="space-y-4">
                {lookup && !lookup.found && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                    Não encontramos seu cadastro de cliente com estes contatos. Sem problema —
                    responda as perguntas abaixo para garantirmos sua vaga.
                  </div>
                )}
                <div>
                  <p className="font-medium">Antes de confirmar sua vaga</p>
                  <p className="text-sm text-muted-foreground">
                    Responda algumas perguntas rápidas para personalizarmos seu treinamento.
                  </p>
                </div>
                <QualificationFormInline
                  slug={QUALIFICATION_FORM_SLUG}
                  submitLabel="Concluir inscrição"
                  submitting={submitting}
                  onSubmit={(payload) => submitEnrollment(false, payload)}
                  onSkip={() => submitEnrollment(false)}
                />
              </div>
            )}

            {phase === "nps" && enrollmentId && (
              <NpsForm
                enrollmentId={enrollmentId}
                defaultEmail={form.email}
                onDone={() => setPhase("done")}
              />
            )}

            {phase === "done" && (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
                <h3 className="text-xl font-semibold">Inscrição confirmada!</h3>
                <p className="text-sm text-muted-foreground">
                  Enviaremos os detalhes pelo WhatsApp. Te lembraremos 1 hora antes do início.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NpsForm({
  enrollmentId,
  defaultEmail,
  onDone,
}: {
  enrollmentId: string;
  defaultEmail: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [satisf, setSatisf] = useState(0);
  const [train, setTrain] = useState(0);
  const [rec, setRec] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!satisf || !train || !rec) {
      toast({ title: "Responda as 3 perguntas", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("smartops-public-nps", {
        body: {
          enrollment_id: enrollmentId,
          email: defaultEmail,
          survey_type: "demonstracao_ao_vivo",
          score_satisfacao: satisf,
          score_treinamentos: train,
          score_recomendacao: rec,
          comment: comment || undefined,
        },
      });
      if (error) throw error;
      toast({ title: "Obrigado pela sua avaliação!" });
      onDone();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5 pt-2">
      <div className="text-center">
        <h3 className="text-lg font-semibold">NPS — Demonstrações ao Vivo</h3>
        <p className="text-sm text-muted-foreground">
          Etapa obrigatória para concluir seu agendamento (pedimos isso 1x a cada 30 dias).
        </p>
      </div>

      <NpsQuestion label="Até o momento qual o nível de satisfação com a Smart Dent?" value={satisf} onChange={setSatisf} />
      <NpsQuestion label="Como você classifica a qualidade das demonstrações e conteúdos ao vivo da Smart Dent?" value={train} onChange={setTrain} />
      <NpsQuestion label="Qual a probabilidade de você recomendar a Smart Dent para um colega?" value={rec} onChange={setRec} />
      <div>
        <Label>Comentário (opcional)</Label>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
      </div>
      <Button className="w-full" disabled={sending} onClick={send}>
        {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Enviar avaliação
      </Button>
    </div>
  );
}

function NpsQuestion({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-sm text-center">{label}</p>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-1 transition-transform hover:scale-110"
            aria-label={`${n} estrelas`}
          >
            <Star
              className={`w-8 h-8 ${
                n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}