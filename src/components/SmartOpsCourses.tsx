import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays, Users, Plus, Search, Download, Send, Edit2, CheckCircle,
  XCircle, AlertTriangle, Minus, Image, ToggleLeft, ToggleRight, Pencil, Trash2,
  ChevronDown, ChevronUp, Repeat, Clock, Star, UserPlus, Award, Loader2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { EquipKey, EquipmentData } from "@/types/courses";
import { EQUIP_CONFIG } from "@/lib/courseUtils";
import { GerarDocButton } from "@/components/GerarDocButton";
import { ComprovanteImersaoButton } from "@/components/ComprovanteImersaoButton";
import type { TurmaComVagas, SmartopsCourse, CourseEnrollment } from "@/types/courses";
import { MODALITY_CONFIG, STATUS_CONFIG, formatDatePtBr, formatWeekday } from "@/lib/courseUtils";
import { CourseCreateModal } from "./smartops/CourseCreateModal";
import { EnrollmentModal } from "./smartops/EnrollmentModal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EquipmentSerialsSection } from "./smartops/EquipmentSerialsSection";
import { TreinamentosToolbar, type FilterTab } from "./smartops/TreinamentosToolbar";
import { TurmaCard } from "./smartops/TurmaCard";
import { CourseCard } from "./smartops/CourseCard";

// ─── Countdown Hook ───
type CountdownResult = {
  label: string;
  variant: 'green' | 'amber' | 'red' | 'blue' | 'muted';
} | null;

const VARIANT_CLASSES: Record<string, string> = {
  green: 'bg-green-100 text-green-800 border-green-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse',
  muted: '',
};

function useCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  return (startDate?: string, startTime?: string, endDate?: string, endTime?: string, modality?: string): CountdownResult => {
    if (!startDate) return null;
    const sTime = startTime?.substring(0, 5) ?? '09:00';
    const eDate = endDate ?? startDate;
    const eTime = endTime?.substring(0, 5) ?? '18:00';
    const startMs = new Date(`${startDate}T${sTime}:00`).getTime();
    const endMs = new Date(`${eDate}T${eTime}:00`).getTime();
    const diffStart = startMs - now;
    const daysUntil = Math.ceil(diffStart / 86400000);

    // After end → Curso realizado
    if (now >= endMs) return { label: 'Curso realizado', variant: 'muted' };
    // During event → Acontecendo agora
    if (now >= startMs) return { label: 'Acontecendo agora', variant: 'blue' };

    // Presencial-specific enrollment phases
    if (modality === 'presencial') {
      if (daysUntil <= 3) return { label: 'Inscrições encerradas', variant: 'red' };
      if (daysUntil <= 7) return { label: `Faltam ${daysUntil} dias para encerrar inscrições`, variant: 'amber' };
      return { label: 'Inscrições abertas', variant: 'green' };
    }

    // Online/other: keep numeric countdown
    const d = Math.floor(diffStart / 86400000);
    const h = Math.floor((diffStart % 86400000) / 3600000);
    const m = Math.floor((diffStart % 3600000) / 60000);
    return { label: `${d}d ${h}h ${m}m`, variant: 'green' };
  };
}

