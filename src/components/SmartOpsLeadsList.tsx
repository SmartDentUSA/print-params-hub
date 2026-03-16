import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import "@/styles/intelligence-dark.css";
import { supabase } from "@/integrations/supabase/client";
import { Search, Download, ChevronLeft, ChevronRight, X, Send, Loader2 } from "lucide-react";
import { SmartOpsLeadImporter } from "./SmartOpsLeadImporter";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { LeadDetailPanel } from "./smartops/LeadDetailPanel";

// ─── Constants ───
const PAGE_SIZE = 200;

const BUYER_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "company", label: "🏢 Empresa" },
  { key: "person", label: "👤 Pessoa" },
  { key: "ltv", label: "💰 Com LTV" },
  { key: "scanner", label: "🔬 Scanner SD" },
] as const;

const PIPELINE_GROUPS: Record<string, { label: string; emoji: string; statuses: string[] }> = {
  vendas: {
    label: "Vendas", emoji: "🎯",
    statuses: ["novo", "sem_contato", "contato_feito", "em_contato", "apresentacao", "proposta_enviada", "negociacao", "fechamento"],
  },
  estagnados: {
    label: "Estagnados", emoji: "🔄",
    statuses: ["est_etapa1", "est_etapa2", "est_etapa3", "est_etapa4", "est_apresentacao", "est_proposta", "estagnado_final"],
  },
  cs: {
    label: "CS", emoji: "🎓",
    statuses: ["cs_auxiliar_email", "cs_em_espera", "cs_sem_data_agendar", "cs_nao_quer_imersao", "cs_treinamento_agendado", "cs_treinamento_realizado", "cs_enviar_imp3d", "cs_equipamentos_entregues", "cs_retirar_scan", "cs_acompanhamento_15d", "cs_acomp_30d_comercial", "cs_acompanhamento_atencao", "cs_finalizado", "cs_nao_use_dkmngr", "cs_nao_use_omie_fix"],
  },
  insumos: {
    label: "Insumos", emoji: "🧪",
    statuses: ["insumos_sem_contato", "insumos_contato_feito", "insumos_amostra_enviada", "insumos_retorno_amostra", "insumos_fechamento"],
  },
  ecommerce: {
    label: "E-commerce", emoji: "🛒",
    statuses: ["ecom_visitantes", "ecom_navegacao", "ecom_checkout", "ecom_abandono", "ecom_transacao", "ecom_pedido", "ecom_pos_venda", "ecom_ativacao"],
  },
  ebook: { label: "Ebook", emoji: "📚", statuses: ["ebook"] },
};

const ALL_STATUSES = Object.values(PIPELINE_GROUPS).flatMap((g) => g.statuses);

const STATUS_LABEL: Record<string, string> = {};
Object.values(PIPELINE_GROUPS).forEach((g) => {
  g.statuses.forEach((s) => {
    STATUS_LABEL[s] = s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  });
});

const TEMP_OPTIONS = [
  { key: "all", label: "Todas" },
  { key: "quente", label: "🔥 Quente" },
  { key: "morno", label: "🌤 Morno" },
  { key: "frio", label: "❄️ Frio" },
];

const URGENCY_OPTIONS = [
  { key: "all", label: "Todas" },
  { key: "alta", label: "🔴 Alta" },
  { key: "media", label: "🟡 Média" },
  { key: "baixa", label: "🟢 Baixa" },
];

const OPORT_OPTIONS = [
  { key: "all", label: "Todas" },
  { key: "aberta", label: "Aberta" },
  { key: "ganha", label: "Ganha" },
  { key: "perdida", label: "Perdida" },
];

const STAGE_OPTIONS = [
  { key: "all", label: "Todos" },
  { key: "MQL_pesquisador", label: "🔍 MQL" },
  { key: "SAL_comparador", label: "🔄 SAL" },
  { key: "SQL_decisor", label: "✅ SQL" },
  { key: "CLIENTE_ativo", label: "👑 Cliente" },
];

const PRODUCT_FLAGS = ["scan", "notebook", "cad", "cad_ia", "smart_slice", "print", "cura", "insumos"] as const;

