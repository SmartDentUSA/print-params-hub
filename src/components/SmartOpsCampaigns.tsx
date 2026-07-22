import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CampaignLinkPicker } from "@/components/smartops/CampaignLinkPicker";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  Megaphone, RefreshCw, Cloud, Search, ArrowRight, ArrowLeft,
  Check, Send, Filter, Users, Clock, CheckCircle, XCircle, AlertCircle, Image, Smartphone, Copy
} from "lucide-react";
import { Save, Bookmark, Trash2 } from "lucide-react";
import { SmartOpsWaGroupCampaigns } from "@/components/smartops/wa-groups/SmartOpsWaGroupCampaigns";
import { EmailCampaignWizard } from "@/components/smartops/EmailCampaignWizard";

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
  results: {
    sms_message?: string;
    sms_codificacao?: string;
    sms_pdus?: number;
    sms_custo_por_pdu?: number;
    sent?: number;
    failed?: number;
  } | Record<string, unknown> | null | any;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  created_by: string | null;
}

interface SendLog {
  id: string;
  campaign_id: string | null;
  source_campaign_id?: string | null;
  lead_id: string;
  status: string | null;
  sent_at: string | null;
  error_message: string | null;
  nome: string | null;
  telefone: string | null;
  email?: string | null;
  provider_status?: string | null;
  provider_detail_code?: string | null;
  provider_detail_message?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  bounced_at?: string | null;
  bounce_reason?: string | null;
}

interface EmailStats {
  total: number;
  queued: number;
  sent: number;
  failed: number;
  bounced: number;
  opened: number;
  clicked: number;
  last_attempt_at: string | null;
}

interface SmsAttribution {
  sent: number;
  failed: number;
  delivered: number;
  taxa_entrega: number;
  pdus: number;
  custo_por_pdu: number;
  custo_total: number;
  custo_unitario: number;
  leads_gerados: number;
  deals_ganhos: number;
  receita: number;
  roi: number | null;
  utm_usado: string;
}

interface SavedSegment {
  id: string;
  name: string;
  description: string | null;
  filters: Record<string, any>;
  lead_count: number | null;
  lead_ids: string[] | null;
  last_refreshed_at: string | null;
  created_at: string | null;
}

interface DraftCampaign {
  id: string;
  nome: string;
  descricao: string | null;
  canal: string | null;
  status: string | null;
  mensagem_template: string | null;
  lead_filter: Record<string, any> | null;
  created_at: string | null;
  total_leads: number | null;
  audience_count: number | null;
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
  sms: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  queued: "bg-amber-100 text-amber-800",
  scheduled: "bg-blue-100 text-blue-800",
  running: "bg-amber-100 text-amber-800",
  sending: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  completed_with_errors: "bg-orange-100 text-orange-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  queued: "Na fila",
  scheduled: "Agendada",
  running: "Em execução",
  sending: "Enviando",
  completed: "Concluída",
  completed_with_errors: "Concluída c/ falhas",
  failed: "Falha total",
  cancelled: "Cancelada",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ══════════════════════════════════════════
// SUB-TAB 1: Content Library
// ══════════════════════════════════════════
const SEQUENCE_TYPES = ["cs", "aftersales", "spin", "promo"] as const;
const SEQUENCE_LABELS: Record<string, string> = {
  cs: "Sequência CS (7 msgs)",
  aftersales: "Pós-venda",
  spin: "SPIN",
  promo: "Promo (Gerador)",
};

interface ProductGroup {
  product_name: string;
  thumbnail_url: string | null;
  total: number;
  byType: Record<string, ContentItem[]>;
  lastSync: string | null;
}

function ContentLibrary({ onSelectContent }: { onSelectContent: (c: ContentItem) => void }) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState("all");
  const [productSearch, setProductSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    // Apenas mensagens de WhatsApp (sequências e promos) agrupadas por produto.
    let query = supabase
      .from("system_a_content_library")
      .select("id, title, channel, content_type, content_text, product_name, thumbnail_url, quality_score, media_url, cta_url, synced_at, is_active")
      .eq("is_active", true)
      .eq("channel", "whatsapp")
      .in("content_type", SEQUENCE_TYPES as unknown as string[])
      .order("synced_at", { ascending: false })
      .limit(2000);

    if (typeFilter !== "all") query = query.eq("content_type", typeFilter);
    if (productSearch.trim()) query = query.ilike("product_name", `%${productSearch.trim()}%`);

    const { data, error } = await query;
    if (error) { toast.error("Erro ao carregar conteúdo"); console.error(error); }
    setItems(data || []);
    setLoading(false);
  }, [typeFilter, productSearch]);

  const fetchMeta = useCallback(async () => {
    const { count } = await supabase
      .from("system_a_content_library")
      .select("id", { count: "exact", head: true })
      .eq("channel", "whatsapp")
      .in("content_type", SEQUENCE_TYPES as unknown as string[]);
    setTotalCount(count || 0);
    const { data } = await supabase
      .from("system_a_content_library")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1);
    if (data?.[0]) setLastSync(data[0].synced_at);
  }, []);

  useEffect(() => { fetchContent(); }, [fetchContent]);
  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  const productGroups: ProductGroup[] = useMemo(() => {
    const map = new Map<string, ProductGroup>();
    for (const it of items) {
      const name = (it.product_name || "Sem produto").trim();
      if (!map.has(name)) {
        map.set(name, {
          product_name: name,
          thumbnail_url: it.thumbnail_url,
          total: 0,
          byType: {},
          lastSync: it.synced_at,
        });
      }
      const g = map.get(name)!;
      g.total += 1;
      (g.byType[it.content_type] ||= []).push(it);
      if (!g.thumbnail_url && it.thumbnail_url) g.thumbnail_url = it.thumbnail_url;
    }
    // Ordena as mensagens internas por message_order/título
    for (const g of map.values()) {
      for (const k of Object.keys(g.byType)) {
        g.byType[k].sort((a, b) => (a.title || "").localeCompare(b.title || "", "pt-BR", { numeric: true }));
      }
    }
    return Array.from(map.values()).sort((a, b) => a.product_name.localeCompare(b.product_name, "pt-BR"));
  }, [items]);

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
        <p className="text-muted-foreground text-lg">Nenhuma sequência de WhatsApp sincronizada ainda</p>
        <p className="text-xs text-muted-foreground max-w-md text-center">
          Sincronize do Sistema A para listar os produtos que possuem Sequência de 7 Mensagens, Pós-venda, SPIN ou Promo.
        </p>
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
          <h3 className="text-lg font-semibold">Sequências WhatsApp por Produto</h3>
          <Badge variant="secondary">{productGroups.length} produtos · {totalCount} mensagens</Badge>
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tipo de sequência" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as sequências</SelectItem>
            <SelectItem value="cs">Sequência CS (7 msgs)</SelectItem>
            <SelectItem value="aftersales">Pós-venda</SelectItem>
            <SelectItem value="spin">SPIN</SelectItem>
            <SelectItem value="promo">Promo (Gerador WhatsApp)</SelectItem>
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

      {/* Grid de produtos */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : productGroups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhum produto com sequências encontrado para os filtros atuais.
        </div>
      ) : (
        <div className="space-y-3">
          {productGroups.map(group => {
            const isOpen = expanded === group.product_name;
            return (
              <Card key={group.product_name} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : group.product_name)}
                  className="w-full text-left flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                >
                  {group.thumbnail_url ? (
                    <img src={group.thumbnail_url} alt="" className="w-14 h-14 rounded-md object-cover bg-muted shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-md bg-muted shrink-0 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{group.product_name}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {SEQUENCE_TYPES.map(t => {
                        const n = group.byType[t]?.length ?? 0;
                        if (!n) return null;
                        return (
                          <Badge key={t} variant="outline" className="text-[10px]">
                            {SEQUENCE_LABELS[t]}: {n}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">{group.total} msgs</div>
                  <ArrowRight className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>

                {isOpen && (
                  <div className="border-t bg-muted/20 p-4 space-y-4">
                    {SEQUENCE_TYPES.map(t => {
                      const msgs = group.byType[t];
                      if (!msgs?.length) return null;
                      return (
                        <div key={t}>
                          <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                            {SEQUENCE_LABELS[t]} · {msgs.length}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {msgs.map((m, idx) => (
                              <div key={m.id} className="rounded-md border bg-background p-3 flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-medium truncate">
                                    #{idx + 1} {m.title || "Sem título"}
                                  </span>
                                  <Badge variant="outline" className={channelColors.whatsapp}>WhatsApp</Badge>
                                </div>
                                {m.content_text && (
                                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
                                    {m.content_text}
                                  </p>
                                )}
                                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onSelectContent(m); }}>
                                  <Send className="w-3 h-3 mr-1.5" /> Usar em Campanha
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
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
  resumeDraft,
  onDraftConsumed,
}: {
  preSelectedContent: ContentItem | null;
  onCreated: () => void;
  resumeDraft?: DraftCampaign | null;
  onDraftConsumed?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);

  // Step 1
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(preSelectedContent);
  const [campaignName, setCampaignName] = useState("");
  const [campaignDesc, setCampaignDesc] = useState("");
  const [sendChannel, setSendChannel] = useState("whatsapp");
  const [evolutionInstance, setEvolutionInstance] = useState<string>("");
  const [evolutionInstances, setEvolutionInstances] = useState<Array<{ instance: string; nome: string; phone: string }>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);

  // Step 2
  const [produtoInteresse, setProdutoInteresse] = useState("all");
  const [temperatura, setTemperatura] = useState("all");
  const [stageName, setStageName] = useState("all");
  const [especialidade, setEspecialidade] = useState("all");
  const [areaAtuacao, setAreaAtuacao] = useState("all");
  const [uf, setUf] = useState("all");
  const [proprietario, setProprietario] = useState("all");
  const [realStatus, setRealStatus] = useState("all");
  const [temScanner, setTemScanner] = useState("all");
  const [temPrinter, setTemPrinter] = useState("all");
  const [recencia, setRecencia] = useState("any");
  const [clienteFilter, setClienteFilter] = useState("all");
  // Step 2 — filtros adicionais baseados em campos reais do lead
  const [funilCrm, setFunilCrm] = useState("all");           // piperun_pipeline_name
  const [origem, setOrigem] = useState("all");                // origem_primeiro_contato
  const [statusPiperun, setStatusPiperun] = useState("all");  // piperun_status
  const [prazoCompra, setPrazoCompra] = useState("all");      // prazo_compra
  const [tipoLocal, setTipoLocal] = useState("all");          // tipo_local
  const [cidade, setCidade] = useState("");                   // cidade ilike
  const [formName, setFormName] = useState("all");            // form_name
  const [utmCampaign, setUtmCampaign] = useState("");         // utm_campaign ilike
  const [marcaScanner, setMarcaScanner] = useState("all");    // scanner_marca / equip_scanner
  const [marcaImpressora, setMarcaImpressora] = useState("all"); // equip_impressora
  const [temFresadora, setTemFresadora] = useState("all");    // equip_fresadora
  const [temCad, setTemCad] = useState("all");                // equip_cad / software_cad
  const [imprimeModelos, setImprimeModelos] = useState("all");// imprime_modelos
  const [imprimePlacas, setImprimePlacas] = useState("all");  // imprime_placas
  const [imprimeGuias, setImprimeGuias] = useState("all");    // imprime_guias
  const [imprimeResinasLd, setImprimeResinasLd] = useState("all"); // imprime_resinas_ld
  const [reuniaoAgendada, setReuniaoAgendada] = useState("all"); // reuniao_agendada
  const [inadimplente, setInadimplente] = useState("all");    // omie_inadimplente
  const [recompraAlert, setRecompraAlert] = useState("all");  // recompra_alert
  const [sdrCompleto, setSdrCompleto] = useState("all");      // sdr_completo
  const [temEmail, setTemEmail] = useState("all");            // email IS NOT NULL
  const [temTelefone, setTemTelefone] = useState("all");      // telefone_normalized IS NOT NULL
  const [aceitaContato, setAceitaContato] = useState("all");  // do_not_contact
  const [ltvMin, setLtvMin] = useState("");                   // ltv_total >=
  const [scoreMin, setScoreMin] = useState("");               // intelligence_score_total >=
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  // Saved segments
  const [savedSegments, setSavedSegments] = useState<SavedSegment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("none");
  const [segmentName, setSegmentName] = useState("");
  const [savingSegment, setSavingSegment] = useState(false);
  const [refreshingSegment, setRefreshingSegment] = useState(false);

  // SMS (DisparoPro)
  const [smsMessage, setSmsMessage] = useState("");
  const [smsCodificacao, setSmsCodificacao] = useState<"0" | "8">("0");
  const [smsCustoPdu, setSmsCustoPdu] = useState<string>("0.08");
  const [smsBalance, setSmsBalance] = useState<string | null>(null);
  const [smsBalanceLoading, setSmsBalanceLoading] = useState(false);
  const [smsLeadValidCount, setSmsLeadValidCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [smsCampaignId, setSmsCampaignId] = useState<string | null>(null);
  const [audiencePreview, setAudiencePreview] = useState<{
    total: number;
    com_telefone: number;
    sample: Array<{ id?: string; nome?: string | null; telefone?: string | null }>;
    lead_ids: string[];
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const smsTextareaRef = useRef<HTMLTextAreaElement>(null);

  const smsStats = useMemo(() => {
    const is7bit = smsCodificacao === "0";
    const perPdu = is7bit ? 160 : 70;
    const multiPerPdu = is7bit ? 153 : 67;
    const len = smsMessage.length;
    const pdus = len === 0 ? 0 : len <= perPdu ? 1 : Math.ceil(len / multiPerPdu);
    const custoPdu = parseFloat(smsCustoPdu) || 0;
    const leads = smsLeadValidCount ?? 0;
    const custoTotal = pdus * leads * custoPdu;
    return { is7bit, perPdu, multiPerPdu, len, pdus, custoTotal, custoPdu };
  }, [smsMessage, smsCodificacao, smsCustoPdu, smsLeadValidCount]);

  const renderSmsPreview = (msg: string) =>
    msg
      .replace(/\{\{nome\}\}/g, "Dr. João Silva")
      .replace(/\{\{primeiro_nome\}\}/g, "João")
      .replace(/\{\{empresa\}\}/g, "Clínica Exemplo");

  const getFunctionErrorMessage = async (error: any) => {
    const context = error?.context;
    if (context && typeof context.text === "function") {
      const text = await context.text();
      try {
        const parsed = JSON.parse(text);
        return parsed?.error || parsed?.message || text || error?.message || "Erro na Edge Function";
      } catch {
        return text || error?.message || "Erro na Edge Function";
      }
    }
    return error?.message || "Erro na Edge Function";
  };

  // Build current filter object from state (single source of truth)
  const buildFiltersObject = useCallback(() => {
    const f: Record<string, any> = {};
    if (produtoInteresse !== "all") f.produto_interesse = produtoInteresse;
    if (temperatura !== "all") f.temperatura_lead = parseInt(temperatura);
    if (stageName !== "all") f.piperun_stage_name = stageName;
    if (especialidade !== "all") f.especialidade = especialidade;
    if (areaAtuacao !== "all") f.area_atuacao = areaAtuacao;
    if (uf !== "all") f.uf = uf;
    if (proprietario !== "all") f.proprietario_lead_crm = proprietario;
    if (realStatus !== "all") f.real_status = realStatus;
    if (temScanner !== "all") f.tem_scanner = temScanner;
    if (temPrinter !== "all") f.tem_printer = temPrinter;
    if (recencia !== "any") f.recencia_dias = parseInt(recencia);
    if (clienteFilter !== "all") f.cliente_filter = clienteFilter;
    if (funilCrm !== "all") f.piperun_pipeline_name = funilCrm;
    if (origem !== "all") f.origem_primeiro_contato = origem;
    if (statusPiperun !== "all") f.piperun_status = statusPiperun;
    if (prazoCompra !== "all") f.prazo_compra = prazoCompra;
    if (tipoLocal !== "all") f.tipo_local = tipoLocal;
    if (cidade.trim()) f.cidade = cidade.trim();
    if (formName !== "all") f.form_name = formName;
    if (utmCampaign.trim()) f.utm_campaign = utmCampaign.trim();
    if (marcaScanner !== "all") f.marca_scanner = marcaScanner;
    if (marcaImpressora !== "all") f.marca_impressora = marcaImpressora;
    if (temFresadora !== "all") f.tem_fresadora = temFresadora;
    if (temCad !== "all") f.tem_cad = temCad;
    if (imprimeModelos !== "all") f.imprime_modelos = imprimeModelos;
    if (imprimePlacas !== "all") f.imprime_placas = imprimePlacas;
    if (imprimeGuias !== "all") f.imprime_guias = imprimeGuias;
    if (imprimeResinasLd !== "all") f.imprime_resinas_ld = imprimeResinasLd;
    if (reuniaoAgendada !== "all") f.reuniao_agendada = reuniaoAgendada;
    if (inadimplente !== "all") f.omie_inadimplente = inadimplente;
    if (recompraAlert !== "all") f.recompra_alert = recompraAlert;
    if (sdrCompleto !== "all") f.sdr_completo = sdrCompleto;
    if (temEmail !== "all") f.tem_email = temEmail;
    if (temTelefone !== "all") f.tem_telefone = temTelefone;
    if (aceitaContato !== "all") f.aceita_contato = aceitaContato;
    const ltvNum = parseFloat(ltvMin); if (!isNaN(ltvNum) && ltvNum > 0) f.ltv_min = ltvNum;
    const scoreNum = parseFloat(scoreMin); if (!isNaN(scoreNum) && scoreNum > 0) f.score_min = scoreNum;
    return f;
  }, [
    produtoInteresse, temperatura, stageName, especialidade, areaAtuacao, uf, proprietario, realStatus,
    temScanner, temPrinter, recencia, clienteFilter,
    funilCrm, origem, statusPiperun, prazoCompra, tipoLocal, cidade, formName, utmCampaign,
    marcaScanner, marcaImpressora, temFresadora, temCad,
    imprimeModelos, imprimePlacas, imprimeGuias, imprimeResinasLd,
    reuniaoAgendada, inadimplente, recompraAlert, sdrCompleto,
    temEmail, temTelefone, aceitaContato, ltvMin, scoreMin,
  ]);

  // Apply a saved segment's filters into state
  const applySegmentFilters = (filters: Record<string, any> | null | undefined) => {
    const f = filters || {};
    setProdutoInteresse(f.produto_interesse ?? "all");
    setTemperatura(f.temperatura_lead != null ? String(f.temperatura_lead) : "all");
    setStageName(f.piperun_stage_name ?? "all");
    setEspecialidade(f.especialidade ?? "all");
    setAreaAtuacao(f.area_atuacao ?? "all");
    setUf(f.uf ?? "all");
    setProprietario(f.proprietario_lead_crm ?? "all");
    setRealStatus(f.real_status ?? "all");
    setTemScanner(f.tem_scanner ?? "all");
    setTemPrinter(f.tem_printer ?? "all");
    setRecencia(f.recencia_dias != null ? String(f.recencia_dias) : "any");
    setClienteFilter(f.cliente_filter ?? "all");
    setFunilCrm(f.piperun_pipeline_name ?? "all");
    setOrigem(f.origem_primeiro_contato ?? "all");
    setStatusPiperun(f.piperun_status ?? "all");
    setPrazoCompra(f.prazo_compra ?? "all");
    setTipoLocal(f.tipo_local ?? "all");
    setCidade(f.cidade ?? "");
    setFormName(f.form_name ?? "all");
    setUtmCampaign(f.utm_campaign ?? "");
    setMarcaScanner(f.marca_scanner ?? "all");
    setMarcaImpressora(f.marca_impressora ?? "all");
    setTemFresadora(f.tem_fresadora ?? "all");
    setTemCad(f.tem_cad ?? "all");
    setImprimeModelos(f.imprime_modelos ?? "all");
    setImprimePlacas(f.imprime_placas ?? "all");
    setImprimeGuias(f.imprime_guias ?? "all");
    setImprimeResinasLd(f.imprime_resinas_ld ?? "all");
    setReuniaoAgendada(f.reuniao_agendada ?? "all");
    setInadimplente(f.omie_inadimplente ?? "all");
    setRecompraAlert(f.recompra_alert ?? "all");
    setSdrCompleto(f.sdr_completo ?? "all");
    setTemEmail(f.tem_email ?? "all");
    setTemTelefone(f.tem_telefone ?? "all");
    setAceitaContato(f.aceita_contato ?? "all");
    setLtvMin(f.ltv_min != null ? String(f.ltv_min) : "");
    setScoreMin(f.score_min != null ? String(f.score_min) : "");
  };

  // Build a query against lia_attendances applying current filters (returns base query)
  const applyFiltersToQuery = (q: any, f: Record<string, any>) => {
    if (f.produto_interesse) {
      const safe = String(f.produto_interesse).replace(/,/g, " ");
      q = q.or(`produto_interesse.ilike.%${safe}%,produto_interesse_auto.ilike.%${safe}%`);
    }
    if (f.temperatura_lead != null) q = q.eq("temperatura_lead", f.temperatura_lead);
    if (f.piperun_stage_name) q = q.eq("piperun_stage_name", f.piperun_stage_name);
    if (f.especialidade) q = q.eq("especialidade", f.especialidade);
    if (f.area_atuacao) q = q.eq("area_atuacao", f.area_atuacao);
    if (f.uf) q = q.eq("uf", f.uf);
    if (f.proprietario_lead_crm) q = q.eq("proprietario_lead_crm", f.proprietario_lead_crm);
    if (f.real_status) q = q.eq("real_status", f.real_status);
    if (f.tem_scanner === "yes") q = q.eq("tem_scanner", true);
    if (f.tem_scanner === "no") q = q.or("tem_scanner.is.null,tem_scanner.eq.false");
    if (f.tem_printer === "yes") q = q.eq("tem_impressora", true);
    if (f.tem_printer === "no") q = q.or("tem_impressora.is.null,tem_impressora.eq.false");
    if (f.recencia_dias != null) {
      const since = new Date(Date.now() - Number(f.recencia_dias) * 86400000).toISOString();
      q = q.gte("updated_at", since);
    }
    if (f.cliente_filter === "clientes") q = q.gt("total_deals_all", 0);
    if (f.cliente_filter === "leads") q = q.or("total_deals_all.is.null,total_deals_all.eq.0");
    // ── Identificação / origem ───────────────────────────────────────────────
    if (f.piperun_pipeline_name) q = q.eq("piperun_pipeline_name", f.piperun_pipeline_name);
    if (f.origem_primeiro_contato) q = q.eq("origem_primeiro_contato", f.origem_primeiro_contato);
    if (f.piperun_status) q = q.eq("piperun_status", f.piperun_status);
    if (f.prazo_compra) q = q.eq("prazo_compra", f.prazo_compra);
    if (f.tipo_local) q = q.eq("tipo_local", f.tipo_local);
    if (f.cidade) q = q.ilike("cidade", `%${String(f.cidade).replace(/,/g, " ")}%`);
    if (f.form_name) q = q.eq("form_name", f.form_name);
    if (f.utm_campaign) q = q.ilike("utm_campaign", `%${String(f.utm_campaign).replace(/,/g, " ")}%`);
    // ── Workflow digital (equipamentos / aplicações) ─────────────────────────
    if (f.marca_scanner) {
      const safe = String(f.marca_scanner).replace(/,/g, " ");
      q = q.or(`scanner_marca.ilike.%${safe}%,equip_scanner.ilike.%${safe}%`);
    }
    if (f.marca_impressora) {
      const safe = String(f.marca_impressora).replace(/,/g, " ");
      q = q.or(`equip_impressora.ilike.%${safe}%,impressora_modelo.ilike.%${safe}%`);
    }
    if (f.tem_fresadora === "yes") q = q.not("equip_fresadora", "is", null);
    if (f.tem_fresadora === "no") q = q.is("equip_fresadora", null);
    if (f.tem_cad === "yes") q = q.or("equip_cad.not.is.null,software_cad.not.is.null");
    if (f.tem_cad === "no") q = q.is("equip_cad", null).is("software_cad", null);
    const ynBool = (col: string, v: string) => v === "yes"
      ? (qq: any) => qq.eq(col, true)
      : (qq: any) => qq.or(`${col}.is.null,${col}.eq.false`);
    if (f.imprime_modelos)     q = ynBool("imprime_modelos",     f.imprime_modelos)(q);
    if (f.imprime_placas)      q = ynBool("imprime_placas",      f.imprime_placas)(q);
    if (f.imprime_guias)       q = ynBool("imprime_guias",       f.imprime_guias)(q);
    if (f.imprime_resinas_ld)  q = ynBool("imprime_resinas_ld",  f.imprime_resinas_ld)(q);
    if (f.reuniao_agendada)    q = ynBool("reuniao_agendada",    f.reuniao_agendada)(q);
    if (f.omie_inadimplente)   q = ynBool("omie_inadimplente",   f.omie_inadimplente)(q);
    if (f.recompra_alert)      q = ynBool("recompra_alert",      f.recompra_alert)(q);
    if (f.sdr_completo)        q = ynBool("sdr_completo",        f.sdr_completo)(q);
    // ── Compliance / contato ─────────────────────────────────────────────────
    if (f.tem_email === "yes") q = q.not("email", "is", null);
    if (f.tem_email === "no")  q = q.is("email", null);
    if (f.tem_telefone === "yes") q = q.not("telefone_normalized", "is", null);
    if (f.tem_telefone === "no")  q = q.is("telefone_normalized", null);
    if (f.aceita_contato === "yes") q = q.or("do_not_contact.is.null,do_not_contact.eq.false");
    if (f.aceita_contato === "no")  q = q.eq("do_not_contact", true);
    // ── Score / LTV ──────────────────────────────────────────────────────────
    if (f.ltv_min != null)   q = q.gte("ltv_total", Number(f.ltv_min));
    if (f.score_min != null) q = q.gte("intelligence_score_total", Number(f.score_min));
    return q;
  };

  const fetchSegments = useCallback(async () => {
    const { data, error } = await supabase
      .from("campaign_segments")
      .select("id,name,description,filters,lead_count,lead_ids,last_refreshed_at,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setSavedSegments((data || []) as any);
  }, []);

  useEffect(() => { fetchSegments(); }, [fetchSegments]);

  const handleSelectSegment = (id: string) => {
    setSelectedSegmentId(id);
    if (id === "none") return;
    const seg = savedSegments.find(s => s.id === id);
    if (!seg) return;
    applySegmentFilters(seg.filters);
    toast.success(`Segmentação "${seg.name}" carregada`);
  };

  const handleSaveSegment = async () => {
    const name = segmentName.trim();
    if (!name) {
      toast.error("Dê um nome à segmentação");
      return;
    }
    setSavingSegment(true);
    try {
      const filters = buildFiltersObject();
      // Snapshot current member ids
      let q: any = supabase.from("lia_attendances").select("id").is("merged_into", null).limit(50000);
      q = applyFiltersToQuery(q, filters);
      const { data: rows, error: idsErr } = await q;
      if (idsErr) throw idsErr;
      const ids = (rows || []).map((r: any) => r.id);
      const { data: inserted, error } = await supabase
        .from("campaign_segments")
        .insert({
          name,
          filters,
          lead_ids: ids,
          lead_count: ids.length,
          last_refreshed_at: new Date().toISOString(),
        })
        .select("id,name,description,filters,lead_count,lead_ids,last_refreshed_at,created_at")
        .single();
      if (error) throw error;
      toast.success(`Segmentação salva (${ids.length} leads)`);
      setSegmentName("");
      setSavedSegments(prev => [inserted as any, ...prev]);
      setSelectedSegmentId((inserted as any).id);
    } catch (e) {
      toast.error(`Erro ao salvar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingSegment(false);
    }
  };

  const handleRefreshSegment = async () => {
    if (selectedSegmentId === "none") return;
    const seg = savedSegments.find(s => s.id === selectedSegmentId);
    if (!seg) return;
    setRefreshingSegment(true);
    try {
      let q: any = supabase.from("lia_attendances").select("id").is("merged_into", null).limit(50000);
      q = applyFiltersToQuery(q, seg.filters || {});
      const { data: rows, error: idsErr } = await q;
      if (idsErr) throw idsErr;
      const ids = (rows || []).map((r: any) => r.id);
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("campaign_segments")
        .update({ lead_ids: ids, lead_count: ids.length, last_refreshed_at: nowIso })
        .eq("id", seg.id);
      if (error) throw error;
      const prevCount = seg.lead_count ?? 0;
      const delta = ids.length - prevCount;
      toast.success(
        `Atualizado: ${ids.length} leads${delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta} desde a última atualização)` : ""}`
      );
      setSavedSegments(prev =>
        prev.map(s => s.id === seg.id ? { ...s, lead_ids: ids, lead_count: ids.length, last_refreshed_at: nowIso } : s)
      );
    } catch (e) {
      toast.error(`Erro ao atualizar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRefreshingSegment(false);
    }
  };

  const handleDeleteSegment = async () => {
    if (selectedSegmentId === "none") return;
    const seg = savedSegments.find(s => s.id === selectedSegmentId);
    if (!seg) return;
    if (!confirm(`Excluir segmentação "${seg.name}"?`)) return;
    const { error } = await supabase.from("campaign_segments").delete().eq("id", seg.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    toast.success("Segmentação excluída");
    setSavedSegments(prev => prev.filter(s => s.id !== seg.id));
    setSelectedSegmentId("none");
  };

  // Options
  const [produtoInteresseOptions, setProdutoInteresseOptions] = useState<string[]>([]);
  const [stageOptions, setStageOptions] = useState<string[]>([]);
  const [especialidadeOptions, setEspecialidadeOptions] = useState<string[]>([]);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [ufOptions, setUfOptions] = useState<string[]>([]);
  const [proprietarioOptions, setProprietarioOptions] = useState<string[]>([]);
  const [realStatusOptions, setRealStatusOptions] = useState<string[]>([]);
  const [pipelineOptions, setPipelineOptions] = useState<string[]>([]);
  const [origemOptions, setOrigemOptions] = useState<string[]>([]);
  const [prazoCompraOptions, setPrazoCompraOptions] = useState<string[]>([]);
  const [tipoLocalOptions, setTipoLocalOptions] = useState<string[]>([]);
  const [formNameOptions, setFormNameOptions] = useState<string[]>([]);
  const [marcaScannerOptions, setMarcaScannerOptions] = useState<string[]>([]);
  const [marcaImpressoraOptions, setMarcaImpressoraOptions] = useState<string[]>([]);

  useEffect(() => { setSelectedContent(preSelectedContent); }, [preSelectedContent]);

  // Hydrate wizard state from a draft campaign and jump to step 3
  useEffect(() => {
    if (!resumeDraft) return;
    setCampaignName(resumeDraft.nome ?? "");
    setCampaignDesc(resumeDraft.descricao ?? "");
    if (resumeDraft.canal) setSendChannel(resumeDraft.canal);
    if (resumeDraft.canal === "sms") {
      setSmsMessage(resumeDraft.mensagem_template ?? "");
    }
    applySegmentFilters(resumeDraft.lead_filter ?? {});
    setSmsCampaignId(resumeDraft.id);
    setStep(3);
    onDraftConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDraft?.id]);

  // Fetch DisparoPro balance when SMS channel is selected
  useEffect(() => {
    if (sendChannel !== "sms") return;
    setSmsBalanceLoading(true);
    supabase.functions.invoke("smart-ops-sms-balance")
      .then(({ data }) => setSmsBalance((data as any)?.saldo ?? null))
      .catch(() => setSmsBalance(null))
      .finally(() => setSmsBalanceLoading(false));
  }, [sendChannel]);

  // Load Evolution instances when channel = evolution
  useEffect(() => {
    if (sendChannel !== "evolution") return;
    (async () => {
      const { data } = await supabase
        .from("team_members")
        .select("nome_completo, evolution_instance_name, evolution_phone")
        .eq("ativo", true)
        .not("evolution_instance_name", "is", null);
      const list = (data || [])
        .filter((r: any) => r.evolution_instance_name)
        .map((r: any) => ({
          instance: r.evolution_instance_name as string,
          nome: (r.nome_completo as string) || r.evolution_instance_name,
          phone: (r.evolution_phone as string) || "",
        }));
      setEvolutionInstances(list);
      if (list.length === 1) setEvolutionInstance(list[0].instance);
    })();
  }, [sendChannel]);

  // Fetch filter options
  useEffect(() => {
    (async () => {
      const base = supabase.from("lia_attendances").select(
        "produto_interesse, produto_interesse_auto, piperun_stage_name, especialidade, area_atuacao, uf, proprietario_lead_crm, real_status, piperun_pipeline_name, origem_primeiro_contato, prazo_compra, tipo_local, form_name, scanner_marca, equip_scanner, equip_impressora"
      ).is("merged_into", null).limit(5000);
      const { data } = await base;
      const rows = (data || []) as any[];
      const uniq = (key: string) =>
        [...new Set(rows.map(r => r[key]).filter(Boolean))].sort() as string[];
      const merged = [
        ...new Set(
          rows
            .map(r => (r.produto_interesse || r.produto_interesse_auto || "").toString().trim())
            .filter(Boolean)
        ),
      ].sort();
      setProdutoInteresseOptions(merged);
      setStageOptions(uniq("piperun_stage_name"));
      setEspecialidadeOptions(uniq("especialidade"));
      setAreaOptions(uniq("area_atuacao"));
      setUfOptions(uniq("uf"));
      setProprietarioOptions(uniq("proprietario_lead_crm"));
      setRealStatusOptions(uniq("real_status"));
      setPipelineOptions(uniq("piperun_pipeline_name"));
      setOrigemOptions(uniq("origem_primeiro_contato"));
      setPrazoCompraOptions(uniq("prazo_compra"));
      setTipoLocalOptions(uniq("tipo_local"));
      setFormNameOptions(uniq("form_name"));
      // Marca scanner: combina coluna dedicada + equip_scanner (string livre)
      const scannerBrands = [...new Set(
        rows.flatMap(r => [r.scanner_marca, r.equip_scanner])
            .filter(Boolean)
            .map((s: any) => String(s).trim())
      )].sort();
      setMarcaScannerOptions(scannerBrands);
      setMarcaImpressoraOptions(uniq("equip_impressora"));
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

  // Snapshot filters for effect deps
  const currentFilters = buildFiltersObject();
  const filtersKey = JSON.stringify(currentFilters);

  // Count leads in real time
  useEffect(() => {
    if (step !== 2) return;
    setCountLoading(true);
    const timer = setTimeout(async () => {
      let query = supabase
        .from("lia_attendances")
        .select("id", { count: "exact", head: true })
        .is("merged_into", null) as any;
      query = applyFiltersToQuery(query, currentFilters);
      const { count } = await query;
      setLeadCount(count ?? 0);
      setCountLoading(false);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, filtersKey]);

  // Count valid SMS leads (telefone_normalized IS NOT NULL, opt-out off)
  useEffect(() => {
    if (step !== 2 || sendChannel !== "sms") return;
    (async () => {
      const buildBase = () => {
        let q = supabase
          .from("lia_attendances")
          .select("id", { count: "exact", head: true })
          .is("merged_into", null)
          .not("telefone_normalized", "is", null) as any;
        return applyFiltersToQuery(q, currentFilters);
      };
      try {
        const { count, error } = await buildBase().neq("sms_opt_out", true);
        if (error) throw error;
        setSmsLeadValidCount(count ?? 0);
      } catch {
        const { count } = await buildBase();
        setSmsLeadValidCount(count ?? 0);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, sendChannel, filtersKey]);

  const handleCreate = async () => {
    if (!campaignName.trim()) return;
    setCreating(true);
    try {
      const filters: any = buildFiltersObject();
      if (sendChannel === "evolution" && evolutionInstance) filters.evolution_instance = evolutionInstance;

      const { error } = await supabase.from("campaign_sessions").insert({
        name: campaignName.trim(),
        description: campaignDesc.trim() || null,
        status: "draft",
        content_id: selectedContent?.id ?? null,
        content_type: selectedContent?.content_type ?? null,
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

  const resolveSmsAudience = async (includeIds = false) => {
    const filters = buildFiltersObject();
    const applySmsFilters = (q: any) => applyFiltersToQuery(q, filters).neq("sms_opt_out", true);

    const totalQuery = applyFiltersToQuery(
      supabase
        .from("lia_attendances")
        .select("id", { count: "exact", head: true })
        .is("merged_into", null) as any,
      filters,
    );

    const validQuery = applySmsFilters(
      supabase
        .from("lia_attendances")
        .select("id", { count: "exact", head: true })
        .is("merged_into", null)
        .not("telefone_normalized", "is", null) as any,
    );

    const sampleQuery = applySmsFilters(
      supabase
        .from("lia_attendances")
        .select("id,nome,telefone_normalized,telefone_raw,wa_phone")
        .is("merged_into", null)
        .not("telefone_normalized", "is", null)
        .limit(5) as any,
    );

    const [totalRes, validRes, sampleRes] = await Promise.all([totalQuery, validQuery, sampleQuery]);
    if (totalRes.error) throw new Error(totalRes.error.message);
    if (validRes.error) throw new Error(validRes.error.message);
    if (sampleRes.error) throw new Error(sampleRes.error.message);

    const leadIds: string[] = [];
    if (includeIds) {
      const PAGE = 1000;
      const CAP = 10000;
      let from = 0;
      while (leadIds.length < CAP) {
        let q = supabase
          .from("lia_attendances")
          .select("id")
          .is("merged_into", null)
          .not("telefone_normalized", "is", null) as any;
        q = applySmsFilters(q).range(from, from + PAGE - 1);
        const { data: rows, error: qErr } = await q;
        if (qErr) throw new Error(qErr.message);
        if (!rows || rows.length === 0) break;
        for (const r of rows) leadIds.push((r as any).id);
        if (rows.length < PAGE) break;
        from += PAGE;
      }
    }

    const sample = ((sampleRes.data as any[]) || []).map((row) => ({
      id: row.id,
      nome: row.nome,
      telefone: row.telefone_normalized || row.telefone_raw || row.wa_phone || null,
    }));

    return {
      total: totalRes.count ?? 0,
      com_telefone: validRes.count ?? 0,
      sample,
      lead_ids: leadIds,
    };
  };

  const handleSendSms = async () => {
    if (!smsMessage.trim() || !campaignName.trim()) return;
    setSending(true);
    const tId = toast.loading("Disparando SMS...");
    try {
      const id = await ensureSmsCampaign();
      if (!id) throw new Error("Não foi possível criar a campanha");

      // 1) Resolve audiência (leads com telefone válido, respeitando opt-out).
      const audience = await resolveSmsAudience(true);
      const leadIds = audience.lead_ids;
      if (!leadIds.length) {
        throw new Error("Nenhum lead com telefone válido para esta audiência");
      }

      // 2) Cria campaign_session com lead_ids + mensagem (o que a função disparopro consome).
      const filters = buildFiltersObject();
      const { data: session, error: sessErr } = await supabase
        .from("campaign_sessions")
        .insert({
          name: campaignName.trim(),
          description: campaignDesc.trim() || null,
          status: "queued",
          channel: "sms",
          lead_filters: Object.keys(filters).length ? filters : null,
          lead_ids: leadIds,
          lead_count: leadIds.length,
          results: { sms_message: smsMessage, sms_codificacao: "0" },
        })
        .select("id")
        .single();
      if (sessErr || !session) throw new Error(sessErr?.message || "Falha ao criar sessão SMS");

      // 3) Dispara via DisparoPro (async no backend p/ evitar timeout).
      console.info("[SMS] Invocando smart-ops-sms-disparopro", { campaign_id: session.id, source_campaign_id: id });
      const { data, error } = await supabase.functions.invoke("smart-ops-sms-disparopro", {
        body: {
          campaign_id: session.id,
          source_campaign_id: id,
          sms_message: smsMessage,
          sms_codificacao: "0",
          async: true,
        },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      console.info("[SMS] disparopro OK", data);
      const total = (data as any)?.total ?? leadIds.length;
      toast.success(`Disparo SMS enfileirado: ${total} leads. Acompanhe em Histórico.`, { id: tId });
      onCreated();
    } catch (e) {
      console.error("[SMS] Falha em handleSendSms", e);
      toast.error(`Erro: ${e instanceof Error ? e.message : "Falha no disparo"}`, { id: tId });
    } finally {
      setSending(false);
    }
  };

  // Cria (ou atualiza) o draft de campanha SMS na tabela `campaigns` e retorna o id
  const ensureSmsCampaign = async (): Promise<string | null> => {
    const filters: any = buildFiltersObject();
    const payload = {
      canal: "sms",
      nome: campaignName.trim(),
      descricao: campaignDesc.trim() || null,
      mensagem_template: smsMessage,
      lead_filter: Object.keys(filters).length ? filters : null,
    };
    if (smsCampaignId) {
      const { error } = await supabase
        .from("campaigns" as any)
        .update(payload)
        .eq("id", smsCampaignId);
      if (error) throw new Error(error.message);
      return smsCampaignId;
    }
    const { data, error } = await supabase
      .from("campaigns" as any)
      .insert({ ...payload, status: "rascunho" })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Erro ao criar campanha");
    const id = (data as any).id as string;
    setSmsCampaignId(id);
    return id;
  };

  const handlePreviewAudience = async () => {
    if (!campaignName.trim()) {
      toast.error("Defina um nome para a campanha primeiro");
      return;
    }
    setPreviewing(true);
    const tId = toast.loading("Calculando audiência...");
    try {
      const id = await ensureSmsCampaign();
      if (!id) throw new Error("Não foi possível criar a campanha");
      const aud = await resolveSmsAudience(false);
      setAudiencePreview({
        total: aud.total ?? 0,
        com_telefone: aud.com_telefone ?? 0,
        sample: aud.sample,
        lead_ids: [],
      });
      await supabase.from("campaigns" as any).update({
        audience_count: aud.total ?? 0,
        total_leads: aud.com_telefone ?? 0,
        audience_snapshot_at: new Date().toISOString(),
      }).eq("id", id);
      toast.success(`Audiência: ${aud.total} leads (${aud.com_telefone} com telefone)`, { id: tId });
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : "Falha no preview"}`, { id: tId });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className={`space-y-6 ${step === 3 ? "max-w-none" : "max-w-3xl"}`}>
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
            <CardTitle className="text-base">1. Conteúdo (opcional)</CardTitle>
            <p className="text-xs text-muted-foreground">Escolha um item da biblioteca ou avance para compor a mensagem na próxima etapa.</p>
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
                {searchTerm.trim().length >= 2 && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhum conteúdo encontrado para "{searchTerm}". Você pode avançar sem selecionar.
                  </p>
                )}
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
                    <SelectItem value="evolution">WhatsApp (Evolution)</SelectItem>
                    <SelectItem value="sellflux">SellFlux</SelectItem>
                    <SelectItem value="sms">📱 SMS (DisparoPro)</SelectItem>
                    <SelectItem value="email">📧 Email (Gmail)</SelectItem>
                    <SelectItem value="registro">Apenas registrar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {sendChannel === "evolution" && (
              <div>
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" /> Instância Evolution *
                </label>
                <Select value={evolutionInstance} onValueChange={setEvolutionInstance}>
                  <SelectTrigger>
                    <SelectValue placeholder={evolutionInstances.length ? "Selecione um telefone conectado" : "Nenhuma instância configurada"} />
                  </SelectTrigger>
                  <SelectContent>
                    {evolutionInstances.map(i => (
                      <SelectItem key={i.instance} value={i.instance}>
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          {i.nome}{i.phone ? ` — +${i.phone}` : ""}
                          <span className="text-xs text-muted-foreground">({i.instance})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!evolutionInstances.length && (
                  <p className="text-xs text-muted-foreground mt-1">Nenhum vendedor com instância Evolution ativa.</p>
                )}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <Input value={campaignDesc} onChange={(e) => setCampaignDesc(e.target.value)} placeholder="Objetivo da campanha..." />
            </div>

            {sendChannel === "sms" && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Saldo DisparoPro:</span>
                  {smsBalanceLoading ? (
                    <Skeleton className="h-5 w-24" />
                  ) : smsBalance ? (
                    <Badge className="bg-green-100 text-green-800 border-green-300">R$ {smsBalance}</Badge>
                  ) : (
                    <Badge variant="secondary">Indisponível</Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>Mensagem SMS</Label>
                    <CampaignLinkPicker
                      channel="sms"
                      onInsert={(t) => setSmsMessage((p) => (p ? p + " " : "") + t)}
                    />
                  </div>
                  <Textarea
                    ref={smsTextareaRef}
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    maxLength={1377}
                    rows={4}
                    placeholder="Ex: Ola {{primeiro_nome}}, temos oferta especial no BLZ INO200. Responda SIM para saber mais ou acesse: https://bit.ly/smartdent-blz?utm_medium=sms&utm_campaign=CAMP_ID"
                  />
                  <p className="text-xs text-muted-foreground">
                    Caracteres: {smsStats.len}/{smsStats.len <= smsStats.perPdu ? smsStats.perPdu : smsStats.multiPerPdu}
                    {" • PDUs: "}{smsStats.pdus}
                    {" • Custo estimado: R$ "}{smsStats.custoTotal.toFixed(2)}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-xs text-muted-foreground">Inserir:</span>
                  {["{{nome}}", "{{primeiro_nome}}", "{{empresa}}"].map((v) => (
                    <Badge
                      key={v}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10"
                      onClick={() => {
                        const el = smsTextareaRef.current;
                        const start = el?.selectionStart ?? smsMessage.length;
                        const end = el?.selectionEnd ?? smsMessage.length;
                        const next = smsMessage.slice(0, start) + v + smsMessage.slice(end);
                        setSmsMessage(next);
                        setTimeout(() => {
                          if (!el) return;
                          el.focus();
                          el.setSelectionRange(start + v.length, start + v.length);
                        }, 0);
                      }}
                    >
                      {v}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <Label className="w-28 shrink-0">Codificação</Label>
                  <Select value={smsCodificacao} onValueChange={(v) => setSmsCodificacao(v as "0" | "8")}>
                    <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">7-bit — sem acentos, 160 chars/PDU</SelectItem>
                      <SelectItem value="8">Unicode — com acentos, 70 chars/PDU</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3">
                  <Label className="w-28 shrink-0">Custo/PDU (R$)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={smsCustoPdu}
                    onChange={(e) => setSmsCustoPdu(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-xs text-muted-foreground">
                    Consulte DisparoPro → Planos para o valor exato
                  </span>
                </div>

                {smsMessage && (
                  <div className="bg-muted/30 p-3 rounded space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Preview</p>
                    <p className="text-sm whitespace-pre-wrap">{renderSmsPreview(smsMessage)}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={
                  !campaignName.trim() ||
                  (sendChannel === "evolution" && !evolutionInstance) ||
                  (sendChannel === "sms" && !smsMessage.trim())
                }
              >
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
            {/* Segmentações salvas */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bookmark className="w-4 h-4 text-primary" />
                Segmentações salvas
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Select value={selectedSegmentId} onValueChange={handleSelectSegment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Carregar uma segmentação..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhuma —</SelectItem>
                    {savedSegments.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.lead_count ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshSegment}
                  disabled={selectedSegmentId === "none" || refreshingSegment}
                  title="Recalcular leads desta segmentação agora"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${refreshingSegment ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteSegment}
                  disabled={selectedSegmentId === "none"}
                  title="Excluir segmentação salva"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {selectedSegmentId !== "none" && (() => {
                const seg = savedSegments.find(s => s.id === selectedSegmentId);
                if (!seg) return null;
                return (
                  <p className="text-xs text-muted-foreground">
                    {seg.lead_count ?? 0} leads · última atualização: {seg.last_refreshed_at ? formatDate(seg.last_refreshed_at) : "—"}
                  </p>
                );
              })()}
              <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t">
                <Input
                  placeholder="Nome para salvar a segmentação atual"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveSegment}
                  disabled={savingSegment || !segmentName.trim()}
                >
                  <Save className="w-4 h-4 mr-1" />
                  {savingSegment ? "Salvando..." : "Salvar segmentação"}
                </Button>
              </div>
            </div>

            {/* ── Grupo 1: Identidade & CRM ───────────────────────────── */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Identidade & CRM
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Produto de Interesse</label>
                  <Select value={produtoInteresse} onValueChange={setProdutoInteresse}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {produtoInteresseOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
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
                  <label className="text-sm font-medium">Funil CRM</label>
                  <Select value={funilCrm} onValueChange={setFunilCrm}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {pipelineOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                <div>
                  <label className="text-sm font-medium">Status PipeRun</label>
                  <Select value={statusPiperun} onValueChange={setStatusPiperun}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="aberta">Aberta</SelectItem>
                      <SelectItem value="ganha">Ganha</SelectItem>
                      <SelectItem value="perdida">Perdida</SelectItem>
                      <SelectItem value="congelada">Congelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Status real</label>
                  <Select value={realStatus} onValueChange={setRealStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {realStatusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Proprietário</label>
                  <Select value={proprietario} onValueChange={setProprietario}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {proprietarioOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Especialidade</label>
                  <Select value={especialidade} onValueChange={setEspecialidade}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {especialidadeOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Área de atuação</label>
                  <Select value={areaAtuacao} onValueChange={setAreaAtuacao}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {areaOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Tipo de local</label>
                  <Select value={tipoLocal} onValueChange={setTipoLocal}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {tipoLocalOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">UF</label>
                  <Select value={uf} onValueChange={setUf}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {ufOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Cidade (contém)</label>
                  <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: São Paulo" />
                </div>
              </div>
            </div>

            {/* ── Grupo 2: Origem / Aquisição ────────────────────────── */}
            <div className="space-y-2 pt-2 border-t">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Origem & Aquisição
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Origem (primeiro contato)</label>
                  <Select value={origem} onValueChange={setOrigem}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {origemOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Formulário</label>
                  <Select value={formName} onValueChange={setFormName}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {formNameOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">UTM Campaign (contém)</label>
                  <Input value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} placeholder="Ex.: BLZ-INO" />
                </div>
                <div>
                  <label className="text-sm font-medium">SDR completo</label>
                  <Select value={sdrCompleto} onValueChange={setSdrCompleto}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Última interação</label>
                  <Select value={recencia} onValueChange={setRecencia}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer</SelectItem>
                      <SelectItem value="7">Últimos 7 dias</SelectItem>
                      <SelectItem value="30">Últimos 30 dias</SelectItem>
                      <SelectItem value="90">Últimos 90 dias</SelectItem>
                      <SelectItem value="180">Últimos 180 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Prazo de compra</label>
                  <Select value={prazoCompra} onValueChange={setPrazoCompra}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {prazoCompraOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Grupo 3: Workflow Digital (Equipamentos & Aplicações) ── */}
            <div className="space-y-2 pt-2 border-t">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Workflow Digital — Equipamentos & Aplicações
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Tem scanner</label>
                  <Select value={temScanner} onValueChange={setTemScanner}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Marca do scanner</label>
                  <Select value={marcaScanner} onValueChange={setMarcaScanner}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {marcaScannerOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Tem impressora</label>
                  <Select value={temPrinter} onValueChange={setTemPrinter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Marca da impressora</label>
                  <Select value={marcaImpressora} onValueChange={setMarcaImpressora}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {marcaImpressoraOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Tem CAD</label>
                  <Select value={temCad} onValueChange={setTemCad}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Tem fresadora</label>
                  <Select value={temFresadora} onValueChange={setTemFresadora}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Imprime modelos</label>
                  <Select value={imprimeModelos} onValueChange={setImprimeModelos}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Imprime placas</label>
                  <Select value={imprimePlacas} onValueChange={setImprimePlacas}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Imprime guias</label>
                  <Select value={imprimeGuias} onValueChange={setImprimeGuias}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Imprime resinas LD</label>
                  <Select value={imprimeResinasLd} onValueChange={setImprimeResinasLd}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Grupo 4: Valor / Compromisso / Contato ────────────── */}
            <div className="space-y-2 pt-2 border-t">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Valor, Compromisso & Contato
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Tipo de pessoa</label>
                  <Select value={clienteFilter} onValueChange={setClienteFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="clientes">Apenas clientes</SelectItem>
                      <SelectItem value="leads">Apenas leads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">LTV mínimo (R$)</label>
                  <Input
                    type="number" min={0} step={100}
                    value={ltvMin} onChange={(e) => setLtvMin(e.target.value)}
                    placeholder="Ex.: 5000"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Score mínimo</label>
                  <Input
                    type="number" min={0} max={100} step={1}
                    value={scoreMin} onChange={(e) => setScoreMin(e.target.value)}
                    placeholder="0 – 100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Reunião agendada</label>
                  <Select value={reuniaoAgendada} onValueChange={setReuniaoAgendada}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Recompra em alerta</label>
                  <Select value={recompraAlert} onValueChange={setRecompraAlert}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Inadimplente (Omie)</label>
                  <Select value={inadimplente} onValueChange={setInadimplente}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Tem e-mail</label>
                  <Select value={temEmail} onValueChange={setTemEmail}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Tem telefone</label>
                  <Select value={temTelefone} onValueChange={setTemTelefone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Aceita contato</label>
                  <Select value={aceitaContato} onValueChange={setAceitaContato}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Opt-out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border rounded-lg bg-accent/5">
              <Users className="w-5 h-5 text-primary" />
              {countLoading ? (
                <span className="text-sm text-muted-foreground">Contando leads...</span>
              ) : (
                <div className="text-sm font-medium">
                  <Badge variant="secondary" className="text-base mr-2">{leadCount ?? 0}</Badge>
                  leads serão impactados
                  {sendChannel === "sms" && (
                    <p className="text-xs text-muted-foreground mt-1 font-normal">
                      📱 {smsLeadValidCount ?? "…"} leads com telefone válido / {leadCount ?? 0} total
                    </p>
                  )}
                </div>
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
        sendChannel === "email" ? (
          <div className="space-y-4">
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <div className="text-sm text-muted-foreground self-center">
                Campanha: <b>{campaignName}</b> • Público: <b>{leadCount ?? 0}</b>
              </div>
            </div>
            <EmailCampaignWizard
              campaignName={campaignName}
              description={campaignDesc}
              filters={buildFiltersObject()}
              audienceCount={leadCount ?? 0}
              onSent={() => setStep(1)}
            />
          </div>
        ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Revisar e Criar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sendChannel === "sms" ? (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Campanha</span><span className="font-medium">{campaignName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Canal</span><span>📱 SMS (DisparoPro)</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Codificação</span><span>{smsCodificacao === "0" ? "7-bit (sem acentos)" : "Unicode (com acentos)"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">PDUs/mensagem</span><span>{smsStats.pdus}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Leads válidos</span><span>{smsLeadValidCount ?? "…"}</span></div>
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">Custo estimado</span>
                    <span>R$ {smsStats.custoTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>({smsStats.pdus} PDUs × {smsLeadValidCount ?? 0} leads × R$ {smsStats.custoPdu.toFixed(3)}/PDU)</span>
                  </div>
                </div>

                <div className="bg-muted/30 p-3 rounded mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Preview da mensagem</p>
                  <p className="text-sm whitespace-pre-wrap">{renderSmsPreview(smsMessage)}</p>
                </div>

                {audiencePreview && (
                  <div className="border rounded-lg p-3 mt-3 bg-accent/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">Preview de Audiência</p>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{audiencePreview.total || (leadCount ?? 0)} total</Badge>
                        <Badge className="bg-green-100 text-green-800">
                          {audiencePreview.com_telefone || (smsLeadValidCount ?? 0)} c/ telefone
                        </Badge>
                      </div>
                    </div>
                    {audiencePreview.sample.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase">
                          Amostra ({Math.min(5, audiencePreview.sample.length)})
                        </p>
                        {audiencePreview.sample.slice(0, 5).map((s, i) => (
                          <div key={s.id ?? i} className="text-xs flex justify-between border-b last:border-0 py-1">
                            <span>{s.nome ?? "—"}</span>
                            <span className="text-muted-foreground">{s.telefone ?? "—"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} disabled={sending}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await ensureSmsCampaign();
                        toast.success("Rascunho salvo em campaigns");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Erro ao salvar");
                      }
                    }}
                    disabled={sending || previewing || !campaignName.trim()}
                  >
                    Salvar como rascunho
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handlePreviewAudience}
                    disabled={previewing || sending || !campaignName.trim()}
                  >
                    <Users className="w-4 h-4 mr-1" />
                    {previewing ? "Calculando..." : "Preview de Audiência"}
                  </Button>
                  <Button
                    onClick={handleSendSms}
                    disabled={sending || !smsMessage.trim() || !campaignName.trim()}
                    className="flex-1"
                  >
                    {sending
                      ? "Disparando..."
                      : `📱 Disparar SMS agora (${(audiencePreview?.com_telefone || smsLeadValidCount) ?? 0} leads)`}
                  </Button>
                </div>
              </>
            ) : (
            <>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Campanha</span>
                <span className="font-medium">{campaignName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Canal</span>
                <Badge variant="outline">{sendChannel}</Badge>
              </div>
              {sendChannel === "evolution" && evolutionInstance && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Instância</span>
                  <span className="font-medium">
                    {(() => {
                      const i = evolutionInstances.find(x => x.instance === evolutionInstance);
                      return i ? `${i.nome}${i.phone ? ` — +${i.phone}` : ""}` : evolutionInstance;
                    })()}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Conteúdo</span>
                <span className="font-medium truncate max-w-[60%] text-right">{selectedContent?.title || "—"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Filtros</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {produtoInteresse !== "all" && <Badge variant="outline">Produto: {produtoInteresse}</Badge>}
                  {temperatura !== "all" && <Badge variant="outline">Temp: {temperatura}</Badge>}
                  {stageName !== "all" && <Badge variant="outline">{stageName}</Badge>}
                  {especialidade !== "all" && <Badge variant="outline">{especialidade}</Badge>}
                  {areaAtuacao !== "all" && <Badge variant="outline">{areaAtuacao}</Badge>}
                  {uf !== "all" && <Badge variant="outline">UF: {uf}</Badge>}
                  {proprietario !== "all" && <Badge variant="outline">{proprietario}</Badge>}
                  {realStatus !== "all" && <Badge variant="outline">{realStatus}</Badge>}
                  {temScanner !== "all" && <Badge variant="outline">Scanner: {temScanner === "yes" ? "Sim" : "Não"}</Badge>}
                  {temPrinter !== "all" && <Badge variant="outline">Impressora: {temPrinter === "yes" ? "Sim" : "Não"}</Badge>}
                  {recencia !== "any" && <Badge variant="outline">≤ {recencia}d</Badge>}
                  {clienteFilter !== "all" && <Badge variant="outline">{clienteFilter === "clientes" ? "Clientes" : "Leads"}</Badge>}
                  {produtoInteresse === "all" && temperatura === "all" && stageName === "all" &&
                   especialidade === "all" && areaAtuacao === "all" && uf === "all" &&
                   proprietario === "all" && realStatus === "all" && temScanner === "all" &&
                   temPrinter === "all" && recencia === "any" && clienteFilter === "all" &&
                   <span>Nenhum (todos os leads)</span>}
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
            </>
            )}
          </CardContent>
        </Card>
        )
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// SUB-TAB 3: Campaign History
// ══════════════════════════════════════════
type LogFilter = "all" | "sent" | "opened" | "clicked" | "bounced" | "failed" | "queued";

function SendLogsPanel({ logs, isEmail, channel }: { logs: SendLog[]; isEmail: boolean; channel: string }) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const filtered = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => {
      switch (filter) {
        case "opened":  return !!l.opened_at;
        case "clicked": return !!l.clicked_at;
        case "bounced": return !!l.bounced_at || l.status === "bounced";
        case "failed":  return l.status === "failed";
        case "queued":  return l.status === "pending" || l.status === "aguardando";
        case "sent":    return l.status === "sent" || l.status === "delivered";
      }
    });
  }, [logs, filter]);

  const counts = useMemo(() => ({
    all: logs.length,
    sent: logs.filter(l => l.status === "sent" || l.status === "delivered").length,
    opened: logs.filter(l => !!l.opened_at).length,
    clicked: logs.filter(l => !!l.clicked_at).length,
    bounced: logs.filter(l => !!l.bounced_at || l.status === "bounced").length,
    failed: logs.filter(l => l.status === "failed").length,
    queued: logs.filter(l => l.status === "pending" || l.status === "aguardando").length,
  }), [logs]);

  const fmtTs = (v?: string | null) => {
    if (!v) return "";
    try { return new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  const tabs: Array<{ k: LogFilter; label: string; cls?: string }> = isEmail
    ? [
        { k: "all",     label: `Todos (${counts.all})` },
        { k: "sent",    label: `Enviados (${counts.sent})` },
        { k: "opened",  label: `Abriram (${counts.opened})`, cls: "text-blue-600" },
        { k: "clicked", label: `Clicaram (${counts.clicked})`, cls: "text-emerald-600" },
        { k: "bounced", label: `Bounces (${counts.bounced})`, cls: "text-red-600" },
        { k: "failed",  label: `Falhas (${counts.failed})`, cls: "text-red-600" },
        { k: "queued",  label: `Na fila (${counts.queued})`, cls: "text-amber-600" },
      ]
    : [
        { k: "all",    label: `Todos (${counts.all})` },
        { k: "sent",   label: `Enviados (${counts.sent})` },
        { k: "failed", label: `Falhas (${counts.failed})`, cls: "text-red-600" },
        { k: "queued", label: `Na fila (${counts.queued})`, cls: "text-amber-600" },
      ];

  return (
    <div>
      <p className="font-medium mb-2">Log de envios ({filtered.length})</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {tabs.map(t => (
          <Button
            key={t.k}
            size="sm"
            variant={filter === t.k ? "default" : "outline"}
            className={`h-7 text-xs ${filter === t.k ? "" : t.cls || ""}`}
            onClick={() => setFilter(t.k)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <div className="max-h-72 overflow-y-auto space-y-1">
        {filtered.map(log => (
          <div key={log.id} className="flex items-center justify-between border rounded p-2 text-xs gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{log.nome || log.lead_id.slice(0, 8)}</div>
              <div className="text-muted-foreground truncate">
                {isEmail ? (log.email || "—") : (log.telefone || "—")}
              </div>
              {isEmail && (log.opened_at || log.clicked_at || log.bounced_at) && (
                <div className="text-[10px] text-muted-foreground mt-0.5 space-x-2">
                  {log.opened_at  && <span className="text-blue-600">abriu {fmtTs(log.opened_at)}</span>}
                  {log.clicked_at && <span className="text-emerald-600">clicou {fmtTs(log.clicked_at)}</span>}
                  {log.bounced_at && <span className="text-red-600">bounce {fmtTs(log.bounced_at)}{log.bounce_reason ? ` — ${log.bounce_reason}` : ""}</span>}
                </div>
              )}
              {channel === "sms" && (log.provider_detail_code || log.provider_detail_message) && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {log.provider_detail_code ?? ""}{log.provider_detail_code && log.provider_detail_message ? " — " : ""}{log.provider_detail_message ?? ""}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isEmail && log.opened_at  && <Badge className="bg-blue-100 text-blue-800">abriu</Badge>}
              {isEmail && log.clicked_at && <Badge className="bg-emerald-100 text-emerald-800">clicou</Badge>}
              {isEmail && log.bounced_at && <Badge className="bg-red-100 text-red-800">bounce</Badge>}
              {channel === "sms" && log.provider_status && (
                <Badge className={
                  log.provider_status === "DELIVERED" ? "bg-green-100 text-green-800" :
                  log.provider_status === "ACCEPTED"  ? "bg-yellow-100 text-yellow-800" :
                  log.provider_status === "BLACKLIST" ? "bg-purple-100 text-purple-800" :
                  "bg-red-100 text-red-800"
                }>
                  {log.provider_status}
                </Badge>
              )}
              {(log.status === "sent" || log.status === "delivered") && <CheckCircle className="w-3 h-3 text-green-500" />}
              {log.status === "failed" && <XCircle className="w-3 h-3 text-red-500" />}
              {(log.status === "pending" || log.status === "aguardando") && <AlertCircle className="w-3 h-3 text-amber-500" />}
              <span>{log.status}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground text-xs py-6">Nenhum registro nesta categoria.</div>
        )}
      </div>
    </div>
  );
}

function CampaignHistory() {
  const [campaigns, setCampaigns] = useState<CampaignSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignSession | null>(null);
  const [sendLogs, setSendLogs] = useState<SendLog[]>([]);
  const [smsAttribution, setSmsAttribution] = useState<SmsAttribution | null>(null);
  const [emailStats, setEmailStats] = useState<Record<string, EmailStats>>({});
  const [conversions, setConversions] = useState<Record<string, { conversions: number; deals_created: number }>>({});

  useEffect(() => {
    (async () => {
      const [newRes, legacyRes] = await Promise.all([
        supabase
          .from("campaigns" as any)
          .select("id,nome,descricao,canal,status,lead_filter,audience_count,total_leads,total_sent,total_failed,total_delivered,started_at,completed_at,created_at,created_by,mensagem_template")
          .in("status", ["queued", "scheduled", "sending", "running", "completed", "completed_with_errors", "failed"])
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("campaign_sessions")
          .select("*")
          .in("status", ["queued", "running", "completed", "completed_with_errors", "failed"])
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (newRes.error && legacyRes.error) toast.error("Erro ao carregar campanhas");

      const fromNew: CampaignSession[] = ((newRes.data as any[]) || []).map((c) => ({
        id: c.id,
        name: c.nome,
        description: c.descricao,
        status: c.status,
        channel: c.canal,
        content_id: null,
        content_type: null,
        lead_filters: c.lead_filter,
        lead_count: c.total_leads ?? c.audience_count ?? null,
        lead_ids: null,
        sent_count: c.total_sent ?? null,
        failed_count: c.total_failed ?? null,
        results: {
          total_delivered: c.total_delivered ?? 0,
          sms_message: c.mensagem_template ?? undefined,
          _source: "campaigns",
        },
        scheduled_at: null,
        started_at: c.started_at,
        completed_at: c.completed_at,
        created_at: c.created_at,
        created_by: c.created_by ?? null,
      }));
      const fromLegacy: CampaignSession[] = ((legacyRes.data as any[]) || []).map((c) => ({
        ...c,
        results: { ...(c.results || {}), _source: "campaign_sessions" },
      }));
      const merged = [...fromNew, ...fromLegacy].sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? "")
      );
      setCampaigns(merged);
      setLoading(false);

      // Fetch email stats (queued/sent/opens/clicks/bounces) for every campaign
      const emailCampaigns = merged.filter((c) => (c.channel || "").toLowerCase() === "email");
      if (emailCampaigns.length > 0) {
        const entries = await Promise.all(emailCampaigns.map(async (c) => {
          const { data } = await supabase.rpc("fn_campaign_email_stats" as any, { p_campaign_id: c.id });
          const row = Array.isArray(data) ? data[0] : data;
          return [c.id, row as EmailStats | undefined] as const;
        }));
        const map: Record<string, EmailStats> = {};
        for (const [id, s] of entries) if (s) map[id] = s;
        setEmailStats(map);
      }

      // Fetch conversion (novo deal criado após envio) para todas as campanhas
      const convEntries = await Promise.all(merged.map(async (c) => {
        try {
          const { data } = await supabase.rpc("fn_campaign_conversions" as any, { p_campaign_id: c.id });
          const row = Array.isArray(data) ? data[0] : data;
          return [c.id, row as { conversions: number; deals_created: number } | undefined] as const;
        } catch {
          return [c.id, undefined] as const;
        }
      }));
      const cmap: Record<string, { conversions: number; deals_created: number }> = {};
      for (const [id, s] of convEntries) if (s) cmap[id] = s;
      setConversions(cmap);
    })();
  }, []);

  const openDetail = async (c: CampaignSession) => {
    setSelectedCampaign(c);
    setSmsAttribution(null);
    let logsQuery = supabase
      .from("campaign_send_log")
      .select("id, campaign_id, source_campaign_id, lead_id, status, sent_at, error_message, nome, telefone, email, provider_status, provider_detail_code, provider_detail_message, opened_at, clicked_at, bounced_at, bounce_reason");
    logsQuery = c.results?._source === "campaigns"
      ? logsQuery.eq("source_campaign_id", c.id)
      : logsQuery.eq("campaign_id", c.id);
    const { data } = await logsQuery
      .order("sent_at", { ascending: false, nullsFirst: false })
      .limit(1000);
    setSendLogs(data || []);
    if (c.channel === "sms") {
      try {
        const { data: attr } = await supabase.rpc("fn_sms_campaign_attribution" as any, { p_campaign_id: c.id });
        if (attr) setSmsAttribution(attr as unknown as SmsAttribution);
      } catch {
        setSmsAttribution(null);
      }
    }
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
              <th className="text-right p-3 font-medium">Na fila</th>
              <th className="text-right p-3 font-medium">Enviados<br/><span className="text-[10px] text-muted-foreground font-normal">Taxa envio</span></th>
              <th className="text-right p-3 font-medium">Abertos<br/><span className="text-[10px] text-muted-foreground font-normal">Taxa abertura</span></th>
              <th className="text-right p-3 font-medium">Cliques<br/><span className="text-[10px] text-muted-foreground font-normal">Taxa clique</span></th>
              <th className="text-right p-3 font-medium">Bounces<br/><span className="text-[10px] text-muted-foreground font-normal">Taxa bounce</span></th>
              <th className="text-right p-3 font-medium">Falhas</th>
              <th className="text-right p-3 font-medium">Conversão<br/><span className="text-[10px] text-muted-foreground font-normal">Novo deal</span></th>
              <th className="text-left p-3 font-medium">Criada</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map(c => {
              const es = emailStats[c.id];
              const isEmail = (c.channel || "").toLowerCase() === "email";
              const total   = isEmail ? (es?.total ?? c.lead_count ?? 0) : (c.lead_count ?? 0);
              const queued  = isEmail ? (es?.queued ?? 0) : 0;
              const sent    = isEmail ? (es?.sent ?? 0) : (c.sent_count ?? 0);
              const opened  = isEmail ? (es?.opened ?? 0) : 0;
              const clicked = isEmail ? (es?.clicked ?? 0) : 0;
              const bounced = isEmail ? (es?.bounced ?? 0) : 0;
              const failed  = isEmail ? (es?.failed ?? c.failed_count ?? 0) : (c.failed_count ?? 0);
              const conv    = conversions[c.id]?.conversions ?? 0;
              const pctOf = (num: number, den: number) => den > 0 ? `${Math.round((num / den) * 100)}%` : "—";
              const sendRate  = total > 0 ? `${Math.round((sent / total) * 100)}%` : "—";
              const openRate  = pctOf(opened, sent);
              const clickRate = pctOf(clicked, sent);
              const bounceRate = pctOf(bounced, sent);
              const convRate  = pctOf(conv, sent);
              return (
                <tr key={c.id} className="border-b hover:bg-accent/5 cursor-pointer" onClick={() => openDetail(c)}>
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3"><Badge variant="outline" className={channelColors[c.channel || ""] || ""}>{c.channel || "—"}</Badge></td>
                  <td className="p-3"><Badge className={statusColors[c.status || "draft"]}>{statusLabels[c.status || "draft"]}</Badge></td>
                  <td className="p-3 text-right">{total || "—"}</td>
                  <td className="p-3 text-right">
                    {isEmail ? (queued > 0 ? <span className="text-amber-600 font-medium">{queued}</span> : "—") : "—"}
                  </td>
                  <td className="p-3 text-right">
                    <div>{sent || "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{sendRate}</div>
                  </td>
                  <td className="p-3 text-right">
                    <div>{isEmail ? (opened > 0 ? <span className="text-blue-600">{opened}</span> : "—") : "—"}</div>
                    {isEmail && <div className="text-[10px] text-muted-foreground">{openRate}</div>}
                  </td>
                  <td className="p-3 text-right">
                    <div>{isEmail ? (clicked > 0 ? <span className="text-emerald-600">{clicked}</span> : "—") : "—"}</div>
                    {isEmail && <div className="text-[10px] text-muted-foreground">{clickRate}</div>}
                  </td>
                  <td className="p-3 text-right">
                    <div>{isEmail ? (bounced > 0 ? <span className="text-red-600 font-medium">{bounced}</span> : "—") : "—"}</div>
                    {isEmail && <div className="text-[10px] text-muted-foreground">{bounceRate}</div>}
                  </td>
                  <td className="p-3 text-right">{failed || "—"}</td>
                  <td className="p-3 text-right">
                    <div className={conv > 0 ? "text-green-600 font-medium" : ""}>{conv || "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{convRate}</div>
                  </td>
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

                {(() => {
                  const isEmail = (selectedCampaign.channel || "").toLowerCase() === "email";
                  const es = emailStats[selectedCampaign.id];
                  const total = isEmail ? (es?.total ?? selectedCampaign.lead_count ?? 0) : (selectedCampaign.lead_count ?? 0);
                  const sent = isEmail ? (es?.sent ?? 0) : (selectedCampaign.sent_count ?? 0);
                  const failed = isEmail ? (es?.failed ?? selectedCampaign.failed_count ?? 0) : (selectedCampaign.failed_count ?? 0);
                  const queued = isEmail ? (es?.queued ?? 0) : 0;
                  const opened = isEmail ? (es?.opened ?? 0) : 0;
                  const clicked = isEmail ? (es?.clicked ?? 0) : 0;
                  const bounced = isEmail ? (es?.bounced ?? 0) : 0;
                  const pct = (n: number) => sent > 0 ? ` (${Math.round((n / sent) * 100)}%)` : "";
                  return (
                    <div className={`grid ${isEmail ? "grid-cols-4" : "grid-cols-3"} gap-3`}>
                      <div className="text-center p-3 border rounded">
                        <p className="text-2xl font-bold">{total}</p>
                        <p className="text-xs text-muted-foreground">Leads</p>
                      </div>
                      <div className="text-center p-3 border rounded">
                        <p className="text-2xl font-bold text-green-600">{sent}</p>
                        <p className="text-xs text-muted-foreground">Enviados</p>
                      </div>
                      {isEmail && (
                        <div className="text-center p-3 border rounded">
                          <p className="text-2xl font-bold text-amber-600">{queued}</p>
                          <p className="text-xs text-muted-foreground">Na fila</p>
                        </div>
                      )}
                      <div className="text-center p-3 border rounded">
                        <p className="text-2xl font-bold text-red-600">{failed}</p>
                        <p className="text-xs text-muted-foreground">Falhas</p>
                      </div>
                      {isEmail && (
                        <>
                          <div className="text-center p-3 border rounded col-span-2">
                            <p className="text-2xl font-bold text-blue-600">{opened}<span className="text-xs text-muted-foreground font-normal">{pct(opened)}</span></p>
                            <p className="text-xs text-muted-foreground">Abertos</p>
                          </div>
                          <div className="text-center p-3 border rounded col-span-2">
                            <p className="text-2xl font-bold text-emerald-600">{clicked}<span className="text-xs text-muted-foreground font-normal">{pct(clicked)}</span></p>
                            <p className="text-xs text-muted-foreground">Cliques</p>
                          </div>
                          <div className="text-center p-3 border rounded col-span-4">
                            <p className="text-2xl font-bold text-red-600">{bounced}<span className="text-xs text-muted-foreground font-normal">{pct(bounced)}</span></p>
                            <p className="text-xs text-muted-foreground">Bounces (e-mail inválido)</p>
                          </div>
                          {(() => {
                            const cv = conversions[selectedCampaign.id];
                            const conv = cv?.conversions ?? 0;
                            const deals = cv?.deals_created ?? 0;
                            return (
                              <div className="text-center p-3 border rounded col-span-4 bg-green-50/50">
                                <p className="text-2xl font-bold text-green-600">
                                  {conv}<span className="text-xs text-muted-foreground font-normal">{pct(conv)}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Conversão · {deals} novo{deals === 1 ? "" : "s"} deal{deals === 1 ? "" : "s"} criado{deals === 1 ? "" : "s"} após o envio
                                </p>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  );
                })()}

                {selectedCampaign.channel === "sms" && smsAttribution && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Enviados / Entregues</p>
                        <p className="text-xl font-bold">{smsAttribution.sent}</p>
                        <p className="text-xs text-muted-foreground">
                          {smsAttribution.delivered} entregues ({smsAttribution.taxa_entrega}%)
                        </p>
                      </Card>
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Custo total</p>
                        <p className="text-xl font-bold">R$ {Number(smsAttribution.custo_total).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          R$ {Number(smsAttribution.custo_unitario).toFixed(4)}/SMS
                        </p>
                      </Card>
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Leads gerados</p>
                        <p className="text-xl font-bold text-blue-600">{smsAttribution.leads_gerados}</p>
                        <p className="text-xs text-muted-foreground">
                          CPL: {smsAttribution.leads_gerados > 0
                            ? `R$ ${(smsAttribution.custo_total / smsAttribution.leads_gerados).toFixed(2)}`
                            : "—"}
                        </p>
                      </Card>
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Receita atribuída</p>
                        <p className="text-xl font-bold text-green-600">
                          R$ {Number(smsAttribution.receita).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ROI: {smsAttribution.roi != null ? `${smsAttribution.roi}%` : "—"} • {smsAttribution.deals_ganhos} vendas
                        </p>
                      </Card>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>🔗 UTM para links desta campanha:</span>
                      <code className="bg-muted px-2 py-0.5 rounded">?{smsAttribution.utm_usado}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1"
                        onClick={() => {
                          navigator.clipboard.writeText("?" + smsAttribution.utm_usado);
                          toast.success("UTM copiado");
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </>
                )}

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

                {sendLogs.length > 0 && (() => {
                  const isEmail = (selectedCampaign.channel || "").toLowerCase() === "email";
                  const [logFilter, setLogFilter] = [undefined, undefined] as any; // placeholder to keep patch minimal
                  return (
                    <SendLogsPanel logs={sendLogs} isEmail={isEmail} channel={selectedCampaign.channel || ""} />
                  );
                })()}

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
function CampaignDrafts({ onEdit }: { onEdit: (draft: DraftCampaign) => void }) {
  const [drafts, setDrafts] = useState<DraftCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns" as any)
      .select("id,nome,descricao,canal,status,mensagem_template,lead_filter,created_at,total_leads,audience_count")
      .eq("status", "rascunho")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error(`Erro ao carregar rascunhos: ${error.message}`);
      setDrafts([]);
    } else {
      setDrafts((data as any) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (draft: DraftCampaign) => {
    if (!confirm(`Excluir o rascunho "${draft.nome}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(draft.id);
    const { error } = await supabase.from("campaigns" as any).delete().eq("id", draft.id);
    setDeletingId(null);
    if (error) {
      toast.error(`Erro ao excluir: ${error.message}`);
      return;
    }
    toast.success("Rascunho excluído");
    setDrafts(prev => prev.filter(d => d.id !== draft.id));
  };

  if (loading) {
    return <div className="h-40 flex items-center justify-center text-muted-foreground">Carregando rascunhos...</div>;
  }

  if (!drafts.length) {
    return (
      <div className="flex flex-col items-center py-20 gap-3">
        <Bookmark className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Nenhum rascunho salvo</p>
        <p className="text-xs text-muted-foreground">
          Rascunhos aparecem aqui quando você salva uma campanha sem disparar
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {drafts.length} rascunho{drafts.length === 1 ? "" : "s"} salvo{drafts.length === 1 ? "" : "s"}
        </p>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
        </Button>
      </div>
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Nome</th>
              <th className="text-left p-3 font-medium">Canal</th>
              <th className="text-left p-3 font-medium">Mensagem</th>
              <th className="text-right p-3 font-medium">Leads</th>
              <th className="text-left p-3 font-medium">Criado</th>
              <th className="text-right p-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map(d => (
              <tr key={d.id} className="border-b hover:bg-accent/5">
                <td className="p-3 font-medium">{d.nome}</td>
                <td className="p-3">
                  <Badge variant="outline" className={channelColors[d.canal || ""] || ""}>
                    {d.canal || "—"}
                  </Badge>
                </td>
                <td className="p-3 max-w-[320px] truncate text-muted-foreground">
                  {d.mensagem_template || "—"}
                </td>
                <td className="p-3 text-right">{d.total_leads ?? d.audience_count ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{formatDate(d.created_at)}</td>
                <td className="p-3">
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => onEdit(d)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(d)}
                      disabled={deletingId === d.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deletingId === d.id
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SmartOpsCampaigns() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("sub") || "biblioteca";
  const setActiveTab = (val: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("sub", val);
    if (!next.get("tab")) next.set("tab", "campanhas");
    setSearchParams(next, { replace: true });
  };
  const [preSelectedContent, setPreSelectedContent] = useState<ContentItem | null>(null);
  const [resumeDraft, setResumeDraft] = useState<DraftCampaign | null>(null);

  const handleSelectContent = (content: ContentItem) => {
    setPreSelectedContent(content);
    setActiveTab("criar");
  };

  const handleCampaignCreated = () => {
    setPreSelectedContent(null);
    setResumeDraft(null);
    setActiveTab("historico");
  };

  const handleEditDraft = (draft: DraftCampaign) => {
    setResumeDraft(draft);
    setActiveTab("criar");
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
          <TabsTrigger value="rascunhos">Rascunhos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="grupos-wa">Grupos WA</TabsTrigger>
        </TabsList>

        <TabsContent value="biblioteca">
          <ContentLibrary onSelectContent={handleSelectContent} />
        </TabsContent>
        <TabsContent value="criar">
          <CreateCampaign
            preSelectedContent={preSelectedContent}
            onCreated={handleCampaignCreated}
            resumeDraft={resumeDraft}
            onDraftConsumed={() => setResumeDraft(null)}
          />
        </TabsContent>
        <TabsContent value="rascunhos">
          <CampaignDrafts onEdit={handleEditDraft} />
        </TabsContent>
        <TabsContent value="historico">
          <CampaignHistory />
        </TabsContent>
        <TabsContent value="grupos-wa">
          <SmartOpsWaGroupCampaigns />
        </TabsContent>
      </Tabs>
    </div>
  );
}
