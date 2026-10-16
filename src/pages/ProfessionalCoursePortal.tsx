import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  BarChart3,
  FileText,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Save,
  Share2,
  Trash2,
  User,
  BookOpen,
  Handshake,
  Menu,
  Percent,
  X,
} from "lucide-react";
import ProfessionalCourseForm from "@/components/smartops/courses/ProfessionalCourseForm";
import CoursePreviewCard from "@/components/smartops/courses/CoursePreviewCard";
import KolContractPortalCard from "@/components/smartops/courses/KolContractPortalCard";
import PortalCollabCourseStats from "@/components/smartops/courses/portal/PortalCollabCourseStats";
import PortalOwnCourseStats from "@/components/smartops/courses/portal/PortalOwnCourseStats";
import PortalSocialStats from "@/components/smartops/courses/portal/PortalSocialStats";
import PortalPerformance from "@/components/smartops/courses/portal/PortalPerformance";
import PortalCommissionStats from "@/components/smartops/courses/portal/PortalCommissionStats";
import { useClientPresence } from "@/hooks/useClientPresence";
import { PushOptInBanner } from "@/components/PushOptInBanner";
import {
  COURSE_MODALITIES,
  COURSE_STATUS,
  emptyCourseDraft,
  type ProfessionalCourse,
  type ProfessionalCourseDraft,
} from "@/types/professionalCourses";

const FN_URL = "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/professional-course-portal";

const SMARTDENT_LOGO_URL =
  "https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png";

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
  prof_tiktok: string | null;
  prof_youtube: string | null;
  prof_site: string | null;
  prof_city: string | null;
  prof_state: string | null;
  area_atuacao: string | null;
  especialidade: string | null;
}

type SectionKey = "dados" | "contrato" | "comissao" | "visao" | "colaboracao" | "social" | "cursos";

