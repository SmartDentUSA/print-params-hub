import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import PortalMyData, { type PortalProfile } from "@/components/smartops/courses/portal/PortalMyData";
import PortalPriceTables from "@/components/smartops/courses/portal/PortalPriceTables";
import PortalPhoneLogin from "@/components/smartops/courses/portal/PortalPhoneLogin";
import PortalMaterials from "@/components/smartops/courses/portal/PortalMaterials";
import { QrCode, Receipt } from "lucide-react";
import PortalSpecialistCard, { type PortalSpecialist } from "@/components/smartops/courses/portal/PortalSpecialistCard";
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

type ProfileState = PortalProfile;

type SectionKey = "dados" | "contrato" | "comissao" | "precos" | "visao" | "colaboracao" | "social" | "cursos" | "materiais";

const SECTIONS: { key: SectionKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "dados", label: "Meus dados", icon: User },
  { key: "contrato", label: "Contrato de parceria", icon: FileText },
  { key: "comissao", label: "Comissão vigente", icon: Percent },
  { key: "precos", label: "Tabela de preços", icon: Receipt },
  { key: "visao", label: "Performance", icon: BarChart3 },
  { key: "colaboracao", label: "Cursos Smart Dent", icon: Handshake },
  { key: "social", label: "Engajamento social", icon: Share2 },
  { key: "cursos", label: "Meus cursos", icon: BookOpen },
  { key: "materiais", label: "Materiais de divulgação", icon: QrCode },
];

export default function ProfessionalCoursePortal() {
  const { token: routeToken = "" } = useParams();
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem("kol_portal_session") ?? "");
  // Link com token (legado) OU sessão de celular verificada — a edge aceita ambos no campo token
  const token = routeToken || sessionToken;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [courses, setCourses] = useState<ProfessionalCourse[]>([]);
  const [specialist, setSpecialist] = useState<PortalSpecialist | null>(null);
  const [draft, setDraft] = useState<ProfessionalCourseDraft | null>(null);
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
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await call("bootstrap");
      setProfile(data.professional ?? null);
      setSpecialist(data.specialist ?? null);
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


  if (!token) {
    return <PortalPhoneLogin onSession={(s) => setSessionToken(s)} />;
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-muted/40 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando seu portal…
      </main>
    );
  }

  if (invalid || !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-muted/40">
        <Card className="max-w-md w-full shadow-lg">
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
    <nav className={mobile ? "flex gap-1.5 overflow-x-auto p-2" : "flex-1 space-y-1 px-3 py-4"}>
      {SECTIONS.map(({ key, label, icon: Icon }) => {
        const active = section === key;
        return (
          <button
            key={key}
            onClick={() => {
              setSection(key);
              setDraft(null);
              setMenuOpen(false);
            }}
            className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
              active
                ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            } ${mobile ? "" : "w-full"}`}
          >
            {!mobile && (
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-primary transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
            )}
            <Icon className={`w-4 h-4 shrink-0 ${active ? "text-primary" : ""}`} />
            {label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <main className="min-h-screen bg-muted/40 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col border-r bg-card/80 backdrop-blur sticky top-0 h-screen">
        <div className="px-5 py-5 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <img src={SMARTDENT_LOGO_URL} alt="Smart Dent" className="h-9 w-auto object-contain" />
          <p className="mt-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Portal Profissional Parceiro
          </p>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          {profile.prof_photo_url ? (
            <img
              src={profile.prof_photo_url}
              alt={profile.nome ?? "Profissional"}
              className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/30 ring-offset-2 ring-offset-card shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold shrink-0 ring-2 ring-primary/20">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{profile.nome ?? profile.email}</div>
            <Badge variant="secondary" className="mt-1 text-[10px] font-medium">Parceiro KOL</Badge>
          </div>
        </div>
        <PortalSpecialistCard specialist={specialist} groupLink={(profile as any).kol_whatsapp_group_link} />
        {nav()}
        <div className="px-5 py-4 border-t text-xs text-muted-foreground flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-primary/70" /> Smart Dent | Fluxo Digital
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
          <div className="max-w-6xl mx-auto space-y-6">
            <PushOptInBanner />

            {/* Cabeçalho da seção ativa */}
            {(() => {
              const active = SECTIONS.find((s) => s.key === section);
              if (!active || draft) return null;
              const ActiveIcon = active.icon;
              return (
                <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent pointer-events-none" />
                  <div className="relative flex items-center gap-4 px-6 py-5">
                    <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <ActiveIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-xl font-semibold tracking-tight truncate">{active.label}</h1>
                      <p className="text-sm text-muted-foreground truncate">
                        {profile.nome ?? profile.email} · Portal Profissional Parceiro
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {section === "visao" && (
              <section className="space-y-4">
                <PortalPerformance token={token} />
              </section>
            )}

            {section === "contrato" && (
              <section className="space-y-4">
                <KolContractPortalCard token={token} />
              </section>
            )}

            {section === "precos" && (
              <section className="space-y-4">
                <PortalPriceTables call={call} />
              </section>
            )}

            {section === "comissao" && (
              <section className="space-y-4">
                <PortalCommissionStats call={call} />
              </section>
            )}

            {section === "materiais" && (
              <section className="space-y-4">
                <PortalMaterials call={call} />
              </section>
            )}

            {section === "dados" && (
              <section className="space-y-4">
                <PortalMyData profile={profile} onProfileChange={(p) => setProfile(p)} call={call} />
              </section>
            )}

            {section === "colaboracao" && (
              <section className="space-y-4">
                <PortalCollabCourseStats call={call} profName={profile.nome ?? ""} />
              </section>
            )}

            {section === "social" && (
              <section className="space-y-4">
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
                    <h2 className="text-base font-semibold text-muted-foreground">Cursos cadastrados ({courses.length})</h2>
                    <Button size="sm" onClick={() => setDraft(emptyCourseDraft())}>
                      <Plus className="w-4 h-4 mr-2" /> Adicionar curso
                    </Button>
                  </div>
                  {courses.length === 0 ? (
                    <Card><CardContent className="py-10 text-center text-muted-foreground">Você ainda não cadastrou cursos. Clique em <strong>Adicionar curso</strong>.</CardContent></Card>
                  ) : (
                    courses.map((c) => (
                      <Card key={c.id} className="shadow-sm hover:shadow-md transition-shadow">
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
