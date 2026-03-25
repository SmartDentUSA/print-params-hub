import { useState } from "react";
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
  CalendarDays, Users, Plus, Search, Download, Send, Edit2, CheckCircle,
  XCircle, AlertTriangle, Minus, Image, ToggleLeft, ToggleRight,
} from "lucide-react";
import type { TurmaComVagas, SmartopsCourse, CourseEnrollment } from "@/types/courses";
import { MODALITY_CONFIG, STATUS_CONFIG, formatDatePtBr, formatWeekday } from "@/lib/courseUtils";
import { CourseCreateModal } from "./smartops/CourseCreateModal";
import { EnrollmentModal } from "./smartops/EnrollmentModal";

// ─── Aba Agendamentos ───
function AgendamentosTab() {
  const [enrollModal, setEnrollModal] = useState<{ course: SmartopsCourse; turmaId: string } | null>(null);

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

  // Agrupar por course_id
  const grouped = turmas.reduce<Record<string, { course: Partial<SmartopsCourse>; turmas: TurmaComVagas[] }>>((acc, t) => {
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
      <div className="space-y-6">
        {Object.entries(grouped).map(([courseId, { course, turmas: courseTurmas }]) => {
          const mod = MODALITY_CONFIG[course.modality as keyof typeof MODALITY_CONFIG];
          return (
            <Card key={courseId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{course.title}</CardTitle>
                    {mod && <Badge className={mod.badge}>{mod.label}</Badge>}
                  </div>
                  {course.instructor_name && (
                    <span className="text-sm text-muted-foreground">Instrutor: {course.instructor_name}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {courseTurmas.map((turma) => {
                    const pct = turma.slots > 0 ? ((turma.enrolled_count / turma.slots) * 100) : 0;
                    const lotado = turma.vagas_disponiveis === 0;
                    const ultimasVagas = !lotado && turma.vagas_disponiveis <= 3;

                    return (
                      <Card key={turma.id} className="border">
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{turma.label}</span>
                            {lotado && <Badge variant="destructive">Lotado</Badge>}
                            {ultimasVagas && (
                              <Badge className="bg-amber-100 text-amber-800">Últimas vagas!</Badge>
                            )}
                          </div>

                          {turma.start_date && (
                            <div className="text-sm text-muted-foreground">
                              <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
                              {formatDatePtBr(turma.start_date)} ({formatWeekday(turma.start_date)})
                              {turma.end_date && turma.end_date !== turma.start_date && (
                                <> a {formatDatePtBr(turma.end_date)}</>
                              )}
                              {turma.start_time && (
                                <span className="ml-2">{turma.start_time.substring(0, 5)}</span>
                              )}
                            </div>
                          )}

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span><Users className="w-3 h-3 inline mr-1" />{turma.enrolled_count}/{turma.slots}</span>
                              <span>{turma.vagas_disponiveis} vagas</span>
                            </div>
                            <Progress value={pct} className="h-2" />
                          </div>

                          <Button
                            size="sm"
                            className="w-full"
                            disabled={lotado}
                            onClick={() => setEnrollModal({ course: course as SmartopsCourse, turmaId: turma.id })}
                          >
                            {lotado ? "Sem vagas" : "Agendar"}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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

// ─── Aba Catálogo ───
function CatalogoTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [editCourse, setEditCourse] = useState<SmartopsCourse | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["smartops_courses"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("smartops_courses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SmartopsCourse[];
    },
  });

  const toggleField = async (id: string, field: "active" | "public_visible", value: boolean) => {
    const { error } = await (supabase as any)
      .from("smartops_courses")
      .update({ [field]: value })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["smartops_courses"] });
    }
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando cursos...</div>;

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Curso
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => {
          const mod = MODALITY_CONFIG[c.modality as keyof typeof MODALITY_CONFIG];
          return (
            <Card key={c.id} className="overflow-hidden">
              {c.cover_image_url && (
                <div className="h-36 bg-muted overflow-hidden">
                  <img src={c.cover_image_url} alt={c.title} className="w-full h-full object-cover" />
                </div>
              )}
              {!c.cover_image_url && (
                <div className="h-20 bg-muted flex items-center justify-center">
                  <Image className="w-8 h-8 text-muted-foreground/40" />
                </div>
              )}
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold leading-tight">{c.title}</h3>
                  {mod && <Badge className={`ml-2 shrink-0 ${mod.badge}`}>{mod.label}</Badge>}
                </div>
                {c.instructor_name && (
                  <p className="text-sm text-muted-foreground">Instrutor: {c.instructor_name}</p>
                )}
                <div className="flex items-center gap-3 text-xs">
                  <button
                    className="flex items-center gap-1"
                    onClick={() => toggleField(c.id, "active", !c.active)}
                  >
                    {c.active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    {c.active ? "Ativo" : "Inativo"}
                  </button>
                  <button
                    className="flex items-center gap-1"
                    onClick={() => toggleField(c.id, "public_visible", !c.public_visible)}
                  >
                    {c.public_visible ? <ToggleRight className="w-4 h-4 text-blue-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    {c.public_visible ? "Público" : "Privado"}
                  </button>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setEditCourse(c)}>
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
              </CardContent>
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

// ─── Aba Inscrições ───
function InscricoesTab() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ search: "", status: "", course_id: "" });
  const { toast } = useToast();
  const qc = useQueryClient();
  const PAGE_SIZE = 50;

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
          `id, person_name, status, numero_contrato, deal_title, deal_id, enrolled_at,
           wa_sent_at, wa_error, turma_snapshot, equipment_data,
           course:smartops_courses(title, modality),
           turma:smartops_course_turmas(label)`,
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

  const updateStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any)
      .from("smartops_course_enrollments")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["smartops_enrollments"] });
    }
  };

  const resendWA = async (id: string) => {
    toast({ title: "Reenvio WA", description: "Funcionalidade em breve." });
  };

  const exportCSV = () => {
    if (!rows.length) return;
    const headers = ["Nome", "Curso", "Turma", "Deal", "Status", "Data Inscrição", "WA"];
    const csvRows = rows.map((r: any) => [
      r.person_name,
      r.course?.title,
      r.turma?.label,
      r.deal_id,
      r.status,
      r.enrolled_at?.substring(0, 10),
      r.wa_sent_at ? "Enviado" : r.wa_error ? "Erro" : "Pendente",
    ]);
    const csv = [headers, ...csvRows].map((r) => r.map((c: any) => `"${c ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscricoes_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          <Input
            placeholder="Buscar por nome..."
            value={filters.search}
            onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(0); }}
          />
        </div>
        <Select value={filters.status} onValueChange={(v) => { setFilters((f) => ({ ...f, status: v === "all" ? "" : v })); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.course_id} onValueChange={(v) => { setFilters((f) => ({ ...f, course_id: v === "all" ? "" : v })); setPage(0); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Curso" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cursos</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-1" /> CSV
        </Button>
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
                    <TableCell>
                      <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                        <SelectTrigger className="h-7 w-[130px]">
                          <Badge className={st?.badge}>{st?.label ?? r.status}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">{waIcon(r)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => resendWA(r.id)}>
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma inscrição encontrada.
                  </TableCell>
                </TableRow>
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
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-sm py-1.5">
              {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
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