const SECTIONS: { key: SectionKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "dados", label: "Meus dados", icon: User },
  { key: "contrato", label: "Contrato de parceria", icon: FileText },
  { key: "comissao", label: "Comissão vigente", icon: Percent },
  { key: "visao", label: "Visão geral", icon: BarChart3 },
  { key: "colaboracao", label: "Cursos Smart Dent", icon: Handshake },
  { key: "social", label: "Engajamento social", icon: Share2 },
  { key: "cursos", label: "Meus cursos", icon: BookOpen },
];

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
  const [section, setSection] = useState<SectionKey>("dados");
  const [menuOpen, setMenuOpen] = useState(false);

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

  useClientPresence(
    profile?.email || [profile?.prof_wa_ddi, profile?.prof_wa_number].filter(Boolean).join("") || null,
    { nome: profile?.nome ?? null, contexto: "portal-cursos" },
  );

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

  const submitCourse = async (c: ProfessionalCourse) => {
    try {
      await call("submit_course", { course_id: c.id });
      toast({ title: "Curso enviado para aprovação da equipe" });
      await load();
    } catch (e: any) {
      toast({ title: "Não foi possível enviar", description: e.message, variant: "destructive" });
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

  const initials = (profile.nome ?? profile.email ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const nav = (mobile = false) => (
    <nav className={mobile ? "flex gap-1 overflow-x-auto p-2" : "flex-1 space-y-1 p-3"}>
      {SECTIONS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => {
            setSection(key);
            setDraft(null);
            setMenuOpen(false);
          }}
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            section === key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          } ${mobile ? "" : "w-full"}`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          {label}
        </button>
      ))}
    </nav>
  );

  return (
    <main className="min-h-screen bg-muted/30 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card sticky top-0 h-screen">
        <div className="p-4 border-b">
          <img src={SMARTDENT_LOGO_URL} alt="Smart Dent" className="h-9 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-3 p-4 border-b">
          {profile.prof_photo_url ? (
            <img
              src={profile.prof_photo_url}
              alt={profile.nome ?? "Profissional"}
              className="w-10 h-10 rounded-full object-cover border-2 border-primary/20 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{profile.nome ?? profile.email}</div>
            <div className="text-xs text-muted-foreground truncate">Portal Profissional Parceiro</div>
          </div>
        </div>
        {nav()}
        <div className="p-4 border-t text-xs text-muted-foreground flex items-center gap-2">
          <GraduationCap className="w-4 h-4" /> Smart Dent | Fluxo Digital
        </div>
      </aside>

      {/* Coluna principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar mobile */}
        <div className="md:hidden sticky top-0 z-20 bg-card border-b">
          <div className="flex items-center gap-3 p-3">
            <img src={SMARTDENT_LOGO_URL} alt="Smart Dent" className="h-7 w-auto object-contain shrink-0" />
            <Button size="icon" variant="ghost" onClick={() => setMenuOpen((v) => !v)}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            {profile.prof_photo_url ? (
              <img
                src={profile.prof_photo_url}
                alt={profile.nome ?? "Profissional"}
                className="w-8 h-8 rounded-full object-cover border border-primary/20 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{profile.nome ?? profile.email}</div>
              <div className="text-xs text-muted-foreground">Portal Profissional Parceiro</div>
            </div>
          </div>
          {menuOpen && <div className="border-t">{nav(true)}</div>}
        </div>

        <div className="flex-1 p-4 md:p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            <PushOptInBanner />

            {section === "visao" && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">Visão geral</h2>
                <PortalPerformance token={token} />
              </section>
            )}

            {section === "contrato" && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">Contrato de parceria</h2>
                <KolContractPortalCard token={token} />
              </section>
            )}

            {section === "comissao" && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">Comissão vigente</h2>
                <PortalCommissionStats call={call} />
              </section>
            )}

            {section === "dados" && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">Meus dados</h2>
                <Card>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Perfil profissional</CardTitle>
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
                    <div><Label>E-mail</Label><Input disabled value={profile.email ?? ""} /></div>
                    <div><Label>CRO</Label><Input disabled={!editProfile} value={profile.prof_cro ?? ""} onChange={(e) => setProfile({ ...profile, prof_cro: e.target.value })} /></div>
                    <div><Label>Área de atuação</Label><Input disabled={!editProfile} value={profile.area_atuacao ?? ""} onChange={(e) => setProfile({ ...profile, area_atuacao: e.target.value })} /></div>
                    <div><Label>Especialidade</Label><Input disabled={!editProfile} value={profile.especialidade ?? ""} onChange={(e) => setProfile({ ...profile, especialidade: e.target.value })} /></div>
                    <div><Label>WhatsApp</Label><Input disabled={!editProfile} value={profile.prof_wa_number ?? ""} onChange={(e) => setProfile({ ...profile, prof_wa_number: e.target.value })} /></div>
                    <div><Label>Instagram</Label><Input disabled={!editProfile} value={profile.instagram ?? ""} onChange={(e) => setProfile({ ...profile, instagram: e.target.value })} /></div>
                    <div><Label>TikTok</Label><Input disabled={!editProfile} value={profile.prof_tiktok ?? ""} onChange={(e) => setProfile({ ...profile, prof_tiktok: e.target.value })} /></div>
                    <div><Label>YouTube</Label><Input disabled={!editProfile} value={profile.prof_youtube ?? ""} onChange={(e) => setProfile({ ...profile, prof_youtube: e.target.value })} /></div>
                    <div><Label>Cidade</Label><Input disabled={!editProfile} value={profile.prof_city ?? ""} onChange={(e) => setProfile({ ...profile, prof_city: e.target.value })} /></div>
                    <div><Label>Estado</Label><Input disabled={!editProfile} value={profile.prof_state ?? ""} onChange={(e) => setProfile({ ...profile, prof_state: e.target.value })} /></div>
                    <div><Label>Site</Label><Input disabled={!editProfile} value={profile.prof_site ?? ""} onChange={(e) => setProfile({ ...profile, prof_site: e.target.value })} /></div>
                    <div className="md:col-span-3"><Label>Mini CV</Label><Textarea rows={3} disabled={!editProfile} value={profile.prof_mini_cv ?? ""} onChange={(e) => setProfile({ ...profile, prof_mini_cv: e.target.value })} /></div>
                  </CardContent>
                </Card>
              </section>
            )}

            {section === "colaboracao" && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">Cursos Smart Dent em colaboração</h2>
                <PortalCollabCourseStats call={call} profName={profile.nome ?? ""} />
              </section>
            )}

            {section === "social" && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">Engajamento social</h2>
                <PortalSocialStats call={call} photoUrl={profile.prof_photo_url} profName={profile.nome ?? ""} />
              </section>
            )}

            {section === "cursos" &&
              (draft ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                    </Button>
                    <Button size="sm" onClick={saveCourse} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar curso
                    </Button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <ProfessionalCourseForm value={draft} onChange={patch} mode="portal" portalToken={token} />
                    <div className="lg:sticky lg:top-4 self-start"><CoursePreviewCard course={draft} producer={profile} /></div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={saveCourse} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar curso
                    </Button>
                  </div>
                </div>
              ) : (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Cursos cadastrados ({courses.length})</h2>
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
                            {(c as any).review_note && c.status === "rascunho" && (
                              <p className="text-xs mt-1.5 text-destructive">Ajustes pedidos pela equipe: {(c as any).review_note}</p>
                            )}
                            <PortalOwnCourseStats courseId={c.id} courseTitle={c.title} call={call} profName={profile.nome ?? ""} />
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {c.status === "rascunho" && (
                              <Button size="sm" variant="outline" onClick={() => submitCourse(c)}>Enviar para aprovação</Button>
                            )}
                            {c.status === "rascunho" && (
                              <Button size="icon" variant="ghost" onClick={() => setDraft(c as unknown as ProfessionalCourseDraft)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            {c.status === "rascunho" && (
                              <Button size="icon" variant="ghost" onClick={() => removeCourse(c)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </section>
              ))}
          </div>
        </div>
      </div>
    </main>
  );
}
