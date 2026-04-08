import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  Megaphone, RefreshCw, Cloud, Search, ArrowRight, ArrowLeft,
  Check, Send, Filter, Users, Clock, CheckCircle, XCircle, AlertCircle, Image
} from "lucide-react";

// ── Types ──
interface ContentItem {
  id: string;
  title: string | null;
  channel: string | null;
  content_type: string;
  content_text: string | null;
  product_name: string | null;
  thumbnail_url: string | null;
  quality_score: number | null;
  media_url: string | null;
  cta_url: string | null;
  synced_at: string | null;
  is_active: boolean | null;
}

interface CampaignSession {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  channel: string | null;
  content_id: string | null;
  content_type: string | null;
  lead_filters: any;
  lead_count: number | null;
  lead_ids: string[] | null;
  sent_count: number | null;
  failed_count: number | null;
  results: any;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  created_by: string | null;
}

interface SendLog {
  id: string;
  campaign_id: string;
  lead_id: string;
  status: string | null;
  sent_at: string | null;
  error_message: string | null;
  nome: string | null;
  telefone: string | null;
}

// ── Helpers ──
const channelColors: Record<string, string> = {
  whatsapp: "bg-green-100 text-green-800 border-green-300",
  instagram: "bg-pink-100 text-pink-800 border-pink-300",
  tiktok: "bg-slate-100 text-slate-800 border-slate-300",
  linkedin: "bg-blue-100 text-blue-800 border-blue-300",
  google_ads: "bg-amber-100 text-amber-800 border-amber-300",
  blog: "bg-indigo-100 text-indigo-800 border-indigo-300",
  youtube: "bg-red-100 text-red-800 border-red-300",
  web: "bg-cyan-100 text-cyan-800 border-cyan-300",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-100 text-blue-800",
  running: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  running: "Em execução",
  completed: "Concluída",
  cancelled: "Cancelada",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ══════════════════════════════════════════
// SUB-TAB 1: Content Library
// ══════════════════════════════════════════
function ContentLibrary({ onSelectContent }: { onSelectContent: (c: ContentItem) => void }) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [channelFilter, setChannelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [productSearch, setProductSearch] = useState("");

  const fetchContent = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("system_a_content_library")
      .select("id, title, channel, content_type, content_text, product_name, thumbnail_url, quality_score, media_url, cta_url, synced_at, is_active")
      .eq("is_active", true)
      .order("synced_at", { ascending: false })
      .limit(200);

    if (channelFilter !== "all") query = query.eq("channel", channelFilter);
    if (typeFilter !== "all") query = query.eq("content_type", typeFilter);
    if (productSearch.trim()) query = query.ilike("product_name", `%${productSearch.trim()}%`);

    const { data, error } = await query;
    if (error) { toast.error("Erro ao carregar conteúdo"); console.error(error); }
    setItems(data || []);
    setLoading(false);
  }, [channelFilter, typeFilter, productSearch]);

  const fetchMeta = useCallback(async () => {
    const { count } = await supabase.from("system_a_content_library").select("id", { count: "exact", head: true });
    setTotalCount(count || 0);
    const { data } = await supabase.from("system_a_content_library").select("synced_at").order("synced_at", { ascending: false }).limit(1);
    if (data?.[0]) setLastSync(data[0].synced_at);
  }, []);

  useEffect(() => { fetchContent(); }, [fetchContent]);
  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-content-from-a", { body: {} });
      if (error) throw error;
      toast.success(`Sincronização concluída: ${data?.results?.inserted ?? 0} inseridos`);
      fetchContent();
      fetchMeta();
    } catch (err) {
      toast.error(`Erro na sincronização: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  if (totalCount === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Cloud className="w-16 h-16 text-muted-foreground/40" />
        <p className="text-muted-foreground text-lg">Nenhum conteúdo sincronizado ainda</p>
        <Button onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar do Sistema A"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Biblioteca de Conteúdo do Sistema A</h3>
          <Badge variant="secondary">{totalCount} itens</Badge>
        </div>
        <div className="flex items-center gap-3">
          {lastSync && <span className="text-xs text-muted-foreground">Último sync: {formatDate(lastSync)}</span>}
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar Agora"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Canal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="google_ads">Google Ads</SelectItem>
            <SelectItem value="blog">Blog</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="campaign">Campaign</SelectItem>
            <SelectItem value="blog">Blog</SelectItem>
            <SelectItem value="landing_page">Landing Page</SelectItem>
            <SelectItem value="spin">SPIN</SelectItem>
            <SelectItem value="cs">CS</SelectItem>
            <SelectItem value="aftersales">Pós-venda</SelectItem>
            <SelectItem value="ads">Ads</SelectItem>
            <SelectItem value="social">Social</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por produto..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <Card key={item.id} className="flex flex-col hover:shadow-md transition-shadow">
              {item.thumbnail_url && (
                <div className="h-32 overflow-hidden rounded-t-lg bg-muted">
                  <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex gap-2 flex-wrap">
                  {item.channel && (
                    <Badge variant="outline" className={channelColors[item.channel] || ""}>
                      {item.channel}
                    </Badge>
                  )}
                  <Badge variant="outline">{item.content_type}</Badge>
                </div>
                <CardTitle className="text-sm line-clamp-2">{item.title || "Sem título"}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-2 pt-0">
                {item.content_text && (
                  <p className="text-xs text-muted-foreground line-clamp-3">{item.content_text.slice(0, 120)}</p>
                )}
                {item.product_name && (
                  <span className="text-xs font-medium text-primary">{item.product_name}</span>
                )}
                {item.quality_score != null && (
                  <div className="flex items-center gap-2">
                    <Progress value={item.quality_score} className="h-1.5 flex-1" />
                    <span className="text-[10px] text-muted-foreground">{item.quality_score}%</span>
                  </div>
                )}
                <Button size="sm" className="mt-auto" onClick={() => onSelectContent(item)}>
                  <Send className="w-3 h-3 mr-1.5" /> Usar em Campanha
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// SUB-TAB 2: Create Campaign (Wizard)
// ══════════════════════════════════════════
function CreateCampaign({
  preSelectedContent,
  onCreated,
}: {
  preSelectedContent: ContentItem | null;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);

  // Step 1
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(preSelectedContent);
  const [campaignName, setCampaignName] = useState("");
  const [campaignDesc, setCampaignDesc] = useState("");
  const [sendChannel, setSendChannel] = useState("whatsapp");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);

  // Step 2
  const [anchorProduct, setAnchorProduct] = useState("all");
  const [temperatura, setTemperatura] = useState("all");
  const [stageName, setStageName] = useState("all");
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // Options
  const [anchorOptions, setAnchorOptions] = useState<string[]>([]);
  const [stageOptions, setStageOptions] = useState<string[]>([]);

  useEffect(() => { setSelectedContent(preSelectedContent); }, [preSelectedContent]);

  // Fetch filter options
  useEffect(() => {
    (async () => {
      const { data: ap } = await supabase
        .from("lia_attendances")
        .select("anchor_product")
        .not("anchor_product", "is", null)
        .is("merged_into", null);
      const unique = [...new Set((ap || []).map(r => r.anchor_product).filter(Boolean))] as string[];
      setAnchorOptions(unique.sort());

      const { data: st } = await supabase
        .from("lia_attendances")
        .select("piperun_stage_name")
        .not("piperun_stage_name", "is", null)
        .is("merged_into", null);
      const uniqueStages = [...new Set((st || []).map(r => r.piperun_stage_name).filter(Boolean))] as string[];
      setStageOptions(uniqueStages.sort());
    })();
  }, []);

  // Content search
  useEffect(() => {
    if (!searchTerm.trim() || selectedContent) return;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("system_a_content_library")
        .select("id, title, channel, content_type, content_text, product_name, thumbnail_url, quality_score, media_url, cta_url, synced_at, is_active")
        .eq("is_active", true)
        .ilike("title", `%${searchTerm.trim()}%`)
        .limit(10);
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, selectedContent]);

  // Count leads in real time
  useEffect(() => {
    if (step !== 2) return;
    setCountLoading(true);
    const timer = setTimeout(async () => {
      let query = supabase
        .from("lia_attendances")
        .select("id", { count: "exact", head: true })
        .is("merged_into", null);

      if (anchorProduct !== "all") query = query.ilike("anchor_product", `%${anchorProduct}%`);
      if (temperatura !== "all") query = query.eq("temperatura_lead" as any, parseInt(temperatura));
      if (stageName !== "all") query = query.eq("piperun_stage_name", stageName);

      const { count } = await query;
      setLeadCount(count ?? 0);
      setCountLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [step, anchorProduct, temperatura, stageName]);

  const handleCreate = async () => {
    if (!selectedContent || !campaignName.trim()) return;
    setCreating(true);
    try {
      const filters: any = {};
      if (anchorProduct !== "all") filters.anchor_product = anchorProduct;
      if (temperatura !== "all") filters.temperatura_lead = parseInt(temperatura);
      if (stageName !== "all") filters.piperun_stage_name = stageName;

      const { error } = await supabase.from("campaign_sessions").insert({
        name: campaignName.trim(),
        description: campaignDesc.trim() || null,
        status: "draft",
        content_id: selectedContent.id,
        content_type: selectedContent.content_type,
        channel: sendChannel,
        lead_filters: Object.keys(filters).length ? filters : null,
        lead_count: leadCount,
      });
      if (error) throw error;
      toast.success("Campanha criada com sucesso!");
      onCreated();
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? "bg-primary text-primary-foreground" : step > s ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
            }`}>
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            <span className="text-sm hidden sm:inline">{s === 1 ? "Conteúdo" : s === 2 ? "Segmentação" : "Revisar"}</span>
            {s < 3 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Escolher Conteúdo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedContent ? (
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {selectedContent.channel && <Badge variant="outline" className={channelColors[selectedContent.channel] || ""}>{selectedContent.channel}</Badge>}
                    <Badge variant="outline">{selectedContent.content_type}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedContent(null)}>Trocar</Button>
                </div>
                <p className="font-medium">{selectedContent.title || "Sem título"}</p>
                {selectedContent.content_text && <p className="text-sm text-muted-foreground line-clamp-2">{selectedContent.content_text.slice(0, 200)}</p>}
                {selectedContent.thumbnail_url && <img src={selectedContent.thumbnail_url} alt="" className="h-24 rounded object-cover" />}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar conteúdo por título..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
                {searchResults.map(r => (
                  <div key={r.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-accent/5 cursor-pointer" onClick={() => { setSelectedContent(r); setSearchResults([]); }}>
                    <div>
                      <p className="text-sm font-medium">{r.title || "Sem título"}</p>
                      <div className="flex gap-1 mt-1">
                        {r.channel && <Badge variant="outline" className={`text-[10px] ${channelColors[r.channel] || ""}`}>{r.channel}</Badge>}
                        <Badge variant="outline" className="text-[10px]">{r.content_type}</Badge>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Nome da campanha *</label>
                <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex: Lançamento ExocadAI" />
              </div>
              <div>
                <label className="text-sm font-medium">Canal de envio</label>
                <Select value={sendChannel} onValueChange={setSendChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp (WaLeads)</SelectItem>
                    <SelectItem value="sellflux">SellFlux</SelectItem>
                    <SelectItem value="registro">Apenas registrar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <Input value={campaignDesc} onChange={(e) => setCampaignDesc(e.target.value)} placeholder="Objetivo da campanha..." />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!selectedContent || !campaignName.trim()}>
                Próximo <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" /> 2. Segmentar Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Produto âncora</label>
                <Select value={anchorProduct} onValueChange={setAnchorProduct}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {anchorOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Temperatura</label>
                <Select value={temperatura} onValueChange={setTemperatura}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="100">🔥 100 — Conquistado</SelectItem>
                    <SelectItem value="90">🟠 90 — Comprometido</SelectItem>
                    <SelectItem value="70">🟡 70 — Boas Chances</SelectItem>
                    <SelectItem value="50">🔵 50 — Em Processo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Etapa CRM</label>
                <Select value={stageName} onValueChange={setStageName}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {stageOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg bg-accent/5">
              <Users className="w-5 h-5 text-primary" />
              {countLoading ? (
                <span className="text-sm text-muted-foreground">Contando leads...</span>
              ) : (
                <span className="text-sm font-medium">
                  <Badge variant="secondary" className="text-base mr-2">{leadCount ?? 0}</Badge>
                  leads serão impactados
                </span>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep(3)} disabled={leadCount === 0}>
                Próximo <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Revisar e Criar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Campanha</span>
                <span className="font-medium">{campaignName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Canal</span>
                <Badge variant="outline">{sendChannel}</Badge>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Conteúdo</span>
                <span className="font-medium truncate max-w-[60%] text-right">{selectedContent?.title || "—"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Filtros</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {anchorProduct !== "all" && <Badge variant="outline">{anchorProduct}</Badge>}
                  {temperatura !== "all" && <Badge variant="outline">Temp: {temperatura}</Badge>}
                  {stageName !== "all" && <Badge variant="outline">{stageName}</Badge>}
                  {anchorProduct === "all" && temperatura === "all" && stageName === "all" && <span>Nenhum (todos os leads)</span>}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Leads estimados</span>
                <Badge>{leadCount ?? 0}</Badge>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Criando..." : "Criar Campanha"}
                <Megaphone className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// SUB-TAB 3: Campaign History
// ══════════════════════════════════════════
function CampaignHistory() {
  const [campaigns, setCampaigns] = useState<CampaignSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignSession | null>(null);
  const [sendLogs, setSendLogs] = useState<SendLog[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("campaign_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) toast.error("Erro ao carregar campanhas");
      setCampaigns(data || []);
      setLoading(false);
    })();
  }, []);

  const openDetail = async (c: CampaignSession) => {
    setSelectedCampaign(c);
    const { data } = await supabase
      .from("campaign_send_log")
      .select("id, campaign_id, lead_id, status, sent_at, error_message, nome, telefone")
      .eq("campaign_id", c.id)
      .order("sent_at", { ascending: false })
      .limit(200);
    setSendLogs(data || []);
  };

  if (loading) return <div className="h-40 flex items-center justify-center text-muted-foreground">Carregando...</div>;

  if (!campaigns.length) {
    return (
      <div className="flex flex-col items-center py-20 gap-3">
        <Clock className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Nenhuma campanha criada ainda</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">Canal</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-right p-3 font-medium">Leads</th>
              <th className="text-right p-3 font-medium">Enviados</th>
              <th className="text-right p-3 font-medium">Falhas</th>
              <th className="text-right p-3 font-medium">Taxa</th>
              <th className="text-left p-3 font-medium">Criada</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map(c => {
              const rate = c.lead_count && c.sent_count ? Math.round((c.sent_count / c.lead_count) * 100) : null;
              return (
                <tr key={c.id} className="border-b hover:bg-accent/5 cursor-pointer" onClick={() => openDetail(c)}>
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3"><Badge variant="outline" className={channelColors[c.channel || ""] || ""}>{c.channel || "—"}</Badge></td>
                  <td className="p-3"><Badge className={statusColors[c.status || "draft"]}>{statusLabels[c.status || "draft"]}</Badge></td>
                  <td className="p-3 text-right">{c.lead_count ?? "—"}</td>
                  <td className="p-3 text-right">{c.sent_count ?? "—"}</td>
                  <td className="p-3 text-right">{c.failed_count ?? "—"}</td>
                  <td className="p-3 text-right">{rate != null ? `${rate}%` : "—"}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedCampaign && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedCampaign.name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4 text-sm">
                <div className="flex gap-2">
                  <Badge className={statusColors[selectedCampaign.status || "draft"]}>{statusLabels[selectedCampaign.status || "draft"]}</Badge>
                  {selectedCampaign.channel && <Badge variant="outline" className={channelColors[selectedCampaign.channel] || ""}>{selectedCampaign.channel}</Badge>}
                </div>
                {selectedCampaign.description && <p className="text-muted-foreground">{selectedCampaign.description}</p>}

                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 border rounded">
                    <p className="text-2xl font-bold">{selectedCampaign.lead_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Leads</p>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <p className="text-2xl font-bold text-green-600">{selectedCampaign.sent_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Enviados</p>
                  </div>
                  <div className="text-center p-3 border rounded">
                    <p className="text-2xl font-bold text-red-600">{selectedCampaign.failed_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Falhas</p>
                  </div>
                </div>

                {selectedCampaign.lead_filters && (
                  <div>
                    <p className="font-medium mb-1">Filtros usados</p>
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(selectedCampaign.lead_filters as Record<string, any>).map(([k, v]) => (
                        <Badge key={k} variant="outline">{k}: {String(v)}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {sendLogs.length > 0 && (
                  <div>
                    <p className="font-medium mb-2">Log de envios ({sendLogs.length})</p>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {sendLogs.map(log => (
                        <div key={log.id} className="flex items-center justify-between border rounded p-2 text-xs">
                          <div>
                            <span className="font-medium">{log.nome || log.lead_id.slice(0, 8)}</span>
                            {log.telefone && <span className="ml-2 text-muted-foreground">{log.telefone}</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            {log.status === "sent" && <CheckCircle className="w-3 h-3 text-green-500" />}
                            {log.status === "failed" && <XCircle className="w-3 h-3 text-red-500" />}
                            {log.status === "pending" && <AlertCircle className="w-3 h-3 text-amber-500" />}
                            <span>{log.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Criada: {formatDate(selectedCampaign.created_at)}</p>
                  {selectedCampaign.started_at && <p>Iniciada: {formatDate(selectedCampaign.started_at)}</p>}
                  {selectedCampaign.completed_at && <p>Concluída: {formatDate(selectedCampaign.completed_at)}</p>}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════
export function SmartOpsCampaigns() {
  const [activeTab, setActiveTab] = useState("biblioteca");
  const [preSelectedContent, setPreSelectedContent] = useState<ContentItem | null>(null);

  const handleSelectContent = (content: ContentItem) => {
    setPreSelectedContent(content);
    setActiveTab("criar");
  };

  const handleCampaignCreated = () => {
    setPreSelectedContent(null);
    setActiveTab("historico");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Megaphone className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">Central de Campanhas</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="biblioteca">Biblioteca de Conteúdo</TabsTrigger>
          <TabsTrigger value="criar">Criar Campanha</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="biblioteca">
          <ContentLibrary onSelectContent={handleSelectContent} />
        </TabsContent>
        <TabsContent value="criar">
          <CreateCampaign preSelectedContent={preSelectedContent} onCreated={handleCampaignCreated} />
        </TabsContent>
        <TabsContent value="historico">
          <CampaignHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
