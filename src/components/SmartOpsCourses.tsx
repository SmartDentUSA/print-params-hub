import { useState, useEffect, useMemo } from "react";
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
import type { TurmaComVagas, SmartopsCourse, CourseEnrollment } from "@/types/courses";
import { MODALITY_CONFIG, STATUS_CONFIG, formatDatePtBr, formatWeekday } from "@/lib/courseUtils";
import { CourseCreateModal } from "./smartops/CourseCreateModal";
import { EnrollmentModal } from "./smartops/EnrollmentModal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EquipmentSerialsSection } from "./smartops/EquipmentSerialsSection";

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

  // Group by course_id (memoized for stable reference)
  const grouped = useMemo(() => {
    return turmas.reduce<Record<string, { course: Partial<SmartopsCourse>; turmas: TurmaComVagas[] }>>((acc, t) => {
      if (!acc[t.course_id]) {
        acc[t.course_id] = {
          course: {
            id: t.course_id,
            title: t.course_title || "Sem título",
            modality: t.modality || "presencial",
            instructor_name: t.instructor_name,
            location: t.location,
            meeting_link: t.meeting_link,
            pipeline_id_kanban: t.pipeline_id_kanban || 83896,
            stage_after_enroll: t.stage_after_enroll || "treinamento_agendado",
          } as Partial<SmartopsCourse>,
          turmas: [],
        };
      }
      acc[t.course_id].turmas.push(t);
      return acc;
    }, {});
  }, [turmas]);

  // Group by modality
  const byModality = useMemo(() => {
    const result: Record<string, Array<{ courseId: string; course: any; turmas: TurmaComVagas[] }>> = {};
    Object.entries(grouped).forEach(([courseId, { course, turmas: courseTurmas }]) => {
      const mod = (course.modality as string) || "presencial";
      if (!result[mod]) result[mod] = [];
      result[mod].push({ courseId, course, turmas: courseTurmas });
    });
    return result;
  }, [grouped]);

  const modalityLabels: Record<string, string> = {
    presencial: "Presencial",
    online_ao_vivo: "Online ao Vivo",
    hibrido: "Híbrido",
    gravado: "Gravado",
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando agendamentos...</div>;

  if (Object.keys(grouped).length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum agendamento disponível.</p>
        <p className="text-sm mt-1">Crie um curso na aba "Catálogo" para começar.</p>
      </div>
    );
  }


  return (
    <>
      <Accordion type="multiple" defaultValue={Object.keys(byModality)} className="space-y-4">
        {Object.entries(byModality).map(([modKey, courses]) => (
          <AccordionItem key={modKey} value={modKey} className="border rounded-lg">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold">{modalityLabels[modKey] || modKey}</span>
                <Badge variant="secondary">{courses.length} {courses.length === 1 ? "curso" : "cursos"}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-4 space-y-4">
              {courses.map(({ courseId, course, turmas: courseTurmas }) => {
                const mod = MODALITY_CONFIG[course.modality as keyof typeof MODALITY_CONFIG];
                return (
                  <Card key={courseId}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-lg">{course.title}</CardTitle>
                          {mod && <Badge className={mod.badge}>{mod.label}</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {course.instructor_name && (
                            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {course.instructor_name}</span>
                          )}
                          {course.location && <span>{course.location}</span>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-6">Turma</TableHead>
                            <TableHead><Clock className="w-3.5 h-3.5 inline mr-1" />Countdown</TableHead>
                            <TableHead>Dias</TableHead>
                            <TableHead className="text-center">Contratos</TableHead>
                            <TableHead className="text-center"><UserPlus className="w-3.5 h-3.5 inline mr-1" />Acomp.</TableHead>
                            <TableHead>Instrutor</TableHead>
                            <TableHead className="text-center"><Star className="w-3.5 h-3.5 inline mr-1" />NPS</TableHead>
                            <TableHead>Vagas</TableHead>
                            <TableHead className="text-right pr-6">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {courseTurmas.map((turma) => {
                            const pct = turma.slots > 0 ? ((turma.enrolled_count / turma.slots) * 100) : 0;
                            const lotado = turma.vagas_disponiveis === 0;
                            const countdown = getCountdown(turma.start_date, turma.start_time, turma.end_date, turma.end_time, course.modality);
                            const isEncerrado = countdown?.variant === 'muted';
                            const isInscricoesEncerradas = countdown?.variant === 'red';
                            const cannotEnroll = isEncerrado || isInscricoesEncerradas;

                            const weekdays: string[] = [];
                            if (turma.start_date) {
                              const start = new Date(turma.start_date + "T12:00:00");
                              const end = turma.end_date ? new Date(turma.end_date + "T12:00:00") : start;
                              const d = new Date(start);
                              while (d <= end) {
                                weekdays.push(d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""));
                                d.setDate(d.getDate() + 1);
                              }
                            }

                            return (
                              <TableRow key={turma.id} className={isEncerrado ? "opacity-50" : ""}>
                                <TableCell className="pl-6 font-medium">
                                  <div>
                                    <span>{turma.label}</span>
                                    {turma.start_date && (
                                      <div className="text-xs text-muted-foreground">
                                        {formatDatePtBr(turma.start_date)}
                                        {turma.end_date && turma.end_date !== turma.start_date && (
                                          <> – {formatDatePtBr(turma.end_date)}</>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {countdown && (
                                    <Badge
                                      variant={isEncerrado ? "secondary" : "outline"}
                                      className={`text-xs ${VARIANT_CLASSES[countdown.variant] || ''}`}
                                    >
                                      {countdown.label}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {weekdays.length > 0 ? weekdays.slice(0, 5).join(", ") : "—"}
                                </TableCell>
                                <TableCell className="text-center font-medium">{turma.enrolled_count}</TableCell>
                                <TableCell className="text-center text-muted-foreground">
                                  {(companionCounts as Record<string, number>)[turma.id] || 0}
                                </TableCell>
                                <TableCell className="text-sm">{course.instructor_name || "—"}</TableCell>
                                <TableCell className="text-center text-muted-foreground text-xs" title="Em breve">—</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 min-w-[120px]">
                                    <Progress value={pct} className="h-2 flex-1" />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {turma.enrolled_count}/{turma.slots}
                                    </span>
                                  </div>
                                  {lotado && <Badge variant="destructive" className="mt-1 text-[10px]">Lotado</Badge>}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <Button
                                    size="sm"
                                    variant={(lotado || cannotEnroll) ? "secondary" : "default"}
                                    disabled={lotado || cannotEnroll}
                                    onClick={() => setEnrollModal({ course: course as SmartopsCourse, turmaId: turma.id })}
                                  >
                                    {lotado ? "Sem vagas" : cannotEnroll ? countdown?.label ?? "Encerrado" : "Agendar"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

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

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando cursos...</div>;

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" /> Novo Curso</Button>
      </div>

      <div className="space-y-4">
        {courses.map((c) => {
          const mod = MODALITY_CONFIG[c.modality as keyof typeof MODALITY_CONFIG];
          const turmasList = (c.turmas ?? []) as any[];
          const isExpanded = expandedId === c.id;
          const visibleTurmas = isExpanded ? turmasList : turmasList.slice(0, 3);

          return (
            <Card key={c.id} className="overflow-hidden">
              <div className="flex">
                {c.cover_image_url ? (
                  <div className="w-32 shrink-0 bg-muted overflow-hidden hidden sm:block">
                    <img src={c.cover_image_url} alt={c.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-32 shrink-0 bg-muted items-center justify-center hidden sm:flex">
                    <Image className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                )}
                <CardContent className="pt-4 flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold leading-tight">{c.title}</h3>
                      {c.instructor_name && <p className="text-xs text-muted-foreground">Instrutor: {c.instructor_name}</p>}
                      {c.duration_days && <span className="text-xs text-muted-foreground">{c.duration_days} dia{c.duration_days > 1 ? 's' : ''}</span>}
                      {c.location && <span className="text-xs text-muted-foreground ml-2">{c.location}</span>}
                      <RecurrenceSummary course={c} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {mod && <Badge className={mod.badge}>{mod.label}</Badge>}
                      <Button variant="outline" size="sm" onClick={() => setEditCourse(c)}>
                        <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                      </Button>
                    </div>
                  </div>

                  {/* Turmas/Sessões */}
                  {turmasList.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Turmas e Sessões</h4>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border">
                            <th className="text-left py-1.5 pr-4 font-medium">Turma / Data</th>
                            <th className="text-left py-1.5 pr-4 font-medium">Horário</th>
                            <th className="text-right py-1.5 pr-4 font-medium">Inscritos</th>
                            <th className="text-right py-1.5 font-medium">Vagas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleTurmas.map((t: any) => (
                            <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="py-1.5 pr-4">
                                {t.start_date
                                  ? new Date(t.start_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
                                  : t.label}
                                {t.end_date && t.end_date !== t.start_date && (
                                  <span className="text-muted-foreground"> – {new Date(t.end_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                )}
                              </td>
                              <td className="py-1.5 pr-4 font-mono">
                                {t.start_time?.substring(0, 5)}–{t.end_time?.substring(0, 5)}
                              </td>
                              <td className="py-1.5 pr-4 text-right">{t.enrolled_count}</td>
                              <td className="py-1.5 text-right">
                                <span className={
                                  t.vagas_disponiveis === 0 ? 'text-red-500 font-medium' :
                                  t.vagas_disponiveis <= 3 ? 'text-amber-500' : 'text-muted-foreground'
                                }>
                                  {t.vagas_disponiveis === 0 ? 'Lotado' : `${t.vagas_disponiveis} restantes`}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {turmasList.length > 3 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 mt-2 flex items-center gap-1"
                        >
                          {isExpanded
                            ? <><ChevronUp className="w-3 h-3" /> Recolher</>
                            : <><ChevronDown className="w-3 h-3" /> Mostrar todas as {turmasList.length} sessões</>}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs pt-1 border-t">
                    <button className="flex items-center gap-1" onClick={() => toggleField(c.id, "active", !c.active)}>
                      {c.active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      {c.active ? "Ativo" : "Inativo"}
                    </button>
                    <button className="flex items-center gap-1" onClick={() => toggleField(c.id, "public_visible", !c.public_visible)}>
                      {c.public_visible ? <ToggleRight className="w-4 h-4 text-blue-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      {c.public_visible ? "Público" : "Privado"}
                    </button>
                  </div>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>

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
           companions:smartops_enrollment_companions(id, name, email, phone, especialidade, area_atuacao)`,
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

      window.open(cert.signed_url, '_blank');

      toast({
        title: cert.status === 'generated' ? 'Certificado gerado' : 'Certificado já existia',
        description: cert.person_name,
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

      {/* Tabela */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando inscrições...</div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Data Início</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">WA</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => {
                const st = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG];
                const startDate = r.turma_snapshot?.days?.[0]?.date;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.person_name}</div>
                      {r.deal_id && <div className="text-xs text-muted-foreground">Deal {r.deal_id}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{r.course?.title}</TableCell>
                    <TableCell className="text-sm">{r.turma?.label}</TableCell>
                    <TableCell className="text-sm">{startDate ? formatDatePtBr(startDate) : "—"}</TableCell>
                    <TableCell><Badge className={st?.badge}>{st?.label ?? r.status}</Badge></TableCell>
                    <TableCell className="text-center">{waIcon(r)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditRow(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteRow(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma inscrição encontrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
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
    </Tabs>
  );
}