// ─── Aba Agendamentos ───
function AgendamentosTab() {
  const [enrollModal, setEnrollModal] = useState<{ course: SmartopsCourse; turmaId: string } | null>(null);
  const getCountdown = useCountdown();
  const [search, setSearch] = useState("");
  const [filterKey, setFilterKey] = useState<"todos" | "abertas" | "agora" | "encerrados">("todos");
  const [sort, setSort] = useState<"date_asc" | "date_desc" | "occupancy_desc" | "title">("date_asc");

  const { data: turmas = [], isLoading } = useQuery({
    queryKey: ["v_turmas_com_vagas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_turmas_com_vagas")
        .select("*")
        .eq("active", true)
        .order("start_date");
      if (error) throw error;
      return data as TurmaComVagas[];
    },
  });

  // Fetch companion counts per turma
  const turmaIds = useMemo(() => turmas.map(t => t.id), [turmas]);
  const { data: companionCounts = {} } = useQuery({
    queryKey: ["companion_counts", turmaIds],
    enabled: turmaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("smartops_course_enrollments")
        .select("turma_id, smartops_enrollment_companions(id)")
        .in("turma_id", turmaIds);
      if (error) return {};
      const counts: Record<string, number> = {};
      for (const row of (data || [])) {
        const tid = row.turma_id;
        const c = (row.smartops_enrollment_companions || []).length;
        counts[tid] = (counts[tid] || 0) + c;
      }
      return counts;
    },
  });

  // Compute counters per filter
  const counters = useMemo(() => {
    const c = { todos: turmas.length, abertas: 0, agora: 0, encerrados: 0 };
    for (const t of turmas) {
      const cd = getCountdown(t.start_date, t.start_time, t.end_date, t.end_time, t.modality);
      if (!cd) continue;
      if (cd.variant === "muted") c.encerrados++;
      else if (cd.variant === "blue") c.agora++;
      else c.abertas++;
    }
    return c;
  }, [turmas, getCountdown]);

  const filtered = useMemo(() => {
    let arr = turmas.map((t) => ({ t, cd: getCountdown(t.start_date, t.start_time, t.end_date, t.end_time, t.modality) }));
    if (filterKey === "abertas") arr = arr.filter(x => x.cd && x.cd.variant !== "muted" && x.cd.variant !== "blue");
    if (filterKey === "agora") arr = arr.filter(x => x.cd?.variant === "blue");
    if (filterKey === "encerrados") arr = arr.filter(x => x.cd?.variant === "muted");
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(x => (x.t.course_title || "").toLowerCase().includes(s) || (x.t.label || "").toLowerCase().includes(s));
    }
    arr.sort((a, b) => {
      if (sort === "date_desc") return (b.t.start_date || "").localeCompare(a.t.start_date || "");
      if (sort === "occupancy_desc") {
        const oa = a.t.slots ? a.t.enrolled_count / a.t.slots : 0;
        const ob = b.t.slots ? b.t.enrolled_count / b.t.slots : 0;
        return ob - oa;
      }
      if (sort === "title") return (a.t.course_title || "").localeCompare(b.t.course_title || "");
      return (a.t.start_date || "").localeCompare(b.t.start_date || "");
    });
    return arr;
  }, [turmas, getCountdown, filterKey, search, sort]);

  const tabs: FilterTab[] = [
    { key: "todos", label: "Todos", count: counters.todos },
    { key: "abertas", label: "Inscrições Abertas", count: counters.abertas },
    { key: "agora", label: "Acontecendo", count: counters.agora },
    { key: "encerrados", label: "Encerrados", count: counters.encerrados },
  ];

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando agendamentos...</div>;

  return (
    <>
      <TreinamentosToolbar
        tabs={tabs}
        activeTab={filterKey}
        onTabChange={(k) => setFilterKey(k as any)}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={(s) => setSort(s as any)}
        sortOptions={[
          { value: "date_asc", label: "Data (mais próximas)" },
          { value: "date_desc", label: "Data (mais distantes)" },
          { value: "occupancy_desc", label: "Ocupação (maior)" },
          { value: "title", label: "Nome A–Z" },
        ]}
        searchPlaceholder="Buscar agendamentos…"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum agendamento encontrado.</p>
          <p className="text-sm mt-1">Ajuste o filtro ou crie um curso na aba "Catálogo".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(({ t, cd }) => (
            <TurmaCard
              key={t.id}
              turma={t}
              companionCount={(companionCounts as Record<string, number>)[t.id] || 0}
              status={cd}
              onEnroll={() => setEnrollModal({
                course: {
                  id: t.course_id,
                  title: t.course_title || "Sem título",
                  modality: t.modality || "presencial",
                  instructor_name: t.instructor_name,
                  location: t.location,
                  meeting_link: t.meeting_link,
                  pipeline_id_kanban: t.pipeline_id_kanban || 83896,
                  stage_after_enroll: t.stage_after_enroll || "treinamento_agendado",
                } as SmartopsCourse,
                turmaId: t.id,
              })}
            />
          ))}
        </div>
      )}

      {enrollModal && (
        <EnrollmentModal
          course={enrollModal.course}
          preselectedTurmaId={enrollModal.turmaId}
          open={!!enrollModal}
          onClose={() => setEnrollModal(null)}
        />
      )}
    </>
  );
}

// ─── RecurrenceSummary inline ───
function RecurrenceSummary({ course }: { course: SmartopsCourse }) {
  if (!course.recurrence_enabled) return null;
  const typeLabel: Record<string, string> = {
    days: course.recurrence_interval === 1 ? 'diário' : `a cada ${course.recurrence_interval} dias`,
    weeks: course.recurrence_interval === 1 ? 'semanal' : `a cada ${course.recurrence_interval} semanas`,
    months: course.recurrence_interval === 1 ? 'mensal' : `a cada ${course.recurrence_interval} meses`,
  };
  const t = (s?: string) => s?.substring(0, 5) ?? '';
  const until = course.recurrence_until
    ? new Date(course.recurrence_until + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1">
      <Repeat className="w-3 h-3" />
      {typeLabel[course.recurrence_type!] ?? ''} {' · '}
      {t(course.recurrence_time_start)}–{t(course.recurrence_time_end)}
      {until && ` · até ${until}`}
    </p>
  );
}

