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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, X, CalendarDays, Image, Repeat } from "lucide-react";
import { DatePickerInput } from "./DatePickerInput";
import { CourseProductPicker } from "./CourseProductPicker";
import { slugify, buildCourseTag, MODALITY_CONFIG } from "@/lib/courseUtils";
import {
  TEMPLATE_VARIABLES, DEFAULT_ENROLLMENT_TEMPLATE,
  interpolateTemplate, buildCronogramaText,
} from "@/lib/courseWhatsapp";
import type { SmartopsCourse, TurmaDay } from "@/types/courses";

// Default do texto do certificado (corpo após o nome do aluno)
export const DEFAULT_CERTIFICATE_BODY = `concluiu com êxito o treinamento de {{curso}}.
A imersão ocorreu em {{local}}, no período de {{data_inicio}} a {{data_fim}}, com duração de {{horas_dia}}h/dia em {{dias}} dias, e teve como objetivo o treinamento técnico para operação e utilização das soluções adquiridas.`;

export const CERTIFICATE_VARIABLES: { key: string; desc: string }[] = [
  { key: "{{nome}}",         desc: "Nome do participante" },
  { key: "{{curso}}",        desc: "Título do curso" },
  { key: "{{local}}",        desc: "Local do treinamento" },
  { key: "{{data_inicio}}",  desc: "Data do primeiro dia (ex.: 27 de maio de 2026)" },
  { key: "{{data_fim}}",     desc: "Data do último dia" },
  { key: "{{periodo}}",      desc: "Período completo (data_inicio a data_fim)" },
  { key: "{{dias}}",         desc: "Número de dias" },
  { key: "{{horas_dia}}",    desc: "Horas por dia" },
  { key: "{{carga_horaria}}",desc: "Carga horária total (dias × horas/dia)" },
  { key: "{{instrutor}}",    desc: "Nome do instrutor" },
];

