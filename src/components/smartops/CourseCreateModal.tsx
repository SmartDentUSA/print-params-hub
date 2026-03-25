import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, CalendarDays, Image } from "lucide-react";
import { slugify, buildCourseTag, MODALITY_CONFIG } from "@/lib/courseUtils";
import {
  TEMPLATE_VARIABLES, DEFAULT_ENROLLMENT_TEMPLATE,
  interpolateTemplate, buildCronogramaText,
} from "@/lib/courseWhatsapp";
import type { SmartopsCourse, TurmaDay } from "@/types/courses";

interface LocalTurma {
  id?: string;
  label: string;
  slots: number;
  sellflux_tag: string;
  whatsapp_group_link: string;
  sort_order: number;
  enrolled_count: number;
  days: LocalDay[];
}

interface LocalDay {
  id?: string;
  day_number: number;
  date: string;
  start_time: string;
  end_time: string;
  topic: string;
}

interface Props {
  open: boolean;
  course: SmartopsCourse | null;
  onClose: () => void;
}

const MODALITIES = [
  { value: "presencial", label: "Presencial" },
  { value: "online_ao_vivo", label: "Online ao Vivo" },
  { value: "online", label: "Online" },
] as const;

const CATEGORIES = [
  { value: "treinamento", label: "Treinamento" },
  { value: "imersao", label: "Imersão" },
  { value: "workshop", label: "Workshop" },
  { value: "webinar", label: "Webinar" },
] as const;

export function CourseCreateModal({ open, course, onClose }: Props) {
  const isEdit = !!course;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  // Course fields
  const [title, setTitle] = useState("");
  const [modality, setModality] = useState<string>("presencial");
  const [category, setCategory] = useState<string>("treinamento");
  const [description, setDescription] = useState("");
  const [instructorName, setInstructorName] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [durationDays, setDurationDays] = useState(1);
  const [durationHoursPerDay, setDurationHoursPerDay] = useState<number | undefined>(undefined);
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [whatsappGroupLink, setWhatsappGroupLink] = useState("");
  const [pipelineId, setPipelineId] = useState(83896);
  const [stageAfterEnroll, setStageAfterEnroll] = useState("treinamento_agendado");
  const [publicVisible, setPublicVisible] = useState(false);
  const [waTemplate, setWaTemplate] = useState(DEFAULT_ENROLLMENT_TEMPLATE);

  // Turmas
  const [turmas, setTurmas] = useState<LocalTurma[]>([]);
  const [turmasLoading, setTurmasLoading] = useState(false);

  // Load existing course data
  useEffect(() => {
    if (!course) {
      // Reset for new
      setTitle(""); setModality("presencial"); setCategory("treinamento");
      setDescription(""); setInstructorName(""); setCoverImageUrl("");
      setDurationDays(1); setDurationHoursPerDay(undefined);
      setLocation(""); setMeetingLink(""); setWhatsappGroupLink("");
      setPipelineId(83896); setStageAfterEnroll("treinamento_agendado");
      setPublicVisible(false); setWaTemplate(DEFAULT_ENROLLMENT_TEMPLATE);
      setTurmas([]);
      return;
    }
    setTitle(course.title);
    setModality(course.modality);
    setCategory(course.category || "treinamento");
    setDescription(course.description || "");
    setInstructorName(course.instructor_name || "");
    setCoverImageUrl(course.cover_image_url || "");
    setDurationDays(course.duration_days);
    setDurationHoursPerDay(course.duration_hours_per_day);
    setLocation(course.location || "");
    setMeetingLink(course.meeting_link || "");
    setWhatsappGroupLink(course.whatsapp_group_link || "");
    setPipelineId(course.pipeline_id_kanban);
    setStageAfterEnroll(course.stage_after_enroll);
    setPublicVisible(course.public_visible);
    setWaTemplate(course.whatsapp_message_template || DEFAULT_ENROLLMENT_TEMPLATE);

    // Load turmas
    loadTurmas(course.id);
  }, [course]);

  const loadTurmas = async (courseId: string) => {
    setTurmasLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("smartops_course_turmas")
        .select("*, days:smartops_turma_days(*)")
        .eq("course_id", courseId)
        .eq("active", true)
        .order("sort_order");

      setTurmas(
        (data ?? []).map((t: any) => ({
          id: t.id,
          label: t.label,
          slots: t.slots,
          sellflux_tag: t.sellflux_tag || "",
          whatsapp_group_link: t.whatsapp_group_link || "",
          sort_order: t.sort_order,
          enrolled_count: t.enrolled_count,
          days: (t.days ?? [])
            .sort((a: TurmaDay, b: TurmaDay) => a.day_number - b.day_number)
            .map((d: any) => ({
              id: d.id,
              day_number: d.day_number,
              date: d.date,
              start_time: d.start_time?.substring(0, 5) || "",
              end_time: d.end_time?.substring(0, 5) || "",
              topic: d.topic || "",
            })),
        }))
      );
    } finally {
      setTurmasLoading(false);
    }
  };

  // ─── Turma management ───
  const addTurma = () => {
    const idx = turmas.length;
    setTurmas((prev) => [
      ...prev,
      {
        label: `Turma ${idx + 1}`,
        slots: 20,
        sellflux_tag: buildCourseTag(title),
        whatsapp_group_link: "",
        sort_order: idx,
        enrolled_count: 0,
        days: [{ day_number: 1, date: "", start_time: "09:00", end_time: "17:00", topic: "" }],
      },
    ]);
  };

  const removeTurma = (tIdx: number) => {
    const t = turmas[tIdx];
    if (t.id && t.enrolled_count > 0) {
      toast({ title: "Não é possível remover", description: "Esta turma possui inscritos.", variant: "destructive" });
      return;
    }
    // Turma existente sem inscritos: soft delete via active=false (handled on save)
    // Turma nova: just remove from list
    if (!t.id) {
      setTurmas((prev) => prev.filter((_, i) => i !== tIdx));
    } else {
      // Mark for soft delete
      setTurmas((prev) => prev.filter((_, i) => i !== tIdx));
      // Will set active=false on save
      softDeleteIds.current.push(t.id);
    }
  };

  const softDeleteIds = useRef<string[]>([]);

  const updateTurma = (tIdx: number, field: string, value: any) => {
    setTurmas((prev) => prev.map((t, i) => (i === tIdx ? { ...t, [field]: value } : t)));
  };

  const addDay = (tIdx: number) => {
    setTurmas((prev) =>
      prev.map((t, i) => {
        if (i !== tIdx) return t;
        const lastDay = t.days[t.days.length - 1];
        let nextDate = "";
        if (lastDay?.date) {
          const d = new Date(lastDay.date + "T12:00:00");
          d.setDate(d.getDate() + 1);
          nextDate = d.toISOString().substring(0, 10);
        }
        return {
          ...t,
          days: [
            ...t.days,
            {
              day_number: t.days.length + 1,
              date: nextDate,
              start_time: lastDay?.start_time || "09:00",
              end_time: lastDay?.end_time || "17:00",
              topic: "",
            },
          ],
        };
      })
    );
  };

  const removeDay = (tIdx: number, dIdx: number) => {
    setTurmas((prev) =>
      prev.map((t, i) => {
        if (i !== tIdx) return t;
        const newDays = t.days.filter((_, di) => di !== dIdx).map((d, di) => ({ ...d, day_number: di + 1 }));
        return { ...t, days: newDays };
      })
    );
  };

  const updateDay = (tIdx: number, dIdx: number, field: string, value: string) => {
    setTurmas((prev) =>
      prev.map((t, i) => {
        if (i !== tIdx) return t;
        const newDays = t.days.map((d, di) => (di === dIdx ? { ...d, [field]: value } : d));
        return { ...t, days: newDays };
      })
    );
  };

  // ─── WA template insert variable ───
  const insertVariable = (key: string) => {
    const ta = templateRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = waTemplate.substring(0, start);
    const after = waTemplate.substring(end);
    setWaTemplate(before + key + after);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + key.length, start + key.length);
    }, 0);
  };

  // ─── WA preview ───
  const waPreview = (() => {
    const firstTurma = turmas[0];
    const days = firstTurma?.days ?? [];
    const cronograma = buildCronogramaText(
      days.map((d) => ({ ...d, turma_id: "", id: "" })) as TurmaDay[],
      firstTurma?.label || "Turma 1"
    );
    return interpolateTemplate(waTemplate, {
      nome: "Dr. João Silva",
      curso: title || "Curso",
      turma_label: firstTurma?.label || "Turma 1",
      instrutor: instructorName || "Instrutor",
      local: modality === "presencial" ? (location || "Local") : (meetingLink || "Link"),
      cronograma,
      duracao: `${durationDays} dia${durationDays > 1 ? "s" : ""}`,
      data_inicio: days[0]?.date || "",
      data_fim: days[days.length - 1]?.date || "",
      horario_inicio: days[0]?.start_time || "09:00",
      grupo_whatsapp: firstTurma?.whatsapp_group_link || whatsappGroupLink || "",
      cs_nome: "CS",
    });
  })();

  // ─── Save ───
  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // PASSO 1: INSERT/UPDATE curso
      const coursePayload = {
        title: title.trim(),
        ...(isEdit ? {} : { slug: slugify(title.trim()) }),
        description: description || null,
        modality,
        category,
        instructor_name: instructorName || null,
        cover_image_url: coverImageUrl || null,
        max_capacity: turmas[0]?.slots || 20,
        duration_days: durationDays,
        duration_hours_per_day: durationHoursPerDay || null,
        location: location || null,
        meeting_link: meetingLink || null,
        whatsapp_group_link: whatsappGroupLink || null,
        whatsapp_message_template: waTemplate !== DEFAULT_ENROLLMENT_TEMPLATE ? waTemplate : null,
        pipeline_id_kanban: pipelineId,
        stage_after_enroll: stageAfterEnroll,
        public_visible: publicVisible,
        active: true,
        ...(isEdit ? {} : { created_by: user.id }),
      };

      let courseId: string;
      if (isEdit) {
        const { error } = await (supabase as any)
          .from("smartops_courses")
          .update(coursePayload)
          .eq("id", course!.id);
        if (error) throw error;
        courseId = course!.id;
      } else {
        const { data, error } = await (supabase as any)
          .from("smartops_courses")
          .insert(coursePayload)
          .select("id")
          .single();
        if (error) throw error;
        courseId = data.id;
      }

      // Soft delete turmas removidas
      for (const id of softDeleteIds.current) {
        await (supabase as any)
          .from("smartops_course_turmas")
          .update({ active: false })
          .eq("id", id);
      }

      // PASSO 2: INSERT/UPDATE turmas
      for (const turma of turmas) {
        let turmaId: string;

        if (turma.id) {
          // UPDATE existing turma
          await (supabase as any)
            .from("smartops_course_turmas")
            .update({
              label: turma.label,
              slots: turma.slots,
              sellflux_tag: turma.sellflux_tag || null,
              whatsapp_group_link: turma.whatsapp_group_link || null,
              sort_order: turma.sort_order,
            })
            .eq("id", turma.id);
          turmaId = turma.id;

          // UPDATE/INSERT days
          for (const day of turma.days) {
            if (day.id) {
              await (supabase as any)
                .from("smartops_turma_days")
                .update({
                  day_number: day.day_number,
                  date: day.date,
                  start_time: day.start_time,
                  end_time: day.end_time,
                  topic: day.topic || null,
                })
                .eq("id", day.id);
            } else {
              await (supabase as any)
                .from("smartops_turma_days")
                .insert({
                  turma_id: turmaId,
                  day_number: day.day_number,
                  date: day.date,
                  start_time: day.start_time,
                  end_time: day.end_time,
                  topic: day.topic || null,
                });
            }
          }
        } else {
          // INSERT new turma
          const { data: newTurma, error: eTurma } = await (supabase as any)
            .from("smartops_course_turmas")
            .insert({
              course_id: courseId,
              label: turma.label,
              slots: turma.slots,
              sellflux_tag: turma.sellflux_tag || null,
              whatsapp_group_link: turma.whatsapp_group_link || null,
              sort_order: turma.sort_order,
            })
            .select("id")
            .single();
          if (eTurma) throw eTurma;
          turmaId = newTurma.id;

          // PASSO 3: INSERT days (batch)
          if (turma.days.length > 0) {
            const daysPayload = turma.days.map((d) => ({
              turma_id: turmaId,
              day_number: d.day_number,
              date: d.date,
              start_time: d.start_time,
              end_time: d.end_time,
              topic: d.topic || null,
            }));
            const { error: eDays } = await (supabase as any)
              .from("smartops_turma_days")
              .insert(daysPayload);
            if (eDays) throw eDays;
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["smartops_courses"] });
      qc.invalidateQueries({ queryKey: ["v_turmas_com_vagas"] });
      toast({ title: isEdit ? "Curso atualizado!" : "Curso criado!" });
      onClose();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Curso" : "Novo Curso"}</DialogTitle>
        </DialogHeader>

          <div className="space-y-6 pb-4">
            {/* ─── Dados do curso ─── */}
            <div className="space-y-4">
              <div>
                <Label>Título *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Treinamento Scanner Intraoral" />
                {isEdit && (
                  <p className="text-xs text-muted-foreground mt-1">Slug: {course?.slug} (imutável)</p>
                )}
              </div>

              <div>
                <Label className="mb-2 block">Modalidade *</Label>
                <div className="flex gap-2">
                  {MODALITIES.map((m) => (
                    <Button
                      key={m.value}
                      type="button"
                      size="sm"
                      variant={modality === m.value ? "default" : "outline"}
                      onClick={() => setModality(m.value)}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Categoria</Label>
                <div className="flex gap-2">
                  {CATEGORIES.map((c) => (
                    <Button
                      key={c.value}
                      type="button"
                      size="sm"
                      variant={category === c.value ? "default" : "outline"}
                      onClick={() => setCategory(c.value)}
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Instrutor</Label>
                  <Input value={instructorName} onChange={(e) => setInstructorName(e.target.value)} />
                </div>
                <div>
                  <Label>Imagem (URL)</Label>
                  <Input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>

              {coverImageUrl && (
                <div className="h-32 rounded-md overflow-hidden border bg-muted">
                  <img src={coverImageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Duração (dias)</Label>
                  <Input type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value) || 1)} />
                </div>
                <div>
                  <Label>Horas/dia</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    value={durationHoursPerDay ?? ""}
                    onChange={(e) => setDurationHoursPerDay(e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
                <div>
                  <Label>Pipeline PipeRun</Label>
                  <Input type="number" value={pipelineId} onChange={(e) => setPipelineId(Number(e.target.value) || 83896)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Stage após agendamento</Label>
                  <Input value={stageAfterEnroll} onChange={(e) => setStageAfterEnroll(e.target.value)} />
                </div>
                {modality === "presencial" ? (
                  <div>
                    <Label>Local</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                  </div>
                ) : (
                  <div>
                    <Label>Link da reunião</Label>
                    <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={publicVisible} onCheckedChange={setPublicVisible} />
                  <Label>Visível publicamente</Label>
                </div>
              </div>
            </div>

            {/* ─── Turmas e Cronograma ─── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Turmas e Cronograma</h3>
                <Button type="button" variant="outline" size="sm" onClick={addTurma}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar turma
                </Button>
              </div>

              {turmasLoading && <p className="text-sm text-muted-foreground">Carregando turmas...</p>}

              {turmas.map((turma, tIdx) => (
                <Card key={tIdx} className="border">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {turma.id ? turma.label : `Nova turma ${tIdx + 1}`}
                        {turma.id && turma.enrolled_count > 0 && (
                          <Badge variant="outline" className="ml-2">{turma.enrolled_count} inscritos</Badge>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTurma(tIdx)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <Label className="text-xs">Label</Label>
                        <Input value={turma.label} onChange={(e) => updateTurma(tIdx, "label", e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Vagas</Label>
                        <Input type="number" min={1} value={turma.slots} onChange={(e) => updateTurma(tIdx, "slots", Number(e.target.value) || 20)} />
                      </div>
                      <div>
                        <Label className="text-xs">Grupo WA</Label>
                        <Input value={turma.whatsapp_group_link} onChange={(e) => updateTurma(tIdx, "whatsapp_group_link", e.target.value)} placeholder="https://chat.whatsapp.com/..." />
                      </div>
                      <div>
                        <Label className="text-xs">TAG SellFlux</Label>
                        <Input
                          value={turma.sellflux_tag}
                          onChange={(e) => updateTurma(tIdx, "sellflux_tag", e.target.value)}
                          placeholder={buildCourseTag(title, turma.days[0]?.date)}
                        />
                      </div>
                    </div>

                    {/* Dias */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Cronograma</Label>
                      {turma.days.map((day, dIdx) => (
                        <div key={dIdx} className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground w-6">D{day.day_number}</span>
                          <Input
                            type="date"
                            className="w-[140px]"
                            value={day.date}
                            onChange={(e) => updateDay(tIdx, dIdx, "date", e.target.value)}
                          />
                          <Input
                            type="time"
                            className="w-[100px]"
                            value={day.start_time}
                            onChange={(e) => updateDay(tIdx, dIdx, "start_time", e.target.value)}
                          />
                          <span className="text-xs">às</span>
                          <Input
                            type="time"
                            className="w-[100px]"
                            value={day.end_time}
                            onChange={(e) => updateDay(tIdx, dIdx, "end_time", e.target.value)}
                          />
                          <Input
                            className="flex-1 min-w-[120px]"
                            placeholder="Tópico"
                            value={day.topic}
                            onChange={(e) => updateDay(tIdx, dIdx, "topic", e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDay(tIdx, dIdx)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => addDay(tIdx)}>
                        <Plus className="w-3 h-3 mr-1" /> Adicionar dia
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ─── Mensagem WhatsApp ─── */}
            <div className="space-y-3">
              <h3 className="font-semibold">Mensagem WhatsApp</h3>

              <div className="flex flex-wrap gap-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <Badge
                    key={v.key}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => insertVariable(v.key)}
                    title={v.desc}
                  >
                    {v.key}
                  </Badge>
                ))}
              </div>

              <Textarea
                ref={templateRef}
                value={waTemplate}
                onChange={(e) => setWaTemplate(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />

              <div>
                <Label className="text-xs mb-1 block">Preview</Label>
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-48 overflow-auto">
                  {waPreview}
                </div>
              </div>
            </div>
          </div>

        {/* Footer */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar curso"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