// ─── Aba Catálogo ───
function CatalogoTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [editCourse, setEditCourse] = useState<SmartopsCourse | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterKey, setFilterKey] = useState<"todos" | "ativos" | "inativos" | "privados">("todos");
  const [sort, setSort] = useState<"recent" | "title" | "turmas">("recent");

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["smartops_courses"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("smartops_courses")
        .select(`
          id, title, slug, modality, category, instructor_name,
          cover_image_url, max_capacity, duration_days, location,
          meeting_link, active, public_visible,
          recurrence_enabled, recurrence_type, recurrence_interval,
          recurrence_until, recurrence_time_start, recurrence_time_end,
          whatsapp_group_link,
          turmas:smartops_course_turmas (
            id, label, slots, enrolled_count, active,
            recurrence_parent_id, recurrence_index, sort_order,
            days:smartops_turma_days (day_number, date, start_time, end_time)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        ...c,
        turmas: (c.turmas ?? [])
          .filter((t: any) => t.active !== false)
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((t: any) => {
            const days = (t.days ?? []).sort((a: any, b: any) => a.day_number - b.day_number);
            return {
              ...t, days,
              vagas_disponiveis: Math.max(t.slots - t.enrolled_count, 0),
              start_date: days[0]?.date, start_time: days[0]?.start_time,
              end_date: days[days.length - 1]?.date, end_time: days[days.length - 1]?.end_time,
            };
          }),
      })) as SmartopsCourse[];
    },
  });

  const toggleField = async (id: string, field: "active" | "public_visible", value: boolean) => {
    const { error } = await (supabase as any).from("smartops_courses").update({ [field]: value }).eq("id", id);
    if (error) toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    else qc.invalidateQueries({ queryKey: ["smartops_courses"] });
  };

  const cloneCourse = async (c: SmartopsCourse) => {
    try {
      const { data: full, error: fetchErr } = await (supabase as any)
        .from("smartops_courses")
        .select("*")
        .eq("id", c.id)
        .single();
      if (fetchErr) throw fetchErr;

      const { id, created_at, updated_at, created_by, slug, title, ...rest } = full as any;
      const suffix = Date.now().toString(36).slice(-4);
      const newTitle = `Cópia de ${title}`;
      const newSlug = `${slug}-copia-${suffix}`;

      const { data: inserted, error: insertErr } = await (supabase as any)
        .from("smartops_courses")
        .insert({
          ...rest,
          title: newTitle,
          slug: newSlug,
          active: false,
          public_visible: false,
        })
        .select("*")
        .single();
      if (insertErr) throw insertErr;

      toast({ title: "Curso clonado!", description: "Edite os detalhes e cadastre as turmas." });
      qc.invalidateQueries({ queryKey: ["smartops_courses"] });
      setEditCourse(inserted as SmartopsCourse);
    } catch (err: any) {
      toast({ title: "Erro ao clonar", description: err.message, variant: "destructive" });
    }
  };

  const deleteCourse = async (c: SmartopsCourse) => {
    const totalEnrolled = (c.turmas ?? []).reduce((s: number, t: any) => s + (t.enrolled_count || 0), 0);
    if (totalEnrolled > 0) {
      toast({
        title: "Não é possível excluir",
        description: `Este curso tem ${totalEnrolled} inscrito(s). Remova as inscrições antes de excluir.`,
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm(`Excluir o curso "${c.title}"? Esta ação não pode ser desfeita e removerá todas as turmas.`)) return;
    try {
      const turmaIds = (c.turmas ?? []).map((t: any) => t.id).filter(Boolean);
      if (turmaIds.length) {
        await (supabase as any).from("smartops_turma_days").delete().in("turma_id", turmaIds);
        await (supabase as any).from("smartops_course_turmas").delete().in("id", turmaIds);
      }
      const { error } = await (supabase as any).from("smartops_courses").delete().eq("id", c.id);
      if (error) throw error;
      toast({ title: "Curso excluído" });
      qc.invalidateQueries({ queryKey: ["smartops_courses"] });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const counters = useMemo(() => {
    const c = { todos: courses.length, ativos: 0, inativos: 0, privados: 0 };
    for (const x of courses) {
      if (!x.active) c.inativos++;
      else if (!x.public_visible) c.privados++;
      else c.ativos++;
    }
    return c;
  }, [courses]);

  const filtered = useMemo(() => {
    let arr = [...courses];
    if (filterKey === "ativos") arr = arr.filter(c => c.active && c.public_visible);
    if (filterKey === "inativos") arr = arr.filter(c => !c.active);
    if (filterKey === "privados") arr = arr.filter(c => c.active && !c.public_visible);
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(c =>
        c.title.toLowerCase().includes(s) ||
        (c.instructor_name || "").toLowerCase().includes(s)
      );
    }
    arr.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "turmas") return ((b.turmas?.length ?? 0) - (a.turmas?.length ?? 0));
      return (b.created_at || "").localeCompare(a.created_at || "");
    });
    return arr;
  }, [courses, filterKey, search, sort]);

  const tabs: FilterTab[] = [
    { key: "todos", label: "Todos", count: counters.todos },
    { key: "ativos", label: "Ativos", count: counters.ativos },
    { key: "privados", label: "Privados", count: counters.privados },
    { key: "inativos", label: "Inativos", count: counters.inativos },
  ];

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando cursos...</div>;

  return (
    <>
      <TreinamentosToolbar
        tabs={tabs}
        activeTab={filterKey}
        onTabChange={(k) => setFilterKey(k as any)}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={(s) => setSort(s as any)}
        sortOptions={[
          { value: "recent", label: "Mais recentes" },
          { value: "title", label: "Nome A–Z" },
          { value: "turmas", label: "Mais turmas" },
        ]}
        searchPlaceholder="Buscar cursos…"
        ctaLabel="+ Novo Curso"
        onCtaClick={() => setShowCreate(true)}
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum curso encontrado.</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Criar primeiro curso
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              onEdit={() => setEditCourse(c)}
              onToggleActive={() => toggleField(c.id, "active", !c.active)}
              onTogglePublic={() => toggleField(c.id, "public_visible", !c.public_visible)}
              onClone={() => cloneCourse(c)}
              onDelete={() => deleteCourse(c)}
            />
          ))}
        </div>
      )}

      {(showCreate || editCourse) && (
        <CourseCreateModal
          open={showCreate || !!editCourse}
          course={editCourse}
          onClose={() => { setShowCreate(false); setEditCourse(null); }}
        />
      )}
    </>
  );
}

// ─── Edit Enrollment Dialog ───
function EditEnrollmentDialog({ enrollment, open, onClose }: { enrollment: any; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    status: enrollment.status || 'agendado',
    person_name: enrollment.person_name || '',
    especialidade: enrollment.especialidade || '',
    area_atuacao: enrollment.area_atuacao || '',
    deal_title: enrollment.deal_title || '',
    deal_value: enrollment.deal_value ?? '',
    numero_contrato: enrollment.numero_contrato || '',
    numero_proposta: enrollment.numero_proposta || '',
    instagram: enrollment.instagram || '',
    empresa_cnpj: enrollment.empresa_cnpj || '',
    empresa_pais: enrollment.empresa_pais || '',
    empresa_estado: enrollment.empresa_estado || '',
    empresa_cidade: enrollment.empresa_cidade || '',
    empresa_endereco: enrollment.empresa_endereco || '',
    empresa_telefone: enrollment.empresa_telefone || '',
    tipo_entrega: enrollment.tipo_entrega || '',
    rastreamento: enrollment.rastreamento || '',
    notes: enrollment.notes || '',
    equipment_data: enrollment.equipment_data || {} as EquipmentData,
  });

  const uf = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const proposalItems: any[] = enrollment.proposal_items_snapshot || [];
  const companions: any[] = enrollment.companions || [];
  const turmaSnap = enrollment.turma_snapshot;

  const handleSave = async () => {
    setSaving(true);
    try {
      const changed: Record<string, any> = {};
      const diff = (field: string, formVal: any) => {
        const orig = (enrollment as any)[field] ?? '';
        if (String(formVal ?? '') !== String(orig ?? '')) changed[field] = formVal || null;
      };
      diff('status', form.status);
      diff('person_name', form.person_name);
      diff('especialidade', form.especialidade);
      diff('area_atuacao', form.area_atuacao);
      diff('deal_title', form.deal_title);
      if (String(form.deal_value) !== String(enrollment.deal_value ?? '')) {
        changed.deal_value = form.deal_value !== '' ? Number(form.deal_value) : null;
      }
      diff('numero_contrato', form.numero_contrato);
      diff('numero_proposta', form.numero_proposta);
      diff('instagram', form.instagram);
      diff('empresa_cnpj', form.empresa_cnpj);
      diff('empresa_pais', form.empresa_pais);
      diff('empresa_estado', form.empresa_estado);
      diff('empresa_cidade', form.empresa_cidade);
      diff('empresa_endereco', form.empresa_endereco);
      diff('empresa_telefone', form.empresa_telefone);
      diff('tipo_entrega', form.tipo_entrega);
      if (form.tipo_entrega === 'enviar') { diff('rastreamento', form.rastreamento); }
      else if (enrollment.rastreamento) { changed.rastreamento = null; }
      diff('notes', form.notes);
      if (JSON.stringify(form.equipment_data) !== JSON.stringify(enrollment.equipment_data || {})) {
        changed.equipment_data = form.equipment_data;
      }

      if (Object.keys(changed).length === 0) { toast({ title: "Nenhuma alteração" }); onClose(); return; }

      const { error } = await (supabase as any).from('smartops_course_enrollments')
        .update({ ...changed, updated_at: new Date().toISOString() })
        .eq('id', enrollment.id);
      if (error) throw error;

      if (changed.instagram && enrollment.lead_id) {
        await (supabase as any).from('lia_attendances')
          .update({ instagram: changed.instagram }).eq('id', enrollment.lead_id).is('merged_into', null);
      }

      qc.invalidateQueries({ queryKey: ["smartops_enrollments"] });
      toast({ title: "Inscrição atualizada!" });
      onClose();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Inscrição — {enrollment.person_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">

          {/* ── Curso / Turma (readonly) ── */}
          <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Curso: </span><strong>{enrollment.course?.title}</strong></div>
            <div><span className="text-muted-foreground">Turma: </span><strong>{enrollment.turma?.label}</strong></div>
            {turmaSnap?.days?.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {turmaSnap.days.map((d: any) => (
                  <span key={d.day_number} className="mr-3">{formatDatePtBr(d.date)} {d.start_time?.substring(0, 5)}–{d.end_time?.substring(0, 5)}</span>
                ))}
              </div>
            )}
            {enrollment.course?.instructor_name && (
              <div className="text-xs text-muted-foreground">Instrutor: {enrollment.course.instructor_name}</div>
            )}
          </div>

          {/* ── Status ── */}
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => uf('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Dados do participante (idêntico ao Step 2) ── */}
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Participante</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="text-xs">Deal</Label><Input value={form.deal_title} onChange={(e) => uf('deal_title', e.target.value)} /></div>
            <div><Label className="text-xs">Participante</Label><Input value={form.person_name} onChange={(e) => uf('person_name', e.target.value)} /></div>
            <div><Label className="text-xs">ID PipeRun</Label><Input value={enrollment.person_piperun_id || ''} disabled /></div>
            <div><Label className="text-xs">Especialidade</Label><Input value={form.especialidade} onChange={(e) => uf('especialidade', e.target.value)} /></div>
            <div><Label className="text-xs">Área de atuação</Label><Input value={form.area_atuacao} onChange={(e) => uf('area_atuacao', e.target.value)} /></div>
            <div><Label className="text-xs">Nº Contrato</Label><Input value={form.numero_contrato} onChange={(e) => uf('numero_contrato', e.target.value)} /></div>
            <div><Label className="text-xs">Instagram</Label><Input value={form.instagram} onChange={(e) => uf('instagram', e.target.value)} placeholder="@usuario" /></div>
            <div><Label className="text-xs">Valor Deal (R$)</Label><Input type="number" value={form.deal_value} onChange={(e) => uf('deal_value', e.target.value)} /></div>
          </div>

          {/* ── Empresa (B2B) ── */}
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados da Empresa (B2B)</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="text-xs">CNPJ</Label><Input value={form.empresa_cnpj} onChange={(e) => uf('empresa_cnpj', e.target.value)} /></div>
            <div><Label className="text-xs">País</Label><Input value={form.empresa_pais} onChange={(e) => uf('empresa_pais', e.target.value)} /></div>
            <div><Label className="text-xs">Estado</Label><Input value={form.empresa_estado} onChange={(e) => uf('empresa_estado', e.target.value)} /></div>
            <div><Label className="text-xs">Cidade</Label><Input value={form.empresa_cidade} onChange={(e) => uf('empresa_cidade', e.target.value)} /></div>
            <div className="sm:col-span-2"><Label className="text-xs">Endereço</Label><Input value={form.empresa_endereco} onChange={(e) => uf('empresa_endereco', e.target.value)} /></div>
            <div><Label className="text-xs">Telefone</Label><Input value={form.empresa_telefone} onChange={(e) => uf('empresa_telefone', e.target.value)} /></div>
          </div>

          {/* ── Nº Proposta ── */}
          {form.numero_proposta && (
            <div className="bg-muted/50 rounded-md px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Proposta: </span>
              <span className="font-semibold">{form.numero_proposta}</span>
              <Input className="mt-2" value={form.numero_proposta} onChange={(e) => uf('numero_proposta', e.target.value)} />
            </div>
          )}
          {!form.numero_proposta && (
            <div><Label className="text-xs">Nº Proposta</Label><Input value={form.numero_proposta} onChange={(e) => uf('numero_proposta', e.target.value)} placeholder="Ex: PRO17851" /></div>
          )}

          {/* ── Itens da Proposta (readonly snapshot) ── */}
          {proposalItems.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Itens da Proposta</h4>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-xs text-right">Qtd</TableHead>
                      <TableHead className="text-xs text-right">Unit (R$)</TableHead>
                      <TableHead className="text-xs text-right">Total (R$)</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposalItems.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs">{item.nome}</TableCell>
                        <TableCell className="text-xs text-right">{item.qtd}</TableCell>
                        <TableCell className="text-xs text-right">{Number(item.unit || 0).toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-xs text-right">{Number(item.total || 0).toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-xs">{item.equip_key ? <Badge variant="outline" className="text-[10px]">{EQUIP_CONFIG[item.equip_key as EquipKey]?.label || item.equip_key}</Badge> : <span className="text-muted-foreground">Insumo</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ── Equipamentos, Seriais + Tipo de Entrega ── */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Equipamentos e Seriais</h4>
            <EquipmentSerialsSection
              items={proposalItems}
              equipmentData={form.equipment_data as EquipmentData}
              onChange={(ed) => uf('equipment_data', ed)}
            />
          </div>

          {/* ── Acompanhantes (readonly) ── */}
          {companions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Acompanhantes</h4>
              <div className="flex flex-wrap gap-2">
                {companions.map((c: any) => (
                  <Badge key={c.id} variant="secondary" className="text-xs">{c.name}{c.especialidade ? ` (${c.especialidade})` : ''}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* ── Observações ── */}
          <div><Label className="text-xs">Observações</Label><Textarea value={form.notes} onChange={(e) => uf('notes', e.target.value)} rows={2} /></div>

          {/* ── Info readonly ── */}
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>Deal ID: {enrollment.deal_id || '—'} | Pipeline: {enrollment.deal_pipeline_name || '—'}</div>
            <div>Inscrito em: {enrollment.enrolled_at ? new Date(enrollment.enrolled_at).toLocaleString('pt-BR') : '—'}</div>
            <div>WA: {enrollment.wa_sent_at ? `Enviado ${new Date(enrollment.wa_sent_at).toLocaleString('pt-BR')}` : enrollment.wa_error ? `Erro: ${enrollment.wa_error}` : 'Não enviado'}</div>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Aba Inscrições ───
function InscricoesTab() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ search: "", status: "", course_id: "" });
  const { toast } = useToast();
  const qc = useQueryClient();
  const PAGE_SIZE = 50;
  const [editRow, setEditRow] = useState<any>(null);
  const [deleteRow, setDeleteRow] = useState<any>(null);
  const [certLoadingId, setCertLoadingId] = useState<string | null>(null);
  const [certCompanionLoadingId, setCertCompanionLoadingId] = useState<string | null>(null);

  const { data: courses = [] } = useQuery({
    queryKey: ["smartops_courses_list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("smartops_courses").select("id, title").order("title");
      return (data ?? []) as { id: string; title: string }[];
    },
  });

  const { data: result, isLoading } = useQuery({
    queryKey: ["smartops_enrollments", page, filters],
    queryFn: async () => {
      let q = (supabase as any)
        .from("smartops_course_enrollments")
        .select(
          `id, person_name, person_piperun_id, status, especialidade, area_atuacao,
           numero_contrato, numero_proposta, instagram, deal_title, deal_id, deal_value,
           deal_pipeline_name,
           empresa_cnpj, empresa_pais, empresa_estado, empresa_cidade, empresa_endereco, empresa_telefone,
           tipo_entrega, rastreamento, enrolled_at, lead_id, wa_sent_at, wa_error,
           turma_snapshot, equipment_data, proposal_items_snapshot, notes,
           turma_id, certificate_pdf_path, certificate_generated_at,
           course:smartops_courses(title, modality, instructor_name),
           turma:smartops_course_turmas(label),
           companions:smartops_enrollment_companions(id, name, email, phone, especialidade, area_atuacao, certificate_pdf_path, certificate_generated_at)`,
          { count: "exact" }
        )
        .order("enrolled_at", { ascending: false });

      if (filters.status) q = q.eq("status", filters.status);
      if (filters.course_id) q = q.eq("course_id", filters.course_id);
      if (filters.search) q = q.ilike("person_name", `%${filters.search}%`);

      q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as any[], count: count ?? 0 };
    },
  });

  const rows = result?.rows ?? [];
  const total = result?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleDelete = async () => {
    if (!deleteRow) return;
    try {
      await (supabase as any).from('smartops_enrollment_companions').delete().eq('enrollment_id', deleteRow.id);
      const { error } = await (supabase as any).from('smartops_course_enrollments').delete().eq('id', deleteRow.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["smartops_enrollments"] });
      qc.invalidateQueries({ queryKey: ["v_turmas_com_vagas"] });
      toast({ title: "Inscrição excluída" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDeleteRow(null);
    }
  };

  const handleGenerateCertificate = async (enrollment: any) => {
    if (!enrollment.turma_id) {
      toast({ title: "Erro", description: "Inscrição sem turma_id", variant: "destructive" });
      return;
    }
    setCertLoadingId(enrollment.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-certificate', {
        body: {
          turma_id: enrollment.turma_id,
          enrollment_ids: [enrollment.id],
          include_companions: false,
          regenerate: false,
        },
      });
      if (error) throw error;

      const cert = (data as any)?.certificates?.[0];
      const failed = (data as any)?.errors?.[0];
      if (failed) throw new Error(failed.error || 'Falha ao gerar certificado');
      if (!cert?.signed_url) throw new Error('PDF não retornado pela função');

      // Abrir PDF de forma robusta (preview do Lovable roda em iframe → popups bloqueados).
      // Estratégia: criar <a target="_blank"> e clicar. Se ainda assim bloquear, copia URL.
      const url: string = cert.signed_url;
      let opened = false;
      try {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        opened = true;
      } catch {
        opened = false;
      }
      if (!opened) {
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        opened = !!w;
      }
      // Sempre copiar para o clipboard como fallback
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }

      toast({
        title: cert.status === 'generated'
          ? 'Certificado gerado'
          : cert.status === 'regenerated_stale'
            ? 'Certificado atualizado'
            : 'Certificado pronto',
        description: opened
          ? cert.status === 'regenerated_stale'
            ? `${cert.person_name} — dados do curso mudaram, novo PDF gerado. Link copiado.`
            : `${cert.person_name} — link copiado para a área de transferência.`
          : `${cert.person_name} — popup bloqueado. Link copiado para a área de transferência, cole na barra de endereços.`,
      });

      qc.invalidateQueries({ queryKey: ["smartops_enrollments"] });
    } catch (e: any) {
      toast({
        title: 'Erro ao gerar certificado',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setCertLoadingId(null);
    }
  };

  const handleGenerateCompanionCertificate = async (enrollment: any, companion: any) => {
    if (!enrollment.turma_id) {
      toast({ title: "Erro", description: "Inscrição sem turma_id", variant: "destructive" });
      return;
    }
    setCertCompanionLoadingId(companion.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-certificate', {
        body: {
          turma_id: enrollment.turma_id,
          enrollment_ids: [enrollment.id],
          include_companions: true,
          regenerate: false,
        },
      });
      if (error) throw error;

      const certs = (data as any)?.certificates ?? [];
      const errs = (data as any)?.errors ?? [];
      const cert = certs.find((c: any) => c.type === 'companion' && c.id === companion.id);
      const failed = errs.find((e: any) => e.type === 'companion' && e.id === companion.id);
      if (failed) throw new Error(failed.error || 'Falha ao gerar certificado');
      if (!cert?.signed_url) throw new Error('PDF do acompanhante não retornado pela função');

      const url: string = cert.signed_url;
      let opened = false;
      try {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        opened = true;
      } catch {
        opened = false;
      }
      if (!opened) {
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        opened = !!w;
      }
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }

      toast({
        title: cert.status === 'generated' ? 'Certificado gerado' : 'Certificado pronto',
        description: opened
          ? `${cert.person_name} — link copiado para a área de transferência.`
          : `${cert.person_name} — popup bloqueado. Link copiado para a área de transferência, cole na barra de endereços.`,
      });

      qc.invalidateQueries({ queryKey: ["smartops_enrollments"] });
    } catch (e: any) {
      toast({
        title: 'Erro ao gerar certificado',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setCertCompanionLoadingId(null);
    }
  };

  const exportCSV = () => {
    if (!rows.length) return;
    const headers = ["Nome", "Curso", "Turma", "Deal", "Status", "Data Inscrição", "WA"];
    const csvRows = rows.map((r: any) => [
      r.person_name, r.course?.title, r.turma?.label, r.deal_id,
      r.status, r.enrolled_at?.substring(0, 10),
      r.wa_sent_at ? "Enviado" : r.wa_error ? "Erro" : "Pendente",
    ]);
    const csv = [headers, ...csvRows].map((r) => r.map((c: any) => `"${c ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `inscricoes_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const waIcon = (r: any) => {
    if (r.wa_sent_at) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (r.wa_error) return <XCircle className="w-4 h-4 text-red-500" />;
    if (!r.turma_snapshot?.days) return <Minus className="w-4 h-4 text-gray-400" />;
    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input placeholder="Buscar por nome..." value={filters.search}
            onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(0); }} />
        </div>
        <Select value={filters.status} onValueChange={(v) => { setFilters((f) => ({ ...f, status: v === "all" ? "" : v })); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filters.course_id} onValueChange={(v) => { setFilters((f) => ({ ...f, course_id: v === "all" ? "" : v })); setPage(0); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Curso" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cursos</SelectItem>
            {courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> CSV</Button>
      </div>

      {/* Lista agrupada por Curso/Turma */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando inscrições...</div>
      ) : rows.length === 0 ? (
        <div className="border rounded-md text-center py-8 text-muted-foreground">Nenhuma inscrição encontrada.</div>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {(() => {
            const groups = new Map<string, { course: string; turma: string; startDate?: string; rows: any[] }>();
            for (const r of rows) {
              const key = `${r.course?.title ?? '—'}__${r.turma?.label ?? '—'}`;
              if (!groups.has(key)) {
                groups.set(key, {
                  course: r.course?.title ?? '—',
                  turma: r.turma?.label ?? '—',
                  startDate: r.turma_snapshot?.days?.[0]?.date,
                  rows: [],
                });
              }
              groups.get(key)!.rows.push(r);
            }
            return Array.from(groups.entries()).map(([key, g]) => {
              const totalCompanions = g.rows.reduce((s, r) => s + (r.companions?.length ?? 0), 0);
              return (
                <AccordionItem key={key} value={key} className="border rounded-md overflow-hidden bg-card">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 [&[data-state=open]]:bg-muted/50 [&[data-state=open]]:border-b">
                    <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2">
                      <div className="text-left">
                        <div className="font-semibold">{g.course}</div>
                        <div className="text-xs text-muted-foreground font-normal">
                          Turma: {g.turma}{g.startDate ? ` · Início ${formatDatePtBr(g.startDate)}` : ''}
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <Badge variant="secondary">{g.rows.length} participante{g.rows.length !== 1 ? 's' : ''}</Badge>
                        {totalCompanions > 0 && (
                          <Badge variant="outline">{totalCompanions} acompanhante{totalCompanions !== 1 ? 's' : ''}</Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                  <div className="divide-y">
                    {g.rows.map((r: any) => {
                      const st = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG];
                      return (
                        <div key={r.id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{r.person_name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {r.deal_id ? `Deal ${r.deal_id} · ` : ''}Inscrito {r.enrolled_at ? formatDatePtBr(r.enrolled_at.substring(0,10)) : '—'}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={st?.badge}>{st?.label ?? r.status}</Badge>
                              <span title="WhatsApp">{waIcon(r)}</span>
                              <Button variant="ghost" size="sm" onClick={() => setEditRow(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={certLoadingId === r.id}
                                      onClick={() => handleGenerateCertificate(r)}
                                    >
                                      {certLoadingId === r.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Award className={`w-3.5 h-3.5 ${r.certificate_pdf_path ? 'text-green-600' : 'text-muted-foreground'}`} />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {r.certificate_pdf_path ? 'Abrir certificado' : 'Gerar certificado'}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <ComprovanteImersaoButton
                                enrollmentId={r.id}
                                personName={r.person_name}
                                turmaLabel={r.turma?.label}
                              />
                              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteRow(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                          {r.companions?.length > 0 && (
                            <div className="mt-2 ml-4 pl-3 border-l space-y-1">
                              <div className="text-xs text-muted-foreground">Acompanhantes ({r.companions.length}):</div>
                              {r.companions.map((c: any) => (
                                <div key={c.id} className="flex items-center gap-2 text-sm">
                                  <span className="flex-1 truncate">
                                    {c.name}
                                    {c.especialidade && <span className="text-muted-foreground"> · {c.especialidade}</span>}
                                  </span>
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          disabled={certCompanionLoadingId === c.id}
                                          onClick={() => handleGenerateCompanionCertificate(r, c)}
                                        >
                                          {certCompanionLoadingId === c.id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <Award className={`w-3.5 h-3.5 ${c.certificate_pdf_path ? 'text-green-600' : 'text-muted-foreground'}`} />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {c.certificate_pdf_path ? 'Abrir certificado' : 'Gerar certificado'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <ComprovanteImersaoButton
                                    enrollmentId={r.id}
                                    companionId={c.id}
                                    personName={c.name}
                                    turmaLabel={r.turma?.label}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </AccordionContent>
                </AccordionItem>
              );
            });
          })()}
        </Accordion>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{total} inscrições</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="text-sm py-1.5">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editRow && <EditEnrollmentDialog enrollment={editRow} open={!!editRow} onClose={() => setEditRow(null)} />}

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o agendamento de <strong>{deleteRow?.person_name}</strong> no curso <strong>{deleteRow?.course?.title}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Componente Raiz ───
export function SmartOpsCourses() {
  return (
    <Tabs defaultValue="agendamentos" className="space-y-4">
      <TabsList>
        <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
        <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
        <TabsTrigger value="inscricoes">Inscrições</TabsTrigger>
        <TabsTrigger value="publica">Página Pública</TabsTrigger>
      </TabsList>

      <TabsContent value="agendamentos">
        <AgendamentosTab />
      </TabsContent>
      <TabsContent value="catalogo">
        <CatalogoTab />
      </TabsContent>
      <TabsContent value="inscricoes">
        <InscricoesTab />
      </TabsContent>
      <TabsContent value="publica">
        <PaginaPublicaTab />
      </TabsContent>
    </Tabs>
  );
}

// ─── Aba Página Pública (embed) ───
function PaginaPublicaTab() {
  const { toast } = useToast();
  const publicUrl = "https://parametros.smartdent.com.br/agenda";
  const iframeSnippet = `<iframe src="${publicUrl}" style="width:100%;min-height:900px;border:0;" loading="lazy" title="Próximos Treinamentos"></iframe>`;
  const autoResizeSnippet = `<iframe id="smartdent-treinamentos" src="${publicUrl}" style="width:100%;min-height:600px;border:0;display:block;" loading="lazy" title="Próximos Treinamentos"></iframe>
<script>
(function(){
  function onMsg(e){
    if(!e.data || e.data.type !== 'smartdent:embed:treinamentos:height') return;
    var f = document.getElementById('smartdent-treinamentos');
    if(f && e.data.height) f.style.height = (e.data.height + 20) + 'px';
  }
  window.addEventListener('message', onMsg);
})();
<\/script>`;

  const fullHtmlSnippet = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Próximos Treinamentos | Smart Dent</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #fff; }
    .smartdent-wrap { max-width: 1200px; margin: 0 auto; }
    #smartdent-treinamentos { width: 100%; min-height: 600px; border: 0; display: block; }
  </style>
</head>
<body>
  <div class="smartdent-wrap">
    <iframe id="smartdent-treinamentos"
      src="${publicUrl}"
      loading="lazy"
      title="Próximos Treinamentos"></iframe>
  </div>
  <script>
    (function(){
      window.addEventListener('message', function(e){
        if(!e.data || e.data.type !== 'smartdent:embed:treinamentos:height') return;
        var f = document.getElementById('smartdent-treinamentos');
        if(f && e.data.height) f.style.height = (e.data.height + 20) + 'px';
      });
    })();
  <\/script>
</body>
</html>`;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: `${label} copiado!` }),
      () => toast({ title: "Erro ao copiar", variant: "destructive" })
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Embed em site externo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta página lista automaticamente todos os cursos <strong>Ativos</strong> e <strong>Públicos</strong> do catálogo,
            com suas próximas turmas e vagas disponíveis. Use o link ou cole o código abaixo no site externo.
          </p>

          <div>
            <Label className="text-xs">URL pública</Label>
            <div className="flex gap-2 mt-1">
              <Input value={publicUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copy(publicUrl, "Link")}>Copiar</Button>
              <Button variant="outline" onClick={() => window.open(publicUrl, "_blank")}>Abrir</Button>
            </div>
          </div>

          <div>
            <Label className="text-xs">Código iframe (simples)</Label>
            <div className="flex gap-2 mt-1">
              <Textarea value={iframeSnippet} readOnly rows={2} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copy(iframeSnippet, "Código")}>Copiar</Button>
            </div>
          </div>

          <div>
            <Label className="text-xs">Código iframe com auto-ajuste de altura (recomendado)</Label>
            <div className="flex gap-2 mt-1">
              <Textarea value={autoResizeSnippet} readOnly rows={8} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copy(autoResizeSnippet, "Código")}>Copiar</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              O iframe se ajusta automaticamente conforme o número de cursos exibidos.
            </p>
          </div>

          <div>
            <Label className="text-xs">HTML puro completo (página pronta para o servidor)</Label>
            <div className="flex gap-2 mt-1">
              <Textarea value={fullHtmlSnippet} readOnly rows={12} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copy(fullHtmlSnippet, "HTML")}>Copiar</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Salve como <code>treinamentos.html</code> e hospede em qualquer servidor — já vem com o auto-ajuste embutido.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pré-visualização</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden bg-muted/30">
            <iframe
              src={publicUrl}
              className="w-full"
              style={{ height: "800px", border: 0 }}
              title="Pré-visualização da página pública"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
