import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Loader2, Pencil, Plus, UserCircle, Star, Eye, MessageCircle } from "lucide-react";
import CoursesProfessionalProfile from "./CoursesProfessionalProfile";

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
  prof_rating_quality: number | null;
  prof_rating_price: number | null;
  prof_rating_value: number | null;
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lia_attendances")
        .select("id, nome, email, area_atuacao, especialidade, prof_photo_url, prof_cro, prof_course_platform, prof_updated_at, created_at, equip_scanner, equip_scanner_bancada, equip_impressora, prof_rating_quality, prof_rating_price, prof_rating_value")
        .not("prof_updated_at", "is", null)
        .is("merged_into", null)
        .order("prof_updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const list = (data ?? []) as Professional[];
      setProfessionals(list);

      // Carrega equipamentos a partir de deals ganhos
      const leadIds = list.map((p) => p.id);
      if (leadIds.length > 0) {
        const { data: wonDeals } = await supabase
          .from("deals")
          .select("id, lead_id")
          .in("lead_id", leadIds)
          .eq("status", "ganha");
        const dealIds = (wonDeals ?? []).map((d: any) => d.id);
        const dealToLead = new Map<string, string>((wonDeals ?? []).map((d: any) => [d.id, d.lead_id]));

        const map: Record<string, { scanner?: string; impressora?: string }> = {};
        if (dealIds.length > 0) {
          const { data: items } = await supabase
            .from("deal_items")
            .select("deal_id, product_name, synced_at")
            .in("deal_id", dealIds)
            .order("synced_at", { ascending: false });
          for (const it of (items ?? []) as any[]) {
            const leadId = dealToLead.get(it.deal_id);
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
            <p className="text-sm text-muted-foreground">Profissionais cadastrados e seus cursos</p>
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
                    <div className="text-lg font-semibold">0</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Cursos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">0</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Ativos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-600">0</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Realizados</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Eye className="w-3.5 h-3.5" />
                    <span><strong className="text-foreground">0</strong> visualizações</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span><strong className="text-foreground">0</strong> interessados</span>
                  </div>
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

                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p.email)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar perfil
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      toast({
                        title: "Em breve",
                        description: "Cadastro de cursos por profissional será liberado na próxima fase.",
                      })
                    }
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar curso
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
    </div>
  );
}