const INTEREST_OPTIONS = [
  { key: "all", label: "Todos Interesses" },
  { key: "sdr_scanner_interesse", label: "📷 Scanner" },
  { key: "sdr_impressora_interesse", label: "🖨️ Impressora" },
  { key: "sdr_software_cad_interesse", label: "💻 Software CAD" },
  { key: "sdr_pos_impressao_interesse", label: "♨️ Pós-impressão" },
  { key: "sdr_caracterizacao_interesse", label: "🔬 Caracterização" },
  { key: "sdr_cursos_interesse", label: "🎓 Cursos" },
  { key: "sdr_dentistica_interesse", label: "🦷 Dentística" },
  { key: "sdr_insumos_lab_interesse", label: "🧪 Insumos Lab" },
  { key: "sdr_solucoes_interesse", label: "🔧 Soluções" },
] as const;

const DEAL_STATUS_OPTIONS = [
  { key: "all", label: "Todos Status Deal" },
  { key: "won", label: "✅ Ganha" },
  { key: "lost", label: "❌ Perdida" },
  { key: "open", label: "🔵 Aberta" },
];

interface AdvancedFilters {
  pipeline: string;
  status: string;
  temperatura: string;
  urgency: string;
  source: string;
  produto: string;
  uf: string;
  proprietario: string;
  oportunidade: string;
  stage: string;
  activeProduct: string;
  interestProduct: string;
  itemProposta: string;
  dealStatusFilter: string;
  statusCRM: string;
  valorMin: string;
  valorMax: string;
  stagnant: boolean;
}

const EMPTY_ADV_FILTERS: AdvancedFilters = {
  pipeline: "all", status: "all", temperatura: "all", urgency: "all",
  source: "all", produto: "all", uf: "all", proprietario: "all",
  oportunidade: "all", stage: "all", activeProduct: "all", interestProduct: "all",
  itemProposta: "", dealStatusFilter: "all", statusCRM: "all", valorMin: "", valorMax: "", stagnant: false,
};

// ─── Types ───
interface LeadFull {
  [key: string]: unknown;
  id: string;
  nome: string;
  email: string;
  telefone_normalized: string | null;
  buyer_type: string | null;
  lead_status: string;
  ltv_total: number | null;
  total_deals: number | null;
  workflow_score: number | null;
  intelligence_score: Record<string, unknown> | null;
  intelligence_score_total: number | null;
  equip_scanner: string | null;
  equip_impressora: string | null;
  equip_cad: string | null;
  status_scanner: string | null;
  status_impressora: string | null;
  status_cad: string | null;
  impressora_modelo: string | null;
  area_atuacao: string | null;
  empresa_nome: string | null;
  pessoa_piperun_id: number | null;
  empresa_piperun_id: number | null;
  person_id: string | null;
  company_id: string | null;
  piperun_id: string | null;
  piperun_pipeline_name: string | null;
  piperun_stage_name: string | null;
  source: string | null;
  created_at: string;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  event_timestamp: string;
  entity_type: string | null;
  entity_name: string | null;
  event_data: Record<string, unknown>;
  source_channel: string | null;
  value_numeric: number | null;
}

interface AgentInteraction {
  id: string;
  created_at: string;
  user_message: string;
  agent_response: string | null;
  feedback: string | null;
}

interface WhatsAppMsg {
  id: string;
  created_at: string;
  message_text: string | null;
  direction: string;
  intent_detected: string | null;
  media_url: string | null;
  media_type: string | null;
}

interface MsgLog {
  id: string;
  tipo: string | null;
  mensagem_preview: string | null;
  status: string;
  data_envio: string | null;
}

interface ProductHistory {
  id: string;
  product_name: string | null;
  total_purchased_value: number | null;
  purchased_at: string | null;
  purchase_count: number | null;
}

interface CourseProgress {
  id: string;
  course_name: string | null;
  status: string | null;
  progress_percent: number | null;
  enrolled_at: string | null;
}

interface FormSubmission {
  id: string;
  form_name: string | null;
  submitted_at: string | null;
  equipment_mentioned: string | null;
  product_mentioned: string | null;
}

