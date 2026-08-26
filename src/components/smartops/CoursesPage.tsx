import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Loader2, Pencil, Plus, UserCircle, Star, Eye, MessageCircle, Link2, BookOpen } from "lucide-react";
import CoursesProfessionalProfile from "./CoursesProfessionalProfile";
import ProfessionalCoursesModal from "./courses/ProfessionalCoursesModal";
import ShareCoursePortalDialog from "./courses/ShareCoursePortalDialog";
import { getCourseStatusBadge } from "@/lib/courseStatusBadge";
import { cn } from "@/lib/utils";
import { fetchPurchaseSummaries, EMPTY_SUMMARY, type PurchaseSummary } from "@/hooks/useProfessionalPurchaseSummary";
import ProfessionalKolCardStats from "./ProfessionalKolCardStats";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}


function formatClienteDesde(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function avgRating(p: { prof_rating_quality: number | null; prof_rating_price: number | null; prof_rating_value: number | null }): number {
  const vals = [p.prof_rating_quality, p.prof_rating_price, p.prof_rating_value].filter((v): v is number => typeof v === "number" && v > 0);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function StarRating({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= full ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{value > 0 ? value.toFixed(1) : "—"}</span>
    </div>
  );
}

type Professional = {
  id: string;
  nome: string | null;
  email: string | null;
  area_atuacao: string | null;
  especialidade: string | null;
  prof_photo_url: string | null;
  prof_cro: string | null;
  prof_course_platform: string | null;
  prof_updated_at: string | null;
  created_at: string | null;
  equip_scanner: string | null;
  equip_scanner_bancada: string | null;
  equip_impressora: string | null;
  equip_cad: string | null;
  prof_rating_quality: number | null;
  prof_rating_price: number | null;
  prof_rating_value: number | null;
  prof_wa_ddi?: string | null;
  prof_wa_number?: string | null;
  prof_kol_form_ids?: { id: string; name: string }[] | null;
  prof_kol_coupons?: { code: string; active_from?: string | null; active_to?: string | null }[] | null;
};


type CourseStats = { total: number; ativos: number; realizados: number; views: number; interested: number };

type ProfCourseRow = {
  id: string;
  producer_lead_id: string;
  title: string;
  status: string | null;
  modality: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  enrolled_count: number | null;
  max_students: number | null;
  views_count: number | null;
  interested_count: number | null;
};

// Classificação de equipamentos a partir de deals ganhos (espelha smart-ops-backfill-equipment-from-deals).
const ACCESSORY_RE = /\b(painel\s+lcd|tela\s+lcd|teflon|fep|nfep|pelicula|película|filme|filtro|fonte|placa\s+m[ãa]e|cabo|adesivo|parafuso|kit\s+(?:de\s+)?(?:reposi[çc][ãa]o|manuten[çc][ãa]o|limpeza)|reposi[çc][ãa]o|manuten[çc][ãa]o|spare|cartucho|bandeja|plataforma\s+de?\s+constru[çc][ãa]o|build\s*plate|vat|cuba|elastico|elástico|bombinha|seringa|ponta|broca|garantia|extensao|extensão|treinamento|curso|aula|consultoria|servi[çc]o|frete|instala[çc][ãa]o)\b/i;
const SCANNER_RE = /\b(medit\s*i[567]00|i600|i700|aoralscan\s*\d?|trios\s*\d|itero|primescan|panda\s*p\d|launca\s*\w*|runyes|shining\s*\w*|emerald)\b/i;
const IMPRESSORA_RE = /\b(halot\s*(?:one|mage|max|sky|ray)[\w\s\-]*|elegoo\s+(?:mars|saturn|jupiter)\s*\d?\s*(?:ultra|pro|plus|s|m|max)?|mars\s*\d\s*(?:ultra|pro)?|saturn\s*\d\s*(?:ultra|pro|s)?|phrozen\s+(?:sonic|mighty|shuffle)[\w\s\-]*|sonic\s+(?:mini|mighty|xl)[\w\s\-]*|anycubic\s+(?:photon|mono)[\w\s\-]*|miicraft[\w\s\-]*|rayshape\s+(?:edge|shape)[\w\s\-]*|edge\s*mini|edgemini|nextdent\s*\w*|asiga\s+\w+|formlabs\s+form\s*\d)\b/i;

function detectEquip(name: string): { scanner?: string; impressora?: string } {
  const n = (name || "").toLowerCase();
  if (!n || ACCESSORY_RE.test(n)) return {};
  const s = n.match(SCANNER_RE);
  if (s) return { scanner: s[0].replace(/\s+/g, " ").trim() };
  const i = n.match(IMPRESSORA_RE);
  if (i) return { impressora: i[0].replace(/\s+/g, " ").trim() };
  return {};
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export default function CoursesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [wonEquip, setWonEquip] = useState<Record<string, { scanner?: string; impressora?: string }>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | undefined>(undefined);
  const [courseStats, setCourseStats] = useState<Record<string, CourseStats>>({});
  const [coursesByProf, setCoursesByProf] = useState<Record<string, ProfCourseRow[]>>({});
  const [coursesFor, setCoursesFor] = useState<Professional | null>(null);
  const [coursesStartNew, setCoursesStartNew] = useState(false);
  const [shareFor, setShareFor] = useState<Professional | null>(null);
  const [summaries, setSummaries] = useState<Record<string, PurchaseSummary>>({});


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lia_attendances")
        .select("id, nome, email, area_atuacao, especialidade, prof_photo_url, prof_cro, prof_course_platform, prof_updated_at, created_at, equip_scanner, equip_scanner_bancada, equip_impressora, equip_cad, prof_rating_quality, prof_rating_price, prof_rating_value, prof_wa_ddi, prof_wa_number, prof_kol_form_ids, prof_kol_coupons")
        .not("prof_updated_at", "is", null)
        .is("merged_into", null)
        .order("prof_updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const list = (data ?? []) as Professional[];
      setProfessionals(list);

      // Carrega equipamentos a partir de deals ganhos
      const leadIds = list.map((p) => p.id);

      // Estatísticas de cursos por profissional
      if (leadIds.length > 0) {
        const { data: pcourses } = await supabase
          .from("professional_courses")
          .select("id, producer_lead_id, title, status, modality, start_date, end_date, start_time, end_time, enrolled_count, max_students, views_count, interested_count")
          .in("producer_lead_id", leadIds)
          .order("start_date", { ascending: true, nullsFirst: false });
        const stats: Record<string, CourseStats> = {};
        const grouped: Record<string, ProfCourseRow[]> = {};
        const today = new Date().toISOString().slice(0, 10);
        for (const c of (pcourses ?? []) as any[]) {
          const s = (stats[c.producer_lead_id] ??= { total: 0, ativos: 0, realizados: 0, views: 0, interested: 0 });
          s.total += 1;
          const encerrado = c.status === "encerrado" || (c.end_date && c.end_date < today);
          if (encerrado) s.realizados += 1;
          else if (c.status === "publicado") s.ativos += 1;
          s.views += c.views_count ?? 0;
          s.interested += c.interested_count ?? 0;
          (grouped[c.producer_lead_id] ??= []).push(c as ProfCourseRow);
        }
        setCourseStats(stats);
        setCoursesByProf(grouped);
      } else {
        setCourseStats({});
        setCoursesByProf({});
      }

      if (leadIds.length > 0) {
        // Resumo financeiro real (CRM ganho / ERP Omie / e-commerce)
        fetchPurchaseSummaries(leadIds)
          .then(setSummaries)
          .catch(() => setSummaries({}));

        const { data: wonDeals } = await supabase
          .from("deals")
          .select("id, lead_id, piperun_deal_id")
          .in("lead_id", leadIds)
          .eq("status", "ganha");
        // deal_items.deal_id guarda o piperun_deal_id (texto), não o UUID de deals.id
        const dealIds = (wonDeals ?? [])
          .map((d: any) => (d.piperun_deal_id != null ? String(d.piperun_deal_id) : null))
          .filter((v: string | null): v is string => !!v);
        const dealToLead = new Map<string, string>(
          (wonDeals ?? [])
            .filter((d: any) => d.piperun_deal_id != null)
            .map((d: any) => [String(d.piperun_deal_id), d.lead_id])
        );

        const map: Record<string, { scanner?: string; impressora?: string }> = {};
        if (dealIds.length > 0) {
          const { data: items } = await supabase
            .from("deal_items")
            .select("deal_id, product_name, synced_at")
            .in("deal_id", dealIds)
            .order("synced_at", { ascending: false });
          for (const it of (items ?? []) as any[]) {
            const leadId = dealToLead.get(String(it.deal_id));
            if (!leadId) continue;
            const det = detectEquip(it.product_name || "");
            if (!map[leadId]) map[leadId] = {};
            if (det.scanner && !map[leadId].scanner) map[leadId].scanner = titleCase(det.scanner);
            if (det.impressora && !map[leadId].impressora) map[leadId].impressora = titleCase(det.impressora);
          }
        }
        setWonEquip(map);
      } else {
        setWonEquip({});
        setSummaries({});
      }

    } catch (e: any) {
      toast({ title: "Erro ao carregar profissionais", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditingEmail(undefined);
    setModalOpen(true);
  };

  const openEdit = (email: string | null) => {
    if (!email) return;
    setEditingEmail(email);
    setModalOpen(true);
  };

  const onSaved = () => {
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-2xl font-semibold">Cursos</h2>
            <p className="text-sm text-muted-foreground">KOLs cadastrados e cursos</p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Adicionar profissional
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
        </div>
      ) : professionals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum profissional cadastrado ainda. Clique em <strong>Adicionar profissional</strong> para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {professionals.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted overflow-hidden border shrink-0">
                    {p.prof_photo_url ? (
                      <img src={p.prof_photo_url} alt={p.nome ?? ""} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserCircle className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{p.nome ?? "(sem nome)"}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                    {p.prof_cro && (
                      <div className="text-xs text-muted-foreground">CRO: {p.prof_cro}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {p.area_atuacao && <Badge variant="secondary" className="text-xs">{p.area_atuacao}</Badge>}
                  {p.especialidade && <Badge variant="outline" className="text-xs">{p.especialidade}</Badge>}
                  {p.prof_course_platform && <Badge variant="outline" className="text-xs">{p.prof_course_platform}</Badge>}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  <div className="text-center">
                    <div className="text-lg font-semibold">{courseStats[p.id]?.total ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Cursos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">{courseStats[p.id]?.ativos ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Ativos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-600">{courseStats[p.id]?.realizados ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Realizados</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Eye className="w-3.5 h-3.5" />
                    <span><strong className="text-foreground">{courseStats[p.id]?.views ?? 0}</strong> visualizações</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span><strong className="text-foreground">{courseStats[p.id]?.interested ?? 0}</strong> interessados</span>
                  </div>
                </div>

                <div className="border-t pt-2 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Cursos</div>
                  {(coursesByProf[p.id] ?? []).length === 0 ? (
                    <div className="text-xs text-muted-foreground">Nenhum curso cadastrado.</div>
                  ) : (
                    (coursesByProf[p.id] ?? []).slice(0, 4).map((c) => {
                      const st = getCourseStatusBadge(c);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCoursesStartNew(false);
                            setCoursesFor(p);
                          }}
                          className="w-full text-left rounded-md border bg-muted/30 px-2 py-1.5 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium truncate flex-1">{c.title}</span>
                            <span className={cn("shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium", st.cls)}>
                              {st.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <UserCircle className="w-3 h-3" />
                              {c.enrolled_count ?? 0}{c.max_students ? `/${c.max_students}` : ""} inscritos
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {c.views_count ?? 0} views
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                  {(coursesByProf[p.id] ?? []).length > 4 && (
                    <button
                      type="button"
                      className="text-[11px] text-primary hover:underline"
                      onClick={() => {
                        setCoursesStartNew(false);
                        setCoursesFor(p);
                      }}
                    >
                      Ver todos os {(coursesByProf[p.id] ?? []).length} cursos
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Avaliações</span>
                  <StarRating value={avgRating(p)} />
                </div>

                <div className="space-y-1 text-xs border-t pt-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente desde:</span>
                    <span className="font-medium">{formatClienteDesde(p.created_at)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Scanner:</span>
                    <span className="font-medium truncate text-right">{wonEquip[p.id]?.scanner || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Impressora 3D:</span>
                    <span className="font-medium truncate text-right">{wonEquip[p.id]?.impressora || "—"}</span>
                  </div>
                </div>

                {(() => {
                  const s = summaries[p.id] ?? EMPTY_SUMMARY;
                  return (
                    <div className="space-y-1 text-xs border-t pt-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                        Informações comerciais
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Última compra:</span>
                        <span className="font-medium text-right truncate">
                          {s.purchaseCount > 0 ? fmtDate(s.lastPurchaseDate) : "Sem compras"}
                        </span>
                      </div>
                      {s.purchaseCount > 0 && s.lastPurchaseName && (
                        <div className="text-[11px] text-muted-foreground truncate" title={s.lastPurchaseName}>
                          {s.lastPurchaseName}
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Vendedor:</span>
                        <span className="font-medium text-right truncate">{s.lastPurchaseVendor || "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Total investido:</span>
                        <span className="font-semibold text-right text-green-600">{fmtBRL(s.totalInvested)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Nº de compras:</span>
                        <span className="font-medium text-right">
                          {s.purchaseCount} {s.purchaseCount === 1 ? "compra" : "compras"}
                        </span>
                      </div>
                    </div>
                  );
                })()}


                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(p.email)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar perfil
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setCoursesStartNew(true);
                      setCoursesFor(p);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar curso
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setCoursesStartNew(false);
                      setCoursesFor(p);
                    }}
                  >
                    <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Ver cursos
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShareFor(p)}>
                    <Link2 className="w-3.5 h-3.5 mr-1.5" /> Compartilhar link
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmail ? "Editar profissional" : "Adicionar profissional"}</DialogTitle>
          </DialogHeader>
          <CoursesProfessionalProfile
            key={editingEmail ?? "new"}
            initialEmail={editingEmail}
            startEditing={Boolean(editingEmail)}
            onSaved={onSaved}
          />
        </DialogContent>
      </Dialog>

      {coursesFor && (
        <ProfessionalCoursesModal
          key={`${coursesFor.id}-${coursesStartNew}`}
          open={!!coursesFor}
          onOpenChange={(o) => !o && setCoursesFor(null)}
          professional={{ id: coursesFor.id, nome: coursesFor.nome, email: coursesFor.email }}
          startNew={coursesStartNew}
          onChanged={() => void load()}
        />
      )}

      {shareFor && (
        <ShareCoursePortalDialog
          open={!!shareFor}
          onOpenChange={(o) => !o && setShareFor(null)}
          professional={shareFor}
        />
      )}
    </div>
  );
}