import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, Loader2, Pencil, Plus, Save, Trash2, Copy } from "lucide-react";
import ProfessionalCourseForm from "./ProfessionalCourseForm";
import { emptyCourseDraft, COURSE_MODALITIES, COURSE_STATUS, type ProfessionalCourse, type ProfessionalCourseDraft } from "@/types/professionalCourses";
import { getCourseStatusBadge } from "@/lib/courseStatusBadge";
import { normalizeInstructorName } from "@/lib/instructorNameMatch";
import { cn } from "@/lib/utils";

type SmartDentCourse = { id: string; title: string; modality: string | null; instructor_name: string | null; recommend_professional_ids: string[] | null };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  professional: { id: string; nome: string | null; email: string | null };
  onChanged?: () => void;
  /** abre direto no formulário de novo curso */
  startNew?: boolean;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export default function ProfessionalCoursesModal({ open, onOpenChange, professional, onChanged, startNew }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [courses, setCourses] = useState<ProfessionalCourse[]>([]);
  const [smartDentCourses, setSmartDentCourses] = useState<SmartDentCourse[]>([]);
  const [draft, setDraft] = useState<ProfessionalCourseDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("professional_courses")
        .select("*")
        .eq("producer_lead_id", professional.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCourses((data ?? []) as unknown as ProfessionalCourse[]);

      // Treinamentos Smart Dent sugeridos/aprovados para o profissional ("Cursos recomendados")
      const { data: recs } = await (supabase as any)
        .from("smartops_courses")
        .select("id, title, modality, instructor_name, recommend_professional_ids")
        .eq("recommend_on_instructor_card", true)
        .eq("active", true)
        .order("title", { ascending: true });
      const target = normalizeInstructorName(professional.nome);
      setSmartDentCourses(
        ((recs ?? []) as SmartDentCourse[]).filter(
          (c) =>
            (c.recommend_professional_ids ?? []).includes(professional.id) ||
            (target.length > 0 && normalizeInstructorName(c.instructor_name) === target),
        ),
      );
    } catch (e: any) {
      toast({ title: "Erro ao carregar cursos", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [professional.id, professional.nome, toast]);

  useEffect(() => {
    if (!open) return;
    setDraft(startNew ? emptyCourseDraft() : null);
    void load();
  }, [open, startNew, load]);

  const patch = (p: Partial<ProfessionalCourseDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const onUploadCover = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const key = `professional-courses/${professional.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("catalog-images").upload(key, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("catalog-images").getPublicUrl(key);
      patch({ cover_image_url: data.publicUrl });
      toast({ title: "Capa enviada" });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft?.title || draft.title.trim().length < 3) {
      toast({ title: "Informe o título do curso", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        ...draft,
        producer_lead_id: professional.id,
        slug: draft.slug || slugify(draft.title),
        published_at: draft.status === "publicado" ? draft.published_at ?? new Date().toISOString() : draft.published_at ?? null,
      };
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.views_count;
      delete payload.interested_count;

      if (draft.id) {
        const { error } = await supabase.from("professional_courses").update(payload).eq("id", draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("professional_courses").insert({ ...payload, created_source: "admin" });
        if (error) throw error;
      }
      toast({ title: "Curso salvo" });
      setDraft(null);
      await load();
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: ProfessionalCourse) => {
    if (!confirm(`Excluir o curso "${c.title}"?`)) return;
    const { error } = await supabase.from("professional_courses").delete().eq("id", c.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Curso excluído" });
    await load();
    onChanged?.();
  };

  const approveSmartDentCourse = async (c: SmartDentCourse) => {
    const ids = Array.from(new Set([...(c.recommend_professional_ids ?? []), professional.id]));
    const { error } = await (supabase as any)
      .from("smartops_courses")
      .update({ recommend_professional_ids: ids })
      .eq("id", c.id);
    if (error) {
      toast({ title: "Erro ao aprovar", description: error.message, variant: "destructive" });
      return;
    }
    await importSmartDentCourse(c);
  };

  // Importa o treinamento como curso editável do profissional, preservando os campos do treinamento.
  const importSmartDentCourse = async (c: SmartDentCourse) => {
    const existing = courses.find((pc: any) => pc.source_smartops_course_id === c.id);
    if (existing) {
      setDraft({ ...emptyCourseDraft(), ...(existing as any) });
      return;
    }
    const { data: full, error: e1 } = await (supabase as any).from("smartops_courses").select("*").eq("id", c.id).maybeSingle();
    if (e1 || !full) {
      toast({ title: "Erro ao importar", description: e1?.message ?? "Treinamento não encontrado", variant: "destructive" });
      return;
    }
    const { data: turmas } = await (supabase as any)
      .from("v_turmas_com_vagas")
      .select("start_date, end_date, start_time, end_time")
      .eq("course_id", c.id)
      .eq("active", true)
      .order("start_date", { ascending: true });
    const today = new Date().toISOString().slice(0, 10);
    const t = ((turmas ?? []) as any[]).find((x) => !x.start_date || (x.end_date ?? x.start_date) >= today) ?? null;
    const hours = full.duration_days && full.duration_hours_per_day ? Number(full.duration_days) * Number(full.duration_hours_per_day) : null;
    const insert: any = {
      producer_lead_id: professional.id,
      source_smartops_course_id: c.id,
      title: full.title,
      slug: slugify(`${full.title}-${professional.id.slice(0, 6)}`),
      description: full.description ?? null,
      modality: full.modality || "presencial",
      category: full.category ?? null,
      cover_image_url: full.cover_image_url ?? null,
      duration_days: full.duration_days ?? null,
      workload_hours: hours,
      start_date: t?.start_date ?? null,
      end_date: t?.end_date ?? null,
      start_time: t?.start_time ?? null,
      end_time: t?.end_time ?? null,
      venue: full.location ?? null,
      meeting_link: full.meeting_link ?? null,
      max_students: full.max_capacity ?? null,
      registration_url: full.public_enrollment_enabled && full.slug ? `/inscricao/${full.slug}` : full.signup_form_url ?? null,
      course_platform: "Smart Dent",
      tags: ["Smart Dent"],
      status: "publicado",
      public_visible: true,
      featured: true,
      published_at: new Date().toISOString(),
      created_source: "smartdent_import",
    };
    const { data: created, error } = await (supabase as any).from("professional_courses").insert(insert).select("*").single();
    if (error) {
      toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Curso importado", description: "Revise e complete os dados do curso." });
    await load();
    onChanged?.();
    setDraft({ ...emptyCourseDraft(), ...created });
  };

  const duplicate = async (c: ProfessionalCourse) => {
    const { id, created_at, updated_at, views_count, interested_count, ...rest } = c as any;
    const { error } = await supabase.from("professional_courses").insert({
      ...rest,
      title: `${c.title} (cópia)`,
      slug: slugify(`${c.title}-copia-${Date.now()}`),
      status: "rascunho",
      public_visible: false,
      published_at: null,
    });
    if (error) {
      toast({ title: "Erro ao duplicar", description: error.message, variant: "destructive" });
      return;
    }
    await load();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Cursos de {professional.nome ?? professional.email ?? "profissional"}
          </DialogTitle>
        </DialogHeader>

        {draft ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar à lista
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar curso
              </Button>
            </div>
            <ProfessionalCourseForm value={draft} onChange={patch} onUploadCover={onUploadCover} uploading={uploading} mode="admin" />
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar curso
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setDraft(emptyCourseDraft())}>
                <Plus className="w-4 h-4 mr-2" /> Novo curso
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
              </div>
            ) : (
              <>
            {smartDentCourses.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cursos Smart Dent associados
                </div>
                {smartDentCourses.map((c) => {
                  const approved = (c.recommend_professional_ids ?? []).includes(professional.id);
                  return (
                    <Card key={c.id}>
                      <CardContent className="p-4 flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{c.title}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {c.modality ?? ""}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <Badge variant="secondary" className="text-xs">Smart Dent</Badge>
                            <Badge variant="outline" className="text-xs">Cursos recomendados</Badge>
                            {approved && <Badge className="text-xs bg-emerald-600 text-white">Aprovado</Badge>}
                          </div>
                        </div>
                        {!approved && (
                          <Button size="sm" variant="outline" className="shrink-0" onClick={() => approveSmartDentCourse(c)}>
                            <Check className="w-4 h-4 mr-1" /> Aprovar
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                <p className="text-xs text-muted-foreground">
                  Aprove a associação para o treinamento aparecer no card do profissional. Estes treinamentos são gerenciados na aba Treinamentos.
                </p>
              </div>
            )}
            {courses.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum curso cadastrado para este profissional.</CardContent></Card>
            ) : (
              courses.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4 flex items-start gap-3">
                    {c.cover_image_url ? (
                      <img src={c.cover_image_url} alt={c.title} className="w-24 h-16 object-cover rounded border shrink-0" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[COURSE_MODALITIES.find((m) => m.value === c.modality)?.label, c.city, c.start_date].filter(Boolean).join(" · ")}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(() => {
                          const st = getCourseStatusBadge(c);
                          return (
                            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", st.cls)}>
                              {st.label}
                            </span>
                          );
                        })()}
                        <Badge variant="secondary" className="text-xs">{COURSE_STATUS.find((s) => s.value === c.status)?.label ?? c.status}</Badge>
                        {c.public_visible && <Badge variant="outline" className="text-xs">Público</Badge>}
                        {c.created_source === "portal" && <Badge variant="outline" className="text-xs">Via portal</Badge>}
                        {c.max_students ? <Badge variant="outline" className="text-xs">{c.enrolled_count}/{c.max_students} vagas</Badge> : null}
                        <Badge variant="outline" className="text-xs">{c.views_count ?? 0} views</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => setDraft(c as unknown as ProfessionalCourseDraft)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Duplicar" onClick={() => duplicate(c)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Excluir" onClick={() => remove(c)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}