interface CartHistory {
  id: string;
  total_value: number | null;
  status: string | null;
  created_at: string | null;
  items_count: number | null;
}

interface SdrInteraction {
  id: string;
  contacted_at: string | null;
  notes: string | null;
  channel: string | null;
  outcome: string | null;
}

interface StateEvent {
  id: string;
  from_stage: string | null;
  to_stage: string | null;
  changed_at: string | null;
  is_regression: boolean | null;
  trigger_source: string | null;
}

// ─── Helpers ───
function initials(nome: string): string {
  const p = (nome || "?").trim().split(/\s+/);
  return (p[0][0] + (p[1] ? p[1][0] : "")).toUpperCase();
}

function brl(v: number | null | undefined): string {
  if (!v) return "—";
  return "R$" + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function shortHash(uuid: string | null): string {
  if (!uuid) return "—";
  return uuid.substring(0, 8) + "…";
}

function lisColor(s: number): "hot" | "warm" | "cold" {
  if (s >= 70) return "hot";
  if (s >= 40) return "warm";
  return "cold";
}

function lisLabel(s: number): string {
  if (s >= 70) return "🔥 QUENTE";
  if (s >= 40) return "🌤️ MORNO";
  return "❄️ FRIO";
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    const date = new Date(d);
    return date.toLocaleDateString("pt-BR");
  } catch { return d; }
}