interface LocalTurma {
  id?: string;
  label: string;
  turma_number?: number | null;
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

// ─── Recurrence preview ───
function previewRecurrenceDates(
  baseDate: string, type: 'days' | 'weeks' | 'months' | 'hours' | 'weekdays',
  interval: number, until: string, weekdays: number[] = [],
  timeStart: string = '09:00'
): Date[] {
  const dates: Date[] = [];
  if (!baseDate || !until) return dates;
  const current = new Date(baseDate + 'T' + (timeStart || '09:00') + ':00');
  const end = new Date(until + 'T23:59:59');
  while (current <= end && dates.length < 100) {
    if (type === 'weekdays') {
      // ISO weekday: 1=Mon..7=Sun. JS getDay(): 0=Sun..6=Sat
      const iso = ((current.getDay() + 6) % 7) + 1;
      if (weekdays.length === 0 || weekdays.includes(iso)) dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
      continue;
    }
    dates.push(new Date(current));
    if (type === 'days')   current.setDate(current.getDate() + interval);
    if (type === 'weeks')  current.setDate(current.getDate() + interval * 7);
    if (type === 'months') current.setMonth(current.getMonth() + interval);
    if (type === 'hours')  current.setHours(current.getHours() + interval);
  }
  return dates;
}

function RecurrenceSection(props: {
  recurrenceEnabled: boolean; setRecurrenceEnabled: (v: boolean) => void;
  recurrenceType: 'days' | 'weeks' | 'months' | 'hours' | 'weekdays';
  setRecurrenceType: (v: 'days' | 'weeks' | 'months' | 'hours' | 'weekdays') => void;
  recurrenceInterval: number; setRecurrenceInterval: (v: number) => void;
  recurrenceBaseDate: string; setRecurrenceBaseDate: (v: string) => void;
  recurrenceTimeStart: string; setRecurrenceTimeStart: (v: string) => void;
  recurrenceTimeEnd: string; setRecurrenceTimeEnd: (v: string) => void;
  recurrenceUntil: string; setRecurrenceUntil: (v: string) => void;
  slotsPerSession: number; setSlotsPerSession: (v: number) => void;
  whatsappGroupLink: string; setWhatsappGroupLink: (v: string) => void;
  recurrenceWeekdays: number[]; setRecurrenceWeekdays: (v: number[]) => void;
}) {
  const p = props;
  const preview = previewRecurrenceDates(
    p.recurrenceBaseDate, p.recurrenceType, p.recurrenceInterval,
    p.recurrenceUntil, p.recurrenceWeekdays, p.recurrenceTimeStart
  );
  const t = (s: string) => s?.substring(0, 5) ?? '';
  const WEEKDAYS = [
    { iso: 1, label: 'Seg' }, { iso: 2, label: 'Ter' }, { iso: 3, label: 'Qua' },
    { iso: 4, label: 'Qui' }, { iso: 5, label: 'Sex' }, { iso: 6, label: 'Sáb' },
    { iso: 7, label: 'Dom' },
  ];
  const toggleDow = (iso: number) => {
    const set = new Set(p.recurrenceWeekdays);
    if (set.has(iso)) set.delete(iso); else set.add(iso);
    p.setRecurrenceWeekdays(Array.from(set).sort((a, b) => a - b));
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2"><Repeat className="w-4 h-4" /> Sessões Recorrentes</h3>

      <div className="flex items-center gap-2">
        <Switch checked={p.recurrenceEnabled} onCheckedChange={p.setRecurrenceEnabled} />
        <Label className="text-sm">Repetir este treinamento automaticamente</Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Primeira sessão</Label>
          <DatePickerInput value={p.recurrenceBaseDate} onChange={p.setRecurrenceBaseDate} className="w-full" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Início</Label><Input type="time" value={p.recurrenceTimeStart} onChange={(e) => p.setRecurrenceTimeStart(e.target.value)} /></div>
          <div><Label className="text-xs">Fim</Label><Input type="time" value={p.recurrenceTimeEnd} onChange={(e) => p.setRecurrenceTimeEnd(e.target.value)} /></div>
        </div>
        <div>
          <Label className="text-xs">Vagas por sessão</Label>
          <Input type="number" min={1} value={p.slotsPerSession} onChange={(e) => p.setSlotsPerSession(Number(e.target.value) || 20)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {p.recurrenceType !== 'weekdays' && (
            <div>
              <Label className="text-xs">Repetir a cada</Label>
              <Input type="number" min={1} value={p.recurrenceInterval} onChange={(e) => p.setRecurrenceInterval(Number(e.target.value) || 1)} />
            </div>
          )}
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={p.recurrenceType} onValueChange={(v) => p.setRecurrenceType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
                <SelectItem value="weeks">Semanas</SelectItem>
                <SelectItem value="months">Meses</SelectItem>
                <SelectItem value="weekdays">Dias da semana (seleção)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Até a data</Label>
          <DatePickerInput value={p.recurrenceUntil} onChange={p.setRecurrenceUntil} className="w-full" />
        </div>
      </div>

      {p.recurrenceType === 'weekdays' && (
        <div>
          <Label className="text-xs">Dias da semana</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {WEEKDAYS.map((w) => {
              const active = p.recurrenceWeekdays.includes(w.iso);
              return (
                <button
                  key={w.iso}
                  type="button"
                  onClick={() => toggleDow(w.iso)}
                  className={`px-3 py-1 rounded-md text-xs border transition-colors ${
                    active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
          {p.recurrenceWeekdays.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1">Selecione ao menos um dia da semana.</p>
          )}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <Card className="border">
          <CardContent className="pt-3 space-y-1">
            <Label className="text-xs font-semibold">Preview das sessões</Label>
            {preview.slice(0, 3).map((d, i) => (
              <div key={i} className="text-xs text-muted-foreground">
                {d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                {' '}
                {p.recurrenceType === 'hours'
                  ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : `${t(p.recurrenceTimeStart)}–${t(p.recurrenceTimeEnd)}`}
              </div>
            ))}
            {preview.length > 3 && (
              <div className="text-xs text-muted-foreground">
                ... e mais {preview.length - 3} sessões até {new Date(p.recurrenceUntil + 'T12:00:00').toLocaleDateString('pt-BR')}
              </div>
            )}
            <p className="text-xs font-medium mt-1">Serão criadas {preview.length} sessões automaticamente</p>
          </CardContent>
        </Card>
      )}

      <div>
        <Label className="text-xs">Link do grupo WhatsApp (compartilhado por todas as sessões)</Label>
        <Input value={p.whatsappGroupLink} onChange={(e) => p.setWhatsappGroupLink(e.target.value)} placeholder="https://chat.whatsapp.com/..." />
      </div>
    </div>
  );
}

export function CourseCreateModal({ open, course, onClose }: Props) {
  const isEdit = !!course;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const certificateRef = useRef<HTMLTextAreaElement>(null);

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
  const [certificateBody, setCertificateBody] = useState(DEFAULT_CERTIFICATE_BODY);

  // Produtos do portfólio Smart Dent vinculados a cursos online.
  const [relatedProductIds, setRelatedProductIds] = useState<string[]>([]);
  const [relatedProductNames, setRelatedProductNames] = useState<string[]>([]);

  // Recurrence (online only)
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'days' | 'weeks' | 'months' | 'hours' | 'weekdays'>('weeks');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceBaseDate, setRecurrenceBaseDate] = useState('');
  const [recurrenceTimeStart, setRecurrenceTimeStart] = useState('09:00');
  const [recurrenceTimeEnd, setRecurrenceTimeEnd] = useState('11:00');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [recurrenceSlotsPerSession, setRecurrenceSlotsPerSession] = useState(20);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);

  // AlertDialog for recreating enrolled sessions
  const [showRecreateConfirm, setShowRecreateConfirm] = useState(false);
  const [enrolledSessionsCount, setEnrolledSessionsCount] = useState(0);
  const [pendingCourseId, setPendingCourseId] = useState<string | null>(null);

  const isOnline = modality === 'online' || modality === 'online_ao_vivo';

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
      setRecurrenceEnabled(false); setRecurrenceType('weeks'); setRecurrenceInterval(1);
      setRecurrenceBaseDate(''); setRecurrenceTimeStart('09:00'); setRecurrenceTimeEnd('11:00');
      setRecurrenceUntil(''); setRecurrenceSlotsPerSession(20);
      setTurmas([]);
      setCertificateBody(DEFAULT_CERTIFICATE_BODY);
      setRelatedProductIds([]);
      setRelatedProductNames([]);
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
    setCertificateBody(course.certificate_body_template || DEFAULT_CERTIFICATE_BODY);
    setRelatedProductIds(((course as any).related_product_ids ?? []) as string[]);
    setRelatedProductNames(((course as any).related_product_names ?? []) as string[]);
    setRecurrenceEnabled(course.recurrence_enabled || false);
    setRecurrenceType((course.recurrence_type as any) || 'weeks');
    setRecurrenceInterval(course.recurrence_interval || 1);
    setRecurrenceUntil(course.recurrence_until || '');
    setRecurrenceTimeStart(course.recurrence_time_start?.substring(0, 5) || '09:00');
    setRecurrenceTimeEnd(course.recurrence_time_end?.substring(0, 5) || '11:00');

    // Load turmas
    loadTurmas(course.id);

    // Load recurrenceBaseDate from first recurrent turma
    if (course.recurrence_enabled) {
      (async () => {
        const { data: turmasDoCurso } = await (supabase as any)
          .from('smartops_course_turmas')
          .select('id, recurrence_index, days:smartops_turma_days(date)')
          .eq('course_id', course.id)
          .order('recurrence_index', { ascending: true })
          .limit(1);
        const firstDate = turmasDoCurso?.[0]?.days
          ?.sort((a: any, b: any) => a.date.localeCompare(b.date))[0]?.date;
        if (firstDate) setRecurrenceBaseDate(firstDate);
      })();
    }
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
          turma_number: t.turma_number,
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

  // ─── Certificate template insert variable ───
  const insertCertificateVariable = (key: string) => {
    const ta = certificateRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = certificateBody.substring(0, start);
    const after = certificateBody.substring(end);
    setCertificateBody(before + key + after);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + key.length, start + key.length);
    }, 0);
  };

  // ─── Certificate preview ───
  const certificatePreview = (() => {
    const firstTurma = turmas[0];
    const days = firstTurma?.days ?? [];
    const sortedDates = days.map((d) => d.date).filter(Boolean).sort();
    const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const fmt = (s: string) => {
      if (!s) return "";
      const [y, m, d] = s.split("-").map(Number);
      return `${d} de ${meses[m - 1]} de ${y}`;
    };
    const dataInicio = fmt(sortedDates[0] || "");
    const dataFim = fmt(sortedDates[sortedDates.length - 1] || "");
    const periodo = dataInicio && dataFim
      ? (dataInicio === dataFim ? dataInicio : `${dataInicio} a ${dataFim}`)
      : "";
    // Calcula horas/dia e carga horária a partir dos horários reais dos dias da turma.
    const fmtH = (n: number) => {
      const r = Math.round(n * 10) / 10;
      return Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
    };
    const hoursOfDay = (start?: string, end?: string): number | null => {
      if (!start || !end) return null;
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
      const d = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
      return d > 0 ? d : null;
    };
    const perDay = days
      .map((d) => hoursOfDay(d.start_time, d.end_time))
      .filter((h): h is number => h != null);
    let horas = "";
    let cargaH = "";
    if (perDay.length > 0) {
      const total = perDay.reduce((a, b) => a + b, 0);
      horas = fmtH(total / perDay.length);
      cargaH = fmtH(total);
    } else if (durationHoursPerDay) {
      horas = fmtH(durationHoursPerDay);
      cargaH = fmtH(durationHoursPerDay * durationDays);
    } else {
      horas = "8";
      cargaH = String(8 * durationDays);
    }
    const vars: Record<string, string> = {
      nome: "Dr. João Silva",
      curso: title || "Curso",
      local: modality === "presencial" ? (location || "Smart Dent") : (meetingLink || "Online"),
      data_inicio: dataInicio || "27 de maio de 2026",
      data_fim: dataFim || "29 de maio de 2026",
      periodo: periodo || "27 de maio de 2026 a 29 de maio de 2026",
      dias: String(durationDays),
      horas_dia: horas,
      carga_horaria: cargaH,
      instrutor: instructorName || "Instrutor",
    };
    return certificateBody.replace(/\{\{\s*([\wÀ-ÿ_]+)\s*\}\}/gi, (_m, k) =>
      vars[k.toLowerCase()] ?? `{{${k}}}`
    );
  })();

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
      link_reuniao: meetingLink || "",
      cs_nome: "CS",
    });
  })();

  // ─── Recurrence generation helper ───
  const executeRecurrenceGeneration = async (courseId: string) => {
    setSaving(true);
    try {
      const { data: count, error: rpcErr } = await supabase.rpc('fn_generate_recurrent_turmas' as any, {
        p_course_id: courseId,
        p_base_date: recurrenceBaseDate,
        p_slots: recurrenceSlotsPerSession,
        p_template_label: title.trim(),
      });
      if (rpcErr) throw rpcErr;
      qc.invalidateQueries({ queryKey: ["smartops_courses"] });
      qc.invalidateQueries({ queryKey: ["v_turmas_com_vagas"] });
      toast({ title: `${count ?? 0} sessões criadas com sucesso!` });
      onClose();
    } catch (err: any) {
      toast({ title: "Erro ao gerar sessões", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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
      const useRecurrence = isOnline && recurrenceEnabled;
      const coursePayload: Record<string, any> = {
        title: title.trim(),
        ...(isEdit ? {} : { slug: slugify(title.trim()) }),
        description: description || null,
        modality,
        category,
        instructor_name: instructorName || null,
        cover_image_url: coverImageUrl || null,
        max_capacity: useRecurrence ? recurrenceSlotsPerSession : (turmas[0]?.slots || 20),
        duration_days: durationDays,
        duration_hours_per_day: durationHoursPerDay || null,
        location: location || null,
        meeting_link: meetingLink || null,
        whatsapp_group_link: whatsappGroupLink || null,
        whatsapp_message_template: waTemplate !== DEFAULT_ENROLLMENT_TEMPLATE ? waTemplate : null,
        certificate_body_template: certificateBody && certificateBody !== DEFAULT_CERTIFICATE_BODY ? certificateBody : null,
        pipeline_id_kanban: pipelineId,
        stage_after_enroll: stageAfterEnroll,
        public_visible: publicVisible,
        active: true,
        ...(isEdit ? {} : { created_by: user.id }),
        recurrence_enabled: useRecurrence,
        recurrence_type: useRecurrence ? recurrenceType : null,
        recurrence_interval: useRecurrence ? recurrenceInterval : null,
        recurrence_until: useRecurrence ? (recurrenceUntil || null) : null,
        recurrence_time_start: useRecurrence ? recurrenceTimeStart : null,
        recurrence_time_end: useRecurrence ? recurrenceTimeEnd : null,
        related_product_ids: isOnline ? relatedProductIds : [],
        related_product_names: isOnline ? relatedProductNames : [],
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

      // PASSO 1.5: Recurrence — generate turmas via SQL function
      if (useRecurrence && recurrenceBaseDate) {
        // Check for enrolled sessions before recreating (edit mode only)
        if (isEdit) {
          const { count: enrolledCount } = await (supabase as any)
            .from('smartops_course_turmas')
            .select('id', { count: 'exact', head: true })
            .eq('course_id', courseId)
            .not('recurrence_parent_id', 'is', null)
            .gt('enrolled_count', 0);

          if (enrolledCount && enrolledCount > 0) {
            setEnrolledSessionsCount(enrolledCount);
            setPendingCourseId(courseId);
            setShowRecreateConfirm(true);
            setSaving(false);
            return; // wait for user confirmation
          }
        }

        await executeRecurrenceGeneration(courseId);
        return;
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
    <>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Opcional — calculado automaticamente pelos horários da turma quando vazio.
                  </p>
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

              {isOnline && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="font-semibold">Produtos do portfólio relacionados</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Selecione os produtos Smart Dent que serão tema desta aula online.
                    Aparecerão como tags no card público da agenda.
                  </p>
                  <CourseProductPicker
                    selectedIds={relatedProductIds}
                    selectedNames={relatedProductNames}
                    onChange={(ids, names) => {
                      setRelatedProductIds(ids);
                      setRelatedProductNames(names);
                    }}
                  />
                </div>
              )}
            </div>

            {/* ─── Turmas e Cronograma ─── */}
            {!isOnline || !recurrenceEnabled ? (
              /* PRESENCIAL ou online sem recorrência: editor manual */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Turmas e Cronograma</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addTurma}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar turma
                  </Button>
                </div>

                {isOnline && (
                  <div className="flex items-center gap-2">
                    <Switch checked={recurrenceEnabled} onCheckedChange={setRecurrenceEnabled} />
                    <Label className="text-sm">Repetir este treinamento automaticamente</Label>
                  </div>
                )}

                {turmasLoading && <p className="text-sm text-muted-foreground">Carregando turmas...</p>}

                {turmas.map((turma, tIdx) => (
                  <Card key={tIdx} className="border">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {turma.id ? (
                            <>
                              {turma.turma_number != null && (
                                <span className="mr-2 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold">
                                  {modality === 'presencial' ? `#${turma.turma_number}` : `#${String(turma.turma_number).padStart(3, '0')}`}
                                </span>
                              )}
                              {turma.label}
                            </>
                          ) : `Nova turma ${tIdx + 1}`}
                          {turma.id && turma.enrolled_count > 0 && (
                            <Badge variant="outline" className="ml-2">{turma.enrolled_count} inscritos</Badge>
                          )}
                        </span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeTurma(tIdx)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div><Label className="text-xs">Label</Label><Input value={turma.label} onChange={(e) => updateTurma(tIdx, "label", e.target.value)} /></div>
                        <div><Label className="text-xs">Vagas</Label><Input type="number" min={1} value={turma.slots} onChange={(e) => updateTurma(tIdx, "slots", Number(e.target.value) || 20)} /></div>
                        <div><Label className="text-xs">Grupo WA</Label><Input value={turma.whatsapp_group_link} onChange={(e) => updateTurma(tIdx, "whatsapp_group_link", e.target.value)} placeholder="https://chat.whatsapp.com/..." /></div>
                        <div><Label className="text-xs">TAG SellFlux</Label><Input value={turma.sellflux_tag} onChange={(e) => updateTurma(tIdx, "sellflux_tag", e.target.value)} placeholder={buildCourseTag(title, turma.days[0]?.date)} /></div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Cronograma</Label>
                        {turma.days.map((day, dIdx) => (
                          <div key={dIdx} className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground w-6">D{day.day_number}</span>
                            <DatePickerInput
                              className="w-[160px]"
                              value={day.date}
                              onChange={(v) => updateDay(tIdx, dIdx, "date", v)}
                            />
                            <Input type="time" className="w-[100px]" value={day.start_time} onChange={(e) => updateDay(tIdx, dIdx, "start_time", e.target.value)} />
                            <span className="text-xs">às</span>
                            <Input type="time" className="w-[100px]" value={day.end_time} onChange={(e) => updateDay(tIdx, dIdx, "end_time", e.target.value)} />
                            <Input className="flex-1 min-w-[120px]" placeholder="Tópico" value={day.topic} onChange={(e) => updateDay(tIdx, dIdx, "topic", e.target.value)} />
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeDay(tIdx, dIdx)}><X className="w-3 h-3" /></Button>
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
            ) : (
              /* ONLINE com recorrência habilitada */
              <RecurrenceSection
                recurrenceEnabled={recurrenceEnabled} setRecurrenceEnabled={setRecurrenceEnabled}
                recurrenceType={recurrenceType} setRecurrenceType={setRecurrenceType}
                recurrenceInterval={recurrenceInterval} setRecurrenceInterval={setRecurrenceInterval}
                recurrenceBaseDate={recurrenceBaseDate} setRecurrenceBaseDate={setRecurrenceBaseDate}
                recurrenceTimeStart={recurrenceTimeStart} setRecurrenceTimeStart={setRecurrenceTimeStart}
                recurrenceTimeEnd={recurrenceTimeEnd} setRecurrenceTimeEnd={setRecurrenceTimeEnd}
                recurrenceUntil={recurrenceUntil} setRecurrenceUntil={setRecurrenceUntil}
                slotsPerSession={recurrenceSlotsPerSession} setSlotsPerSession={setRecurrenceSlotsPerSession}
                whatsappGroupLink={whatsappGroupLink} setWhatsappGroupLink={setWhatsappGroupLink}
              />
            )}

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

            {/* ─── Texto do Certificado ─── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Texto do Certificado</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCertificateBody(DEFAULT_CERTIFICATE_BODY)}
                  className="text-xs"
                >
                  Restaurar padrão
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Corpo que aparece abaixo do nome do aluno no PDF. Use as variáveis abaixo.
              </p>

              <div className="flex flex-wrap gap-1">
                {CERTIFICATE_VARIABLES.map((v) => (
                  <Badge
                    key={v.key}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10"
                    onClick={() => insertCertificateVariable(v.key)}
                    title={v.desc}
                  >
                    {v.key}
                  </Badge>
                ))}
              </div>

              <Textarea
                ref={certificateRef}
                value={certificateBody}
                onChange={(e) => setCertificateBody(e.target.value)}
                rows={6}
                className="font-mono text-sm"
              />

              <div>
                <Label className="text-xs mb-1 block">Preview</Label>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-48 overflow-auto">
                  {certificatePreview}
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

    <AlertDialog open={showRecreateConfirm} onOpenChange={setShowRecreateConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recriar sessões recorrentes?</AlertDialogTitle>
          <AlertDialogDescription>
            {enrolledSessionsCount} sessão{enrolledSessionsCount !== 1 ? 'ões têm' : ' tem'} inscritos
            e {enrolledSessionsCount !== 1 ? 'serão mantidas' : 'será mantida'}.
            As demais serão deletadas e recriadas com a nova configuração.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { setShowRecreateConfirm(false); setPendingCourseId(null); }}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              setShowRecreateConfirm(false);
              if (pendingCourseId) {
                await executeRecurrenceGeneration(pendingCourseId);
                setPendingCourseId(null);
              }
            }}
          >
            Continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
