import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, GraduationCap, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import ProfessionalCourseForm from "@/components/smartops/courses/ProfessionalCourseForm";
import {
  COURSE_MODALITIES,
  COURSE_STATUS,
  emptyCourseDraft,
  type ProfessionalCourse,
  type ProfessionalCourseDraft,
} from "@/types/professionalCourses";

const FN_URL = "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/professional-course-portal";

interface ProfileState {
  id: string;
  nome: string | null;
  email: string | null;
  prof_photo_url: string | null;
  prof_cro: string | null;
  prof_mini_cv: string | null;
  prof_wa_ddi: string | null;
  prof_wa_number: string | null;
  instagram: string | null;
  prof_site: string | null;
  prof_city: string | null;
  prof_state: string | null;
}

export default function ProfessionalCoursePortal() {
  const { token = "" } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [courses, setCourses] = useState<ProfessionalCourse[]>([]);
  const [draft, setDraft] = useState<ProfessionalCourseDraft | null>(null);
  const [editProfile, setEditProfile] = useState(false);

  const call = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Erro ${res.status}`);
      return json;
    },
    [token],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await call("bootstrap");
      setProfile(data.professional ?? null);
      setCourses((data.courses ?? []) as ProfessionalCourse[]);
    } catch (e: any) {
      if (String(e.message).includes("invalid_token")) setInvalid(true);
      else toast({ title: "Erro ao carregar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [call, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (p: Partial<ProfessionalCourseDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const saveCourse = async () => {
    if (!draft?.title || draft.title.trim().length < 3) {
      toast({ title: "Informe o título do curso", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await call("save_course", { course: draft });
      toast({ title: "Curso salvo com sucesso" });
      setDraft(null);
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeCourse = async (c: ProfessionalCourse) => {
    if (!confirm(`Excluir o curso "${c.title}"?`)) return;
    try {
      await call("delete_course", { course_id: c.id });
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await call("save_profile", { professional: profile });
      toast({ title: "Dados atualizados" });
      setEditProfile(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando seu portal…
      </main>
    );
  }

  if (invalid || !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Link inválido ou expirado</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Solicite um novo link de acesso à equipe Smart Dent para cadastrar ou editar seus cursos.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Meus cursos</h1>
            <p className="text-sm text-muted-foreground">{profile.nome ?? profile.email}</p>
          </div>
        </header>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Meus dados</CardTitle>
            {editProfile ? (
              <Button size="sm" onClick={saveProfile} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditProfile(true)}>
                <Pencil className="w-4 h-4 mr-2" /> Editar
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label>Nome</Label><Input disabled={!editProfile} value={profile.nome ?? ""} onChange={(e) => setProfile({ ...profile, nome: e.target.value })} /></div>
            <div><Label>CRO</Label><Input disabled={!editProfile} value={profile.prof_cro ?? ""} onChange={(e) => setProfile({ ...profile, prof_cro: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input disabled={!editProfile} value={profile.prof_wa_number ?? ""} onChange={(e) => setProfile({ ...profile, prof_wa_number: e.target.value })} /></div>
            <div><Label>Instagram</Label><Input disabled={!editProfile} value={profile.instagram ?? ""} onChange={(e) => setProfile({ ...profile, instagram: e.target.value })} /></div>
            <div><Label>Cidade</Label><Input disabled={!editProfile} value={profile.prof_city ?? ""} onChange={(e) => setProfile({ ...profile, prof_city: e.target.value })} /></div>
            <div><Label>Site</Label><Input disabled={!editProfile} value={profile.prof_site ?? ""} onChange={(e) => setProfile({ ...profile, prof_site: e.target.value })} /></div>
            <div className="md:col-span-3"><Label>Mini CV</Label><Textarea rows={3} disabled={!editProfile} value={profile.prof_mini_cv ?? ""} onChange={(e) => setProfile({ ...profile, prof_mini_cv: e.target.value })} /></div>
          </CardContent>
        </Card>

        {draft ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button size="sm" onClick={saveCourse} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar curso
              </Button>
            </div>
            <ProfessionalCourseForm value={draft} onChange={patch} mode="portal" />
            <div className="flex justify-end">
              <Button onClick={saveCourse} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar curso
              </Button>
            </div>
          </div>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Cursos cadastrados ({courses.length})</h2>
              <Button size="sm" onClick={() => setDraft(emptyCourseDraft())}>
                <Plus className="w-4 h-4 mr-2" /> Adicionar curso
              </Button>
            </div>
            {courses.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Você ainda não cadastrou cursos. Clique em <strong>Adicionar curso</strong>.</CardContent></Card>
            ) : (
              courses.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4 flex items-start gap-3">
                    {c.cover_image_url ? <img src={c.cover_image_url} alt={c.title} className="w-24 h-16 object-cover rounded border shrink-0" /> : null}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[COURSE_MODALITIES.find((m) => m.value === c.modality)?.label, c.city, c.start_date].filter(Boolean).join(" · ")}
                      </div>
                      <Badge variant="secondary" className="text-xs mt-1.5">
                        {COURSE_STATUS.find((s) => s.value === c.status)?.label ?? c.status}
                      </Badge>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => setDraft(c as unknown as ProfessionalCourseDraft)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeCourse(c)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        )}
      </div>
    </main>
  );
}