function fmtDateTime(d: string | null): string {
  if (!d) return "—";
  try {
    const date = new Date(d);
    return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch { return d; }
}

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function copyHash(hash: string | null) {
  if (!hash) return;
  navigator.clipboard.writeText(hash).catch(() => {});
  toast.success("Hash copiado!");
}

function avClass(bt: string | null): string {
  if (bt === "company") return "av-c";
  if (bt === "person") return "av-p";
  return "av-u";
}

function s(lead: Record<string, unknown>, key: string): string | null {
  const v = lead[key];
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

function n(lead: Record<string, unknown>, key: string): number | null {
  const v = lead[key];
  if (v === null || v === undefined) return null;
  return Number(v);
}

// ─── TIMELINE ───
const TIMELINE_EMOJI: Record<string, string> = {
  crm_deal_created: "🆕", crm_deal_updated: "🔄", crm_deal_won: "✅", crm_deal_lost: "❌",
  ecommerce_order_created: "🛒", ecommerce_order_paid: "💳", ecommerce_order_cancelled: "🚫",
  ecommerce_order_invoiced: "📦", ecommerce_order_delivered: "🚚", ecommerce_boleto_generated: "🏦",
  lia_conversation: "💬", whatsapp_inbound: "📱", whatsapp_outbound: "📤", form_submission: "📝",
  sellflux_sync: "🔗", astron_enrollment: "🎓", cognitive_analysis: "🧠",
};

const TIMELINE_LABEL: Record<string, string> = {
  crm_deal_created: "Deal criado", crm_deal_updated: "Deal atualizado", crm_deal_won: "Deal ganho 🎉",
  crm_deal_lost: "Deal perdido", ecommerce_order_created: "Pedido criado", ecommerce_order_paid: "Pagamento aprovado",
  ecommerce_order_cancelled: "Pedido cancelado", ecommerce_order_invoiced: "Pedido enviado",
  ecommerce_order_delivered: "Pedido entregue",
};

// ─── LEAD ROW COMPONENT ───
function LeadRow({ lead, active, onClick }: { lead: LeadFull; active: boolean; onClick: () => void }) {
  const lis = (lead.intelligence_score as Record<string, unknown>)?.score_total as number || lead.intelligence_score_total || 0;
  const lc = lisColor(lis);
  const bt = lead.buyer_type;

  return (
    <div className={`intel-lead-row ${active ? "active" : ""}`} onClick={onClick}>
      <div className="intel-lr-top">
        <div className={`intel-avatar ${avClass(bt)}`}>{initials(lead.nome)}</div>
        <div className="intel-lr-info">
          <div className="intel-lr-name">{lead.nome}</div>
          <div className="intel-lr-email">
            {lead.email && !lead.email.includes("placeholder") ? lead.email : (lead.empresa_nome || lead.area_atuacao || "—")}
          </div>
        </div>
        <div>
          <div className={`intel-lr-ltv ${!lead.ltv_total ? "zero" : ""}`}>{brl(lead.ltv_total)}</div>
          <div style={{ fontSize: 10, color: "var(--id-muted)", textAlign: "right" }}>
            {lead.total_deals || 0} deal{(lead.total_deals || 0) !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
      <div className="intel-lr-mid">
        <span className={`intel-lr-tag ${bt === "company" ? "intel-tag-pj" : bt === "person" ? "intel-tag-pf" : "intel-tag-unk"}`}>
          {bt === "company" ? "🏢 Empresa" : bt === "person" ? "👤 Pessoa" : "❓"}
        </span>
        {lead.status_scanner === "tem_smartdent" && (
          <span className="intel-lr-tag intel-tag-scanner">🔬 {lead.equip_scanner || "Scanner SD"}</span>
        )}
        {lead.impressora_modelo && (
          <span className="intel-lr-tag intel-tag-imp">🖨️ {lead.impressora_modelo.split(" ").slice(0, 2).join(" ")}</span>
        )}
        {lead.status_cad === "tem_exocad" && (
          <span className="intel-lr-tag intel-tag-cad">💻 Exocad</span>
        )}
      </div>
      <div className="intel-lr-bottom">
        <div className="intel-lr-stage">{lead.piperun_stage_name || lead.lead_status || "—"}</div>
        <span className={`intel-lis-micro intel-lis-${lc}`}>LIS {lis}</span>
        <span className="intel-wf-micro">WF {lead.workflow_score || 0}/10</span>
      </div>
    </div>
  );
}

// DetailPanel now imported from smartops/LeadDetailPanel
function DetailPanel({ lead, onClose }: { lead: LeadFull; onClose: () => void }) {
  return <LeadDetailPanel lead={lead as any} onClose={onClose} />;
}

// ─── MAIN COMPONENT ───
export function SmartOpsLeadsList() {
  const [leads, setLeads] = useState<LeadFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [buyerFilter, setBuyerFilter] = useState("all");
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(EMPTY_ADV_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLead, setSelectedLead] = useState<LeadFull | null>(null);

  // Dynamic filter options
  const [allSources, setAllSources] = useState<string[]>([]);
  const [allUFs, setAllUFs] = useState<string[]>([]);
  const [allOwners, setAllOwners] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<string[]>([]);
  const [allStatusCRM, setAllStatusCRM] = useState<string[]>([]);

  const setAdv = useCallback(<K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) => {
    setAdvFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load dynamic filter options once
  useEffect(() => {
    Promise.all([
      supabase.from("lia_attendances").select("source").limit(1000),
      supabase.from("lia_attendances").select("uf").limit(1000),
      supabase.from("lia_attendances").select("proprietario_lead_crm").limit(1000),
      supabase.from("lia_attendances").select("produto_interesse").limit(1000),
      supabase.from("lia_attendances").select("status_atual_lead_crm").limit(1000),
    ]).then(([sources, ufs, owners, products, statusCRMs]) => {
      const unique = (data: { [k: string]: string | null }[] | null, key: string) =>
        [...new Set((data || []).map((d) => d[key]).filter(Boolean))].sort() as string[];
      setAllSources(unique(sources.data as { source: string }[], "source"));
      setAllUFs(unique(ufs.data as { uf: string }[], "uf"));
      setAllOwners(unique(owners.data as { proprietario_lead_crm: string }[], "proprietario_lead_crm"));
      setAllProducts(unique(products.data as { produto_interesse: string }[], "produto_interesse"));
      setAllStatusCRM(unique(statusCRMs.data as { status_atual_lead_crm: string }[], "status_atual_lead_crm"));
    });
  }, []);

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);

  const hasAdvFilters = useMemo(() => {
    return Object.entries(advFilters).some(([k, v]) => {
      const def = EMPTY_ADV_FILTERS[k as keyof AdvancedFilters];
      return v !== def;
    });
  }, [advFilters]);

  const activeFilterCount = useMemo(() => {
    return Object.entries(advFilters).filter(([k, v]) => v !== EMPTY_ADV_FILTERS[k as keyof AdvancedFilters]).length;
  }, [advFilters]);

  const statusesForPipeline = useMemo(() => {
    if (advFilters.pipeline === "all") return ALL_STATUSES;
    return PIPELINE_GROUPS[advFilters.pipeline]?.statuses || ALL_STATUSES;
  }, [advFilters.pipeline]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("lia_attendances")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false }) as any;

    // Buyer type filter
    if (buyerFilter === "company") query = query.eq("buyer_type", "company");
    else if (buyerFilter === "person") query = query.eq("buyer_type", "person");
    else if (buyerFilter === "ltv") query = query.gt("ltv_total", 0);
    else if (buyerFilter === "scanner") query = query.eq("status_scanner", "tem_smartdent");

    // Advanced filters
    if (advFilters.pipeline !== "all") {
      const group = PIPELINE_GROUPS[advFilters.pipeline];
      if (group) query = query.in("lead_status", group.statuses);
    }
    if (advFilters.status !== "all") query = query.eq("lead_status", advFilters.status);
    if (advFilters.temperatura !== "all") query = query.ilike("temperatura_lead", advFilters.temperatura);
    if (advFilters.stage !== "all") query = query.eq("lead_stage_detected", advFilters.stage);
    if (advFilters.urgency !== "all") query = query.eq("urgency_level", advFilters.urgency);
    if (advFilters.source !== "all") query = query.eq("source", advFilters.source);
    if (advFilters.produto !== "all") query = query.ilike("produto_interesse", `%${advFilters.produto}%`);
    if (advFilters.uf !== "all") query = query.eq("uf", advFilters.uf);
    if (advFilters.proprietario !== "all") query = query.eq("proprietario_lead_crm", advFilters.proprietario);
    if (advFilters.oportunidade !== "all") query = query.eq("status_oportunidade", advFilters.oportunidade);
    if (advFilters.stagnant) query = query.lte("updated_at", thirtyDaysAgo);
    if (advFilters.valorMin) query = query.gte("valor_oportunidade", Number(advFilters.valorMin));
    if (advFilters.valorMax) query = query.lte("valor_oportunidade", Number(advFilters.valorMax));
    if (advFilters.activeProduct !== "all") query = query.eq(`ativo_${advFilters.activeProduct}`, true);
    // itemProposta is now handled via RPC below
    if (advFilters.itemProposta && !jsonbProductIds) {
      // Fallback: if RPC hasn't run yet, use simple ILIKE
      query = query.ilike("itens_proposta_crm", `%${advFilters.itemProposta}%`);
    }
    if (jsonbProductIds && jsonbProductIds.length > 0) {
      query = query.in("id", jsonbProductIds);
    }
    if (advFilters.interestProduct !== "all") query = query.not(advFilters.interestProduct, "is", null);
    if (advFilters.statusCRM !== "all") query = query.eq("status_atual_lead_crm", advFilters.statusCRM);

    if (debouncedSearch) {
      query = query.or(`nome.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,telefone_normalized.ilike.%${debouncedSearch}%,empresa_nome.ilike.%${debouncedSearch}%`);
    }

    const from = page * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count } = await query;
    setLeads((data as LeadFull[]) || []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, debouncedSearch, buyerFilter, advFilters, thirtyDaysAgo]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { setPage(0); }, [debouncedSearch, buyerFilter, advFilters]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const exportCSV = () => {
    const headers = [
      "nome", "email", "telefone_normalized", "cidade", "uf", "lead_status", "temperatura_lead",
      "lead_stage_detected", "urgency_level", "produto_interesse", "status_oportunidade",
      "valor_oportunidade", "score", "intelligence_score_total", "proprietario_lead_crm",
      "source", "funil_entrada_crm", "itens_proposta_crm", "tags_crm",
      "ativo_scan", "ativo_print", "ativo_cad", "ativo_notebook", "ativo_insumos",
      "sdr_scanner_interesse", "sdr_impressora_interesse", "sdr_software_cad_interesse",
      "sdr_pos_impressao_interesse", "sdr_cursos_interesse", "sdr_dentistica_interesse",
      "sdr_insumos_lab_interesse", "sdr_solucoes_interesse", "sdr_caracterizacao_interesse",
      "rota_inicial_lia", "resumo_historico_ia", "created_at", "updated_at"
    ];
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const sv = Array.isArray(v) ? v.join("; ") : String(v);
      return `"${sv.replace(/"/g, '""')}"`;
    };
    const csv = [headers.join(","), ...leads.map((l) => headers.map((h) => escape((l as Record<string, unknown>)[h])).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads_intelligence_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${leads.length} leads exportados`);
  };

  return (
    <div className="intel-dark">
      {/* Topbar */}
      <div className="intel-topbar">
        <div className="intel-logo">Smart<em>Dent</em></div>
        <span style={{ fontSize: 11, color: "var(--id-muted)" }}>
          Público / Lista ({totalCount.toLocaleString("pt-BR")} leads)
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <SmartOpsLeadImporter onComplete={fetchLeads} />
          <button className="intel-btn" onClick={exportCSV}>
            <Download size={12} /> CSV ({leads.length})
          </button>
          <span className="intel-pill intel-pill-blue">🧠 IA</span>
          <span className="intel-pill intel-pill-green">
            <span className="intel-dot-live" /> Live
          </span>
        </div>
      </div>

      {/* Split Layout */}
      <div className={`intel-split ${selectedLead ? "has-detail" : ""}`}>
        {/* SIDEBAR */}
        <div className="intel-sidebar">
          <div className="intel-sidebar-head">
            <div className="intel-sidebar-title">
              Lista de Leads
              <span className="count">{totalCount.toLocaleString("pt-BR")} leads</span>
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--id-muted)" }}>🔍</span>
              <input
                className="intel-search-input"
                placeholder="Buscar por nome, email, telefone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {/* Buyer type pills */}
            <div className="intel-filter-row">
              {BUYER_FILTERS.map((f) => (
                <div
                  key={f.key}
                  className={`intel-filt ${buyerFilter === f.key ? "on" : ""}`}
                  onClick={() => setBuyerFilter(f.key)}
                >
                  {f.label}
                </div>
              ))}
            </div>

            {/* Advanced filters toggle */}
            <button
              className="intel-btn"
              style={{ width: "100%", justifyContent: "center", marginTop: 4, fontSize: 11 }}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              🔧 Filtros Avançados {activeFilterCount > 0 && `(${activeFilterCount})`} {showAdvanced ? "▲" : "▼"}
            </button>

            {hasAdvFilters && (
              <button
                className="intel-btn"
                style={{ width: "100%", justifyContent: "center", marginTop: 2, fontSize: 10, color: "var(--id-hot)" }}
                onClick={() => setAdvFilters(EMPTY_ADV_FILTERS)}
              >
                ✕ Limpar filtros
              </button>
            )}

            {/* Advanced filters panel */}
            {showAdvanced && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                {/* Pipeline */}
                <select
                  className="intel-select"
                  value={advFilters.pipeline}
                  onChange={(e) => { setAdv("pipeline", e.target.value); setAdv("status", "all"); }}
                >
                  <option value="all">Todos Pipelines</option>
                  {Object.entries(PIPELINE_GROUPS).map(([k, g]) => (
                    <option key={k} value={k}>{g.emoji} {g.label}</option>
                  ))}
                </select>
                {/* Status */}
                <select className="intel-select" value={advFilters.status} onChange={(e) => setAdv("status", e.target.value)}>
                  <option value="all">Todos Status</option>
                  {statusesForPipeline.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>
                  ))}
                </select>
                {/* Temperatura */}
                <select className="intel-select" value={advFilters.temperatura} onChange={(e) => setAdv("temperatura", e.target.value)}>
                  {TEMP_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                {/* Urgência */}
                <select className="intel-select" value={advFilters.urgency} onChange={(e) => setAdv("urgency", e.target.value)}>
                  {URGENCY_OPTIONS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
                </select>
                {/* Estágio Cognitivo */}
                <select className="intel-select" value={advFilters.stage} onChange={(e) => setAdv("stage", e.target.value)}>
                  {STAGE_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                {/* Origem */}
                <select className="intel-select" value={advFilters.source} onChange={(e) => setAdv("source", e.target.value)}>
                  <option value="all">Todas Origens</option>
                  {allSources.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {/* Produto */}
                <select className="intel-select" value={advFilters.produto} onChange={(e) => setAdv("produto", e.target.value)}>
                  <option value="all">Todos Produtos</option>
                  {allProducts.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                {/* UF */}
                <select className="intel-select" value={advFilters.uf} onChange={(e) => setAdv("uf", e.target.value)}>
                  <option value="all">Todos UFs</option>
                  {allUFs.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                {/* Proprietário */}
                <select className="intel-select" value={advFilters.proprietario} onChange={(e) => setAdv("proprietario", e.target.value)}>
                  <option value="all">Todos Proprietários</option>
                  {allOwners.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {/* Oportunidade */}
                <select className="intel-select" value={advFilters.oportunidade} onChange={(e) => setAdv("oportunidade", e.target.value)}>
                  {OPORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                {/* Produto Ativo */}
                <select className="intel-select" value={advFilters.activeProduct} onChange={(e) => setAdv("activeProduct", e.target.value)}>
                  <option value="all">Prod. Ativo</option>
                  {PRODUCT_FLAGS.map((p) => <option key={p} value={p}>{p.replace("_", " ").toUpperCase()}</option>)}
                </select>
                {/* Interesse */}
                <select className="intel-select" value={advFilters.interestProduct} onChange={(e) => setAdv("interestProduct", e.target.value)}>
                  {INTEREST_OPTIONS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
                </select>
                {/* Item Proposta - JSONB deep search */}
                <input
                  className="intel-search-input"
                  style={{ fontSize: 11 }}
                  placeholder="🔍 Produto na proposta (ex: Medit i600)"
                  value={advFilters.itemProposta}
                  onChange={(e) => setAdv("itemProposta", e.target.value)}
                />
                {/* Deal Status Filter */}
                <select className="intel-select" value={advFilters.dealStatusFilter} onChange={(e) => setAdv("dealStatusFilter", e.target.value)}>
                  {DEAL_STATUS_OPTIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
                {/* Status CRM */}
                <select className="intel-select" value={advFilters.statusCRM} onChange={(e) => setAdv("statusCRM", e.target.value)}>
                  <option value="all">Todos Status CRM</option>
                  {allStatusCRM.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {/* Valor min/max */}
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    className="intel-search-input"
                    style={{ flex: 1, fontSize: 11 }}
                    type="number"
                    placeholder="Valor mín."
                    value={advFilters.valorMin}
                    onChange={(e) => setAdv("valorMin", e.target.value)}
                  />
                  <input
                    className="intel-search-input"
                    style={{ flex: 1, fontSize: 11 }}
                    type="number"
                    placeholder="Valor máx."
                    value={advFilters.valorMax}
                    onChange={(e) => setAdv("valorMax", e.target.value)}
                  />
                </div>
                {/* Estagnados */}
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--id-muted2)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={advFilters.stagnant}
                    onChange={(e) => setAdv("stagnant", e.target.checked)}
                    style={{ accentColor: "var(--id-acc)" }}
                  />
                  Estagnados (&gt;30d)
                </label>
              </div>
            )}
          </div>

          <div className="intel-leads-list">
            {loading ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--id-muted)" }}>Carregando leads...</div>
            ) : leads.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--id-muted)" }}>Nenhum lead encontrado</div>
            ) : (
              <>
                {leads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    active={selectedLead?.id === lead.id}
                    onClick={() => setSelectedLead(lead)}
                  />
                ))}
                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 4px" }}>
                    <span style={{ fontSize: 10, color: "var(--id-muted)" }}>Pag {page + 1}/{totalPages}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="intel-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                        <ChevronLeft size={12} />
                      </button>
                      <button className="intel-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* DETAIL PANEL */}
        {selectedLead ? (
          <DetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
        ) : (
          <div className="intel-detail">
            <div className="intel-detail-empty">
              <div className="big">📊</div>
              <p>Selecione um lead na lista para ver o Intelligence Card completo</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
