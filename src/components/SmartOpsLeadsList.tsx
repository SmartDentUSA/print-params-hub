import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import "@/styles/intelligence-dark.css";
import { supabase } from "@/integrations/supabase/client";
import { Search, Download, ChevronLeft, ChevronRight, X, Send, Loader2 } from "lucide-react";
import { SmartOpsLeadImporter } from "./SmartOpsLeadImporter";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

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

const ITEM_PROPOSTA_OPTIONS = [
  { key: "all", label: "Todos Itens" },
  { key: "Scanner", label: "Scanner" },
  { key: "Impressora", label: "Impressora" },
  { key: "CAD", label: "Software CAD" },
  { key: "Notebook", label: "Notebook" },
  { key: "Resina", label: "Resina" },
  { key: "Insumo", label: "Insumos" },
  { key: "Pós", label: "Pós-impressão" },
  { key: "Cura", label: "Cura" },
  { key: "Curso", label: "Cursos" },
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
  statusCRM: string;
  valorMin: string;
  valorMax: string;
  stagnant: boolean;
}

const EMPTY_ADV_FILTERS: AdvancedFilters = {
  pipeline: "all", status: "all", temperatura: "all", urgency: "all",
  source: "all", produto: "all", uf: "all", proprietario: "all",
  oportunidade: "all", stage: "all", activeProduct: "all", interestProduct: "all",
  itemProposta: "all", statusCRM: "all", valorMin: "", valorMax: "", stagnant: false,
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

// ─── DETAIL PANEL ───
function DetailPanel({ lead, onClose }: { lead: LeadFull; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState("identity");
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [liaInteractions, setLiaInteractions] = useState<AgentInteraction[]>([]);
  const [whatsappMsgs, setWhatsappMsgs] = useState<WhatsAppMsg[]>([]);
  const [messageLogs, setMessageLogs] = useState<MsgLog[]>([]);
  const [productHistory, setProductHistory] = useState<ProductHistory[]>([]);
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [formSubmissions, setFormSubmissions] = useState<FormSubmission[]>([]);
  const [cartHistory, setCartHistory] = useState<CartHistory[]>([]);
  const [sdrInteractions, setSdrInteractions] = useState<SdrInteraction[]>([]);
  const [stateEvents, setStateEvents] = useState<StateEvent[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // IA Tab state
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState<string | null>(null);

  // Chat Tab state
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Reset IA/Chat when lead changes
  useEffect(() => {
    setAiResult("");
    setAiAction(null);
    setChatMessages([]);
    setChatInput("");
  }, [lead?.id]);

  // Load all related data on lead change
  useEffect(() => {
    if (!lead?.id) return;
    setLoadingDetail(true);

    const promises = [
      supabase.from("lead_activity_log")
        .select("id, event_type, event_timestamp, entity_type, entity_name, event_data, source_channel, value_numeric")
        .eq("lead_id", lead.id).order("event_timestamp", { ascending: false }).limit(200),
      supabase.from("agent_interactions")
        .select("id, created_at, user_message, agent_response, feedback")
        .eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("whatsapp_inbox")
        .select("id, created_at, message_text, direction, intent_detected, media_url, media_type")
        .eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("message_logs")
        .select("id, tipo, mensagem_preview, status, data_envio")
        .eq("lead_id", lead.id).order("data_envio", { ascending: false }).limit(50),
      supabase.from("lead_product_history")
        .select("id, product_name, total_purchased_value, purchased_at, purchase_count")
        .eq("lead_id", lead.id).order("purchased_at", { ascending: false }).limit(50),
      supabase.from("lead_course_progress")
        .select("id, course_name, status, enrolled_at")
        .eq("lead_id", lead.id).order("enrolled_at", { ascending: false }).limit(50),
      supabase.from("lead_form_submissions")
        .select("id, form_name, submitted_at, equipment_mentioned, product_mentioned")
        .eq("lead_id", lead.id).order("submitted_at", { ascending: false }).limit(50),
      supabase.from("lead_cart_history")
        .select("id, total_value, status, created_at, items_count")
        .eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("lead_sdr_interactions")
        .select("id, contacted_at, notes, channel, outcome")
        .eq("lead_id", lead.id).order("contacted_at", { ascending: false }).limit(50),
      supabase.from("lead_state_events")
        .select("id, from_stage, to_stage, changed_at, is_regression, trigger_source")
        .eq("lead_id", lead.id).order("changed_at", { ascending: false }).limit(50),
    ];

    Promise.all(promises).then(([r1, r2, r3, r4, r5, r6, r7, r8, r9, r10]) => {
      setTimelineEvents((r1.data || []) as unknown as TimelineEvent[]);
      setLiaInteractions((r2.data || []) as unknown as AgentInteraction[]);
      setWhatsappMsgs((r3.data || []) as unknown as WhatsAppMsg[]);
      setMessageLogs((r4.data || []) as unknown as MsgLog[]);
      setProductHistory((r5.data || []) as unknown as ProductHistory[]);
      setCourseProgress((r6.data || []) as unknown as CourseProgress[]);
      setFormSubmissions((r7.data || []) as unknown as FormSubmission[]);
      setCartHistory((r8.data || []) as unknown as CartHistory[]);
      setSdrInteractions((r9.data || []) as unknown as SdrInteraction[]);
      setStateEvents((r10.data || []) as unknown as StateEvent[]);
      setLoadingDetail(false);
    });

    // Realtime for timeline
    const channel = supabase
      .channel(`timeline-${lead.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lead_activity_log", filter: `lead_id=eq.${lead.id}` },
        (payload) => setTimelineEvents((prev) => [payload.new as TimelineEvent, ...prev])
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lead?.id]);

  const lis = (lead.intelligence_score as Record<string, unknown>)?.score_total as number || lead.intelligence_score_total || 0;
  const lc = lisColor(lis);
  const axes = ((lead.intelligence_score as Record<string, unknown>)?.axes || {}) as Record<string, { value: number }>;
  const bt = lead.buyer_type;
  const wfScore = lead.workflow_score || 0;
  const personLinked = !!lead.person_id;
  const companyLinked = !!lead.company_id;

  // Deals history from JSONB
  const dealsHistory = Array.isArray(lead.piperun_deals_history) ? lead.piperun_deals_history as Record<string, unknown>[] : [];

  // Build lead context string for AI calls
  const buildLeadContext = useCallback(() => {
    const fields = [
      `Nome: ${lead.nome}`, `Email: ${lead.email}`, `Telefone: ${lead.telefone_normalized || "—"}`,
      `Buyer Type: ${lead.buyer_type || "—"}`, `Área: ${lead.area_atuacao || "—"}`, `Empresa: ${lead.empresa_nome || "—"}`,
      `Status: ${lead.lead_status}`, `LTV: ${brl(lead.ltv_total)}`, `Deals: ${lead.total_deals || 0}`,
      `LIS Score: ${lis}`, `Workflow: ${wfScore}/10`,
      `Scanner: ${lead.equip_scanner || "—"} (${lead.status_scanner || "—"})`,
      `Impressora: ${lead.impressora_modelo || "—"} (${lead.status_impressora || "—"})`,
      `CAD: ${lead.status_cad || "—"}`,
      `Pipeline: ${lead.piperun_pipeline_name || "—"} / ${lead.piperun_stage_name || "—"}`,
      `Source: ${lead.source || "—"}`,
      s(lead, "urgency_level") ? `Urgência: ${s(lead, "urgency_level")}` : null,
      s(lead, "interest_timeline") ? `Timeline: ${s(lead, "interest_timeline")}` : null,
      s(lead, "psychological_profile") ? `Perfil: ${s(lead, "psychological_profile")}` : null,
      s(lead, "primary_motivation") ? `Motivação: ${s(lead, "primary_motivation")}` : null,
      s(lead, "recommended_approach") ? `Abordagem: ${s(lead, "recommended_approach")}` : null,
      s(lead, "resumo_historico_ia") ? `Resumo IA: ${s(lead, "resumo_historico_ia")}` : null,
      s(lead, "produto_interesse") ? `Produto Interesse: ${s(lead, "produto_interesse")}` : null,
      dealsHistory.length > 0 ? `Deals History: ${dealsHistory.map(d => `${d.product || d.title} R$${d.value}`).join(", ")}` : null,
    ].filter(Boolean).join("\n");
    return fields;
  }, [lead, lis, wfScore, dealsHistory]);

  const callCopilotIA = useCallback(async (action: string) => {
    setAiLoading(true);
    setAiAction(action);
    setAiResult("");

    const prompts: Record<string, string> = {
      analise: `Faça uma análise cognitiva completa deste lead. Identifique padrões comportamentais, nível de maturidade técnica, propensão de compra e recomendações estratégicas. Seja direto e use dados concretos.`,
      script: `Crie um script de WhatsApp personalizado para abordar este lead. Considere o perfil psicológico, produtos de interesse, histórico de compras e nível de urgência. O script deve ter: abertura, proposta de valor, call-to-action. Use linguagem natural e persuasiva.`,
      reativacao: `Desenvolva uma estratégia de reativação para este lead. Analise: tempo de inatividade, último ponto de contato, produtos de interesse, e workflow gaps. Proponha 3 ações concretas ordenadas por prioridade com timeline sugerida.`,
    };

    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-copilot", {
        body: {
          message: `${prompts[action]}\n\n--- DADOS DO LEAD ---\n${buildLeadContext()}`,
          context: { source: "ia_tab", lead_id: lead.id, action },
        },
      });
      if (error) throw error;
      setAiResult(data?.response || data?.message || "Sem resposta da IA.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setAiResult(`❌ Erro: ${msg}`);
      toast.error("Falha na análise IA");
    } finally {
      setAiLoading(false);
    }
  }, [buildLeadContext, lead.id]);

  const sendChatMessage = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    const userMsg = { role: "user" as const, content: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const allMsgs = [...chatMessages, userMsg];
      const systemCtx = `Você é a LIA (Lead Intelligence Assistant), assistente especializada em análise de leads para a SmartDent. Responda com base nos dados do lead abaixo. Seja direta, use dados concretos, e formate com markdown.\n\n--- DADOS DO LEAD ---\n${buildLeadContext()}`;

      const { data, error } = await supabase.functions.invoke("smart-ops-copilot", {
        body: {
          message: msg,
          context: {
            source: "chat_tab",
            lead_id: lead.id,
            system_override: systemCtx,
            history: allMsgs.slice(-10),
          },
        },
      });
      if (error) throw error;
      setChatMessages(prev => [...prev, { role: "assistant", content: data?.response || data?.message || "Sem resposta." }]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erro desconhecido";
      setChatMessages(prev => [...prev, { role: "assistant", content: `❌ Erro: ${errMsg}` }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [chatInput, chatLoading, chatMessages, buildLeadContext, lead.id]);

  const tabs = [
    { key: "identity", label: "🔗 Identidade" },
    { key: "score", label: "📊 LIS Score" },
    { key: "equipment", label: "⚙️ Equipamentos" },
    { key: "ia", label: "🧠 IA" },
    { key: "chat", label: "💬 Chat" },
    { key: "timeline", label: `⏱️ Timeline (${timelineEvents.length})` },
    { key: "conversations", label: `💬 Conversas` },
    { key: "behavioral", label: "🧠 Behavioral" },
    { key: "overview", label: "📋 Visão Geral" },
  ];

  return (
    <div className="intel-detail">
      <div className="intel-card-inner">
        {/* Close button for mobile */}
        <button className="intel-btn mb-3 lg:hidden" onClick={onClose}>
          <X size={14} /> Voltar à lista
        </button>

        {/* HERO CARD */}
        <div className="intel-hero">
          <div className={`intel-avatar intel-avatar-lg ${avClass(bt)}`}>{initials(lead.nome)}</div>
          <div>
            <div className={`intel-buyer-badge ${bt === "company" ? "intel-bb-c" : bt === "person" ? "intel-bb-p" : "intel-bb-u"}`}>
              {bt === "company" ? "🏢 B2B — EMPRESA" : bt === "person" ? "👤 B2C — PESSOA" : "❓ DESCONHECIDO"}
            </div>
            <div className="intel-lead-name-h">{lead.nome}</div>
            <div className="intel-meta-row">
              {lead.area_atuacao && <span className="intel-meta">🏥 <strong>{lead.area_atuacao}</strong></span>}
              {lead.empresa_nome && <span className="intel-meta">🏢 <strong>{lead.empresa_nome}</strong></span>}
              {lead.telefone_normalized && <span className="intel-meta">📞 <strong>{lead.telefone_normalized}</strong></span>}
              {lead.piperun_stage_name && <span className="intel-meta">📊 <strong>{lead.piperun_stage_name}</strong></span>}
              <span className="intel-meta">📡 <strong>{lead.source || "—"}</strong></span>
            </div>
          </div>
          <div className="intel-wf-block">
            <div className="intel-blk-label">Workflow</div>
            <div className="intel-wf-val-h">{wfScore}<span style={{ fontSize: 13, color: "var(--id-muted)" }}>/10</span></div>
            <div className="intel-wf-bar-h">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className={`intel-wf-seg ${i < wfScore ? "on" : ""}`} />
              ))}
            </div>
          </div>
          <div>
            <div className="intel-blk-label">LTV Total</div>
            <div className="intel-ltv-val">{brl(lead.ltv_total)}</div>
            <div className="intel-ltv-sub">{lead.total_deals || 0} deal{(lead.total_deals || 0) !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="intel-blk-label">LIS Score</div>
            <div className={`intel-lis-val-h intel-lis-${lc}-h`}>{lis}</div>
            <div className={`intel-heat-badge intel-hb-${lc}`}>{lisLabel(lis)}</div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ background: "var(--id-s1)", border: "1px solid var(--id-b2)", borderRadius: 14, overflow: "hidden" }}>
          <div className="intel-tabs">
            {tabs.map((tab) => (
              <div key={tab.key} className={`intel-tab ${activeTab === tab.key ? "active" : ""}`} onClick={() => setActiveTab(tab.key)}>
                {tab.label}
              </div>
            ))}
          </div>
          <div className="intel-tab-body">
            {/* TAB: IDENTITY */}
            {activeTab === "identity" && (
              <div>
                <div className="intel-sec">Identity Graph — vínculos pessoa · empresa</div>
                <div className="intel-ig-section">
                  <div style={{ fontSize: 11, color: "var(--id-muted2)", marginBottom: 14 }}>
                    Rastreabilidade completa: lia_attendances → people → companies → PipeRun CRM
                  </div>
                  <div className="intel-ig-grid">
                    <div className="intel-ig-node" style={{ borderColor: "rgba(79,143,255,.3)" }}>
                      <div className="intel-ig-node-label">📊 lia_attendances</div>
                      <div className="intel-ig-node-name">{lead.nome}</div>
                      <div style={{ fontSize: 10, color: "var(--id-muted)", marginTop: 4 }}>id (uuid PK)</div>
                      <div className="intel-ig-hash ok" onClick={() => copyHash(lead.id)}>{shortHash(lead.id)}</div>
                      {lead.pessoa_piperun_id && (
                        <>
                          <div style={{ fontSize: 10, color: "var(--id-muted)", marginTop: 4 }}>pessoa_piperun_id</div>
                          <div className="intel-ig-hash ok">{lead.pessoa_piperun_id}</div>
                        </>
                      )}
                    </div>
                    <div className="intel-ig-conn">
                      <div className={`intel-ig-rel-badge ${personLinked ? "intel-rel-ok" : "intel-rel-miss"}`}>
                        {personLinked ? "person_id →" : "sem FK →"}
                      </div>
                      <div className="intel-ig-arrow-line" />
                    </div>
                    <div className="intel-ig-node" style={{ borderColor: personLinked ? "rgba(79,255,176,.25)" : "rgba(255,71,87,.25)" }}>
                      <div className="intel-ig-node-label">👤 people</div>
                      <div className="intel-ig-node-name">{lead.nome}</div>
                      {personLinked ? (
                        <>
                          <div style={{ fontSize: 10, color: "var(--id-muted)", marginTop: 4 }}>person.id</div>
                          <div className="intel-ig-hash ok" onClick={() => copyHash(lead.person_id)}>{shortHash(lead.person_id)}</div>
                        </>
                      ) : (
                        <div className="intel-ig-hash miss" style={{ marginTop: 8 }}>Não vinculado</div>
                      )}
                    </div>
                    <div className="intel-ig-conn">
                      <div className={`intel-ig-rel-badge ${companyLinked ? "intel-rel-ok" : "intel-rel-miss"}`}>
                        {companyLinked ? "company_id →" : "sem FK →"}
                      </div>
                      <div className="intel-ig-arrow-line" />
                    </div>
                    <div className="intel-ig-node" style={{ borderColor: companyLinked ? "rgba(232,255,71,.22)" : "rgba(255,71,87,.25)" }}>
                      <div className="intel-ig-node-label">🏢 companies</div>
                      <div className="intel-ig-node-name">{lead.empresa_nome || "—"}</div>
                      {companyLinked ? (
                        <>
                          <div style={{ fontSize: 10, color: "var(--id-muted)", marginTop: 4 }}>company.id</div>
                          <div className="intel-ig-hash ok" onClick={() => copyHash(lead.company_id)}>{shortHash(lead.company_id)}</div>
                        </>
                      ) : (
                        <div className="intel-ig-hash miss" style={{ marginTop: 8 }}>Não vinculado</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="intel-sec">Mapa de Chaves</div>
                <table className="intel-key-table">
                  <thead><tr><th>Entidade</th><th>Campo</th><th>Hash / Valor</th><th>Status</th></tr></thead>
                  <tbody>
                    {[
                      { e: "Lead Hub", f: "id (uuid PK)", v: shortHash(lead.id), full: lead.id, st: "ok" },
                      { e: "Pessoa FK", f: "person_id", v: personLinked ? shortHash(lead.person_id) : "—", full: lead.person_id, st: personLinked ? "ok" : "miss" },
                      { e: "Empresa FK", f: "company_id", v: companyLinked ? shortHash(lead.company_id) : "—", full: lead.company_id, st: companyLinked ? "ok" : "miss" },
                      { e: "CRM Pessoa", f: "pessoa_piperun_id", v: lead.pessoa_piperun_id || "—", full: null, st: lead.pessoa_piperun_id ? "ok" : "miss" },
                      { e: "CRM Empresa", f: "empresa_piperun_id", v: lead.empresa_piperun_id || "—", full: null, st: lead.empresa_piperun_id ? "ok" : "miss" },
                      { e: "Deal Ativo", f: "piperun_id", v: lead.piperun_id || "—", full: null, st: lead.piperun_id ? "open" : "miss" },
                      { e: "Email", f: "email", v: lead.email && !lead.email.includes("placeholder") ? lead.email : "placeholder", full: null, st: lead.email && !lead.email.includes("placeholder") ? "ok" : "miss" },
                      { e: "Telefone", f: "telefone_normalized", v: lead.telefone_normalized || "—", full: null, st: lead.telefone_normalized ? "ok" : "miss" },
                    ].map((row, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--id-muted2)" }}>{row.e}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", color: "var(--id-blue)", fontSize: 10 }}>{row.f}</td>
                        <td>
                          <span
                            className={`intel-ig-hash ${row.st === "ok" ? "ok" : row.st === "miss" ? "miss" : ""}`}
                            onClick={() => row.full && copyHash(row.full)}
                            style={{ cursor: row.full ? "pointer" : "default" }}
                          >{String(row.v)}</span>
                        </td>
                        <td>
                          <span className={`intel-s-chip ${row.st === "ok" ? "intel-sc-ok" : row.st === "open" ? "intel-sc-open" : "intel-sc-miss"}`}>
                            {row.st === "ok" ? "✓ Ativo" : row.st === "open" ? "⏳ Aberto" : "⚠ Pendente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB: LIS SCORE */}
            {activeTab === "score" && (
              <div>
                <div className="intel-sec">LIS Score — breakdown por eixo</div>
                <div className="intel-stats-row">
                  <div className="intel-stat-box">
                    <div className={`intel-stat-num ${lc === "hot" ? "r" : lc === "warm" ? "y" : ""}`}>{lis}</div>
                    <div className="intel-stat-lbl">LIS Score</div>
                  </div>
                  <div className="intel-stat-box">
                    <div className="intel-stat-num y">{wfScore}/10</div>
                    <div className="intel-stat-lbl">Workflow</div>
                  </div>
                  <div className="intel-stat-box">
                    <div className="intel-stat-num g">{brl(lead.ltv_total)}</div>
                    <div className="intel-stat-lbl">LTV</div>
                  </div>
                  <div className="intel-stat-box">
                    <div className="intel-stat-num b">{lead.total_deals || 0}</div>
                    <div className="intel-stat-lbl">Deals</div>
                  </div>
                  <div className="intel-stat-box">
                    <div className="intel-stat-num">{lead.piperun_id || "—"}</div>
                    <div className="intel-stat-lbl">OppID</div>
                  </div>
                </div>
                <div className="intel-lis-bd">
                  {[
                    { label: "🔥 Sales Heat (35%)", key: "sales_heat" },
                    { label: "💰 Purchase Power (20%)", key: "purchase_power" },
                    { label: "⚙️ Technical Maturity (20%)", key: "technical_maturity" },
                    { label: "📊 Behavioral Engagement (25%)", key: "behavioral_engagement" },
                  ].map(({ label, key }) => {
                    const v = axes[key]?.value || 0;
                    const color = v >= 50 ? "var(--id-teal)" : v >= 30 ? "var(--id-acc)" : "var(--id-muted)";
                    return (
                      <div key={key} className="intel-lis-comp">
                        <div className="intel-lis-comp-label">{label}</div>
                        <div className="intel-lis-bar-wrap">
                          <div className="intel-lis-bar-fill" style={{ width: `${v}%`, background: color }} />
                        </div>
                        <div className="intel-lis-comp-val" style={{ color }}>{v}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="intel-formula-box">
                  <strong style={{ color: "var(--id-acc)" }}>Fórmula:</strong>{" "}
                  ({axes.sales_heat?.value || 0}×0.35) + ({axes.purchase_power?.value || 0}×0.20) + ({axes.technical_maturity?.value || 0}×0.20) + ({axes.behavioral_engagement?.value || 0}×0.25) ={" "}
                  <strong style={{ color: "var(--id-teal)" }}>{lis}</strong>
                  {lis < 40 && (
                    <><br /><span style={{ color: "var(--id-hot)" }}>⚠ Engajamento comportamental baixo — lead sem interações recentes</span></>
                  )}
                </div>
              </div>
            )}

            {/* TAB: EQUIPMENT */}
            {activeTab === "equipment" && (
              <div>
                <div className="intel-sec">Fluxo chairside — mapa de equipamentos</div>
                <div className="intel-flow-section">
                  <div className="intel-flow-label">🔬 Scanner Intraoral</div>
                  <div className="intel-flow-items">
                    {lead.equip_scanner && lead.status_scanner === "tem_smartdent" ? (
                      <div className="intel-fi intel-fi-owned"><div className="intel-fi-dot" />{lead.equip_scanner} — SmartDent ✓</div>
                    ) : lead.equip_scanner ? (
                      <div className="intel-fi intel-fi-none"><div className="intel-fi-dot" />{lead.equip_scanner} — concorrente</div>
                    ) : lead.status_scanner === "tem_smartdent" ? (
                      <div className="intel-fi intel-fi-owned"><div className="intel-fi-dot" />Scanner SmartDent ✓</div>
                    ) : (
                      <div className="intel-fi intel-fi-none"><div className="intel-fi-dot" />Não mapeado</div>
                    )}
                  </div>
                </div>
                <div className="intel-flow-section">
                  <div className="intel-flow-label">🖨️ Impressora 3D</div>
                  <div className="intel-flow-items">
                    {lead.impressora_modelo && lead.status_impressora === "tem_com_resina_sd" ? (
                      <div className="intel-fi intel-fi-owned"><div className="intel-fi-dot" />{lead.impressora_modelo} — com resina SD ✓</div>
                    ) : lead.impressora_modelo ? (
                      <div className="intel-fi intel-fi-none"><div className="intel-fi-dot" />{lead.impressora_modelo} — sem resina SD</div>
                    ) : lead.status_impressora ? (
                      <div className="intel-fi intel-fi-none"><div className="intel-fi-dot" />{lead.status_impressora}</div>
                    ) : (
                      <div className="intel-fi intel-fi-none"><div className="intel-fi-dot" />Não mapeado</div>
                    )}
                  </div>
                </div>
                <div className="intel-flow-section">
                  <div className="intel-flow-label">💻 Software CAD</div>
                  <div className="intel-flow-items">
                    {lead.status_cad === "tem_exocad" ? (
                      <div className="intel-fi intel-fi-owned"><div className="intel-fi-dot" />Exocad ✓</div>
                    ) : lead.status_cad === "interesse" ? (
                      <div className="intel-fi intel-fi-interest"><div className="intel-fi-dot" />Exocad — interesse</div>
                    ) : (
                      <div className="intel-fi intel-fi-none"><div className="intel-fi-dot" />CAD não mapeado</div>
                    )}
                  </div>
                </div>
                <div className="intel-gap-box">
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--id-acc)", marginBottom: 6 }}>Análise de Lacunas</div>
                  <div style={{ fontSize: 11, color: "var(--id-muted2)", lineHeight: 1.7 }}>
                    Workflow score <strong style={{ color: "var(--id-acc)" }}>{wfScore}/10</strong>.
                    {!lead.status_cad && <span style={{ color: "var(--id-hot)" }}> CAD não mapeado — lacuna principal.</span>}
                    {!lead.impressora_modelo && !lead.status_impressora && <span style={{ color: "var(--id-warm)" }}> Impressora não identificada.</span>}
                    {wfScore >= 7 && <span style={{ color: "var(--id-teal)" }}> Setup técnico avançado — foco em consumíveis e expansão.</span>}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: TIMELINE */}
            {activeTab === "timeline" && (
              <div>
                <div className="intel-sec">Timeline — eventos em tempo real</div>
                {loadingDetail && timelineEvents.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--id-muted)" }}>Carregando timeline...</p>
                ) : timelineEvents.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--id-muted)", fontStyle: "italic" }}>Nenhum evento registrado.</p>
                ) : (
                  <div style={{ maxHeight: 500, overflowY: "auto" }}>
                    {timelineEvents.map((event) => {
                      const emoji = TIMELINE_EMOJI[event.event_type] || "📌";
                      const label = TIMELINE_LABEL[event.event_type] || event.event_type.replace(/_/g, " ");
                      const isNew = Date.now() - new Date(event.event_timestamp).getTime() < 60_000;
                      return (
                        <div key={event.id} className={`intel-timeline-item ${isNew ? "is-new" : ""}`}>
                          <div className="intel-timeline-dot">{emoji}</div>
                          <div className="intel-timeline-date">{fmtDateTime(event.event_timestamp)}</div>
                          <div className="intel-timeline-label">{label}</div>
                          {event.entity_name && <div style={{ fontSize: 10, color: "var(--id-muted)" }}>{event.entity_name}</div>}
                          {event.value_numeric != null && event.value_numeric > 0 && (
                            <div style={{ fontSize: 10, color: "var(--id-teal)", fontWeight: 600 }}>{formatCurrency(event.value_numeric)}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Deals History */}
                {dealsHistory.length > 0 && (
                  <>
                    <div className="intel-sec" style={{ marginTop: 16 }}>Histórico de Deals ({dealsHistory.length})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {dealsHistory.map((deal, i) => (
                        <div key={i} className="intel-section-panel">
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 12 }}>{String(deal.product || deal.title || `Deal #${i + 1}`)}</span>
                            {deal.value != null && <span style={{ fontWeight: 700, color: "var(--id-teal)", fontSize: 12 }}>{formatCurrency(Number(deal.value))}</span>}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 10, color: "var(--id-muted)" }}>
                            {deal.date && <span>📅 {fmtDate(String(deal.date))}</span>}
                            {deal.owner_name && <span>👤 {String(deal.owner_name)}</span>}
                            {deal.status && <span className="intel-s-chip intel-sc-open">{String(deal.status)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB: CONVERSATIONS */}
            {activeTab === "conversations" && (
              <div>
                {/* LIA Conversations */}
                <div className="intel-sec">💬 Conversas LIA ({liaInteractions.length})</div>
                {liaInteractions.length === 0 ? (
                  <p style={{ fontSize: 11, color: "var(--id-muted)", fontStyle: "italic" }}>Nenhuma conversa com a LIA</p>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {liaInteractions.map((item) => (
                      <div key={item.id}>
                        <div style={{ fontSize: 10, color: "var(--id-muted)", marginBottom: 2 }}>
                          {fmtDateTime(item.created_at)}
                          {item.feedback && item.feedback !== "none" && <span className="ml-1">{item.feedback === "positive" ? " 👍" : " 👎"}</span>}
                        </div>
                        <div className="intel-msg intel-msg-user" style={{ marginBottom: 4 }}>{item.user_message}</div>
                        {item.agent_response && (
                          <div className="intel-msg intel-msg-ai">
                            {item.agent_response.length > 400 ? item.agent_response.slice(0, 400) + "…" : item.agent_response}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* WhatsApp */}
                <div className="intel-sec">📱 WhatsApp Inbox ({whatsappMsgs.length})</div>
                {whatsappMsgs.length === 0 ? (
                  <p style={{ fontSize: 11, color: "var(--id-muted)", fontStyle: "italic" }}>Nenhuma mensagem WhatsApp</p>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {whatsappMsgs.map((msg) => (
                      <div key={msg.id} className={`intel-msg ${msg.direction === "inbound" ? "intel-msg-user" : "intel-msg-ai"}`}>
                        <div style={{ fontSize: 10, color: "var(--id-muted)", marginBottom: 2 }}>
                          {fmtDateTime(msg.created_at)} · {msg.direction === "inbound" ? "⬅️ entrada" : "➡️ saída"}
                          {msg.intent_detected && <span style={{ marginLeft: 4 }}>🎯 {msg.intent_detected}</span>}
                        </div>
                        {msg.media_url && (
                          <a href={msg.media_url} target="_blank" rel="noreferrer" style={{ color: "var(--id-blue)", fontSize: 10 }}>📎 {msg.media_type || "arquivo"}</a>
                        )}
                        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{msg.message_text || "[sem texto]"}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Logs */}
                <div className="intel-sec">📨 Mensagens Sistema ({messageLogs.length})</div>
                {messageLogs.length === 0 ? (
                  <p style={{ fontSize: 11, color: "var(--id-muted)", fontStyle: "italic" }}>Nenhuma mensagem</p>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                    {messageLogs.map((msg) => (
                      <div key={msg.id} className="intel-section-panel" style={{ padding: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--id-muted)" }}>
                          <span>{fmtDateTime(msg.data_envio)}</span>
                          <span>{msg.tipo || ""} · {msg.status}</span>
                        </div>
                        <p style={{ fontSize: 11, color: "var(--id-muted2)", margin: "2px 0 0" }}>
                          {msg.mensagem_preview ? (msg.mensagem_preview.length > 200 ? msg.mensagem_preview.slice(0, 200) + "…" : msg.mensagem_preview) : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: BEHAVIORAL */}
            {activeTab === "behavioral" && (
              <div>
                {/* Product History */}
                <div className="intel-sec">🛒 Histórico de Compras ({productHistory.length})</div>
                {productHistory.length === 0 ? (
                  <p style={{ fontSize: 11, color: "var(--id-muted)", fontStyle: "italic" }}>Nenhum produto comprado</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {productHistory.map((ph) => (
                      <div key={ph.id} className="intel-section-panel" style={{ padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--id-ink)" }}>{ph.product_name || "—"}</span>
                          {ph.total_purchased_value != null && <span style={{ color: "var(--id-teal)", fontWeight: 700 }}>{formatCurrency(ph.total_purchased_value)}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--id-muted)" }}>
                          {ph.purchased_at && <span>📅 {fmtDate(ph.purchased_at)}</span>}
                          {ph.purchase_count != null && <span> · {ph.purchase_count}x compras</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cart History */}
                <div className="intel-sec">🛒 Carrinhos Abandonados ({cartHistory.filter(c => c.status === "abandoned").length})</div>
                {cartHistory.length === 0 ? (
                  <p style={{ fontSize: 11, color: "var(--id-muted)", fontStyle: "italic" }}>Nenhum carrinho</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {cartHistory.map((ch) => (
                      <div key={ch.id} className="intel-section-panel" style={{ padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, color: "var(--id-muted2)" }}>{ch.items_count || 0} itens</span>
                          {ch.total_value != null && <span style={{ color: ch.status === "abandoned" ? "var(--id-hot)" : "var(--id-teal)", fontWeight: 600 }}>{formatCurrency(ch.total_value)}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--id-muted)" }}>
                          {fmtDate(ch.created_at)} · <span className={`intel-s-chip ${ch.status === "abandoned" ? "intel-sc-miss" : "intel-sc-ok"}`}>{ch.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form Submissions */}
                <div className="intel-sec">📝 Formulários ({formSubmissions.length})</div>
                {formSubmissions.length === 0 ? (
                  <p style={{ fontSize: 11, color: "var(--id-muted)", fontStyle: "italic" }}>Nenhum formulário</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
                    {formSubmissions.map((fs) => (
                      <div key={fs.id} className="intel-detail-row">
                        <span className="intel-detail-row-label">📝 {fs.form_name || "Formulário"}</span>
                        <span className="intel-detail-row-value">
                          {fmtDate(fs.submitted_at)}
                          {fs.equipment_mentioned && <span> · 🔧 {fs.equipment_mentioned}</span>}
                          {fs.product_mentioned && <span> · 🏷️ {fs.product_mentioned}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Course Progress */}
                <div className="intel-sec">🎓 Progresso Cursos ({courseProgress.length})</div>
                {courseProgress.length === 0 ? (
                  <p style={{ fontSize: 11, color: "var(--id-muted)", fontStyle: "italic" }}>Nenhum curso</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {courseProgress.map((cp) => (
                      <div key={cp.id} className="intel-section-panel" style={{ padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--id-ink)" }}>{cp.course_name || "—"}</span>
                          <span className={`intel-s-chip ${cp.status === "completed" ? "intel-sc-ok" : "intel-sc-open"}`}>{cp.status || "—"}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "var(--id-muted)" }}>
                          {cp.progress_percent != null && <span>Progresso: {cp.progress_percent}%</span>}
                          {cp.enrolled_at && <span> · Inscrito em {fmtDate(cp.enrolled_at)}</span>}
                        </div>
                        {cp.progress_percent != null && (
                          <div className="intel-lis-bar-wrap" style={{ marginTop: 4 }}>
                            <div className="intel-lis-bar-fill" style={{ width: `${cp.progress_percent}%`, background: cp.status === "completed" ? "var(--id-teal)" : "var(--id-blue)" }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* SDR Interactions */}
                <div className="intel-sec">📞 Interações SDR ({sdrInteractions.length})</div>
                {sdrInteractions.length === 0 ? (
                  <p style={{ fontSize: 11, color: "var(--id-muted)", fontStyle: "italic" }}>Nenhuma interação SDR</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
                    {sdrInteractions.map((si) => (
                      <div key={si.id} className="intel-section-panel" style={{ padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--id-muted)" }}>
                          <span>{fmtDateTime(si.contacted_at)}</span>
                          <span>{si.channel || ""} · {si.outcome || ""}</span>
                        </div>
                        {si.notes && <p style={{ fontSize: 11, color: "var(--id-muted2)", marginTop: 4 }}>{si.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* State Events */}
                <div className="intel-sec">🔄 Transições de Estágio ({stateEvents.length})</div>
                {stateEvents.length === 0 ? (
                  <p style={{ fontSize: 11, color: "var(--id-muted)", fontStyle: "italic" }}>Nenhuma transição</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {stateEvents.map((se) => (
                      <div key={se.id} className="intel-detail-row">
                        <span className="intel-detail-row-label">
                          {se.is_regression ? "⚠️" : "➡️"} {se.from_stage || "—"} → {se.to_stage || "—"}
                        </span>
                        <span className="intel-detail-row-value">
                          {fmtDateTime(se.changed_at)}
                          {se.trigger_source && <span> · {se.trigger_source}</span>}
                          {se.is_regression && <span style={{ color: "var(--id-hot)" }}> REGRESSÃO</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: OVERVIEW (all CDP fields) */}
            {activeTab === "overview" && (
              <div>
                {/* Cognitive Analysis */}
                <div className="intel-sec">🧠 Análise Cognitiva</div>
                <div className="intel-section-panel">
                  {[
                    { label: "Estágio Cognitivo", key: "lead_stage_detected" },
                    { label: "Urgência", key: "urgency_level" },
                    { label: "Perfil Psicológico", key: "psychological_profile" },
                    { label: "Motivação Principal", key: "primary_motivation" },
                    { label: "Risco de Objeção", key: "objection_risk" },
                    { label: "Abordagem Recomendada", key: "recommended_approach" },
                    { label: "Timeline Interesse", key: "interest_timeline" },
                    { label: "Confiança", key: "confidence_score_analysis" },
                  ].map(({ label, key }) => {
                    const val = s(lead, key);
                    if (!val) return null;
                    return (
                      <div key={key} className="intel-detail-row">
                        <span className="intel-detail-row-label">{label}</span>
                        <span className="intel-detail-row-value">{val}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Resumo IA */}
                {s(lead, "resumo_historico_ia") && (
                  <div className="intel-section-panel" style={{ borderColor: "rgba(79,143,255,.2)", marginTop: 12 }}>
                    <div className="intel-section-panel-header">🧠 Resumo IA do Histórico</div>
                    <p style={{ fontSize: 12, color: "var(--id-muted2)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {s(lead, "resumo_historico_ia")}
                    </p>
                  </div>
                )}

                {/* Contato */}
                <div className="intel-sec" style={{ marginTop: 16 }}>📇 Contato</div>
                <div className="intel-section-panel">
                  {[
                    { label: "Email", val: lead.email },
                    { label: "Telefone", val: lead.telefone_normalized },
                    { label: "Cidade/UF", val: [s(lead, "cidade"), s(lead, "uf")].filter(Boolean).join(" / ") || null },
                    { label: "1º Contato", val: fmtDateTime(s(lead, "data_primeiro_contato")) !== "—" ? fmtDateTime(s(lead, "data_primeiro_contato")) : null },
                    { label: "Especialidade", val: s(lead, "especialidade") },
                    { label: "Área Atuação", val: lead.area_atuacao },
                  ].map(({ label, val }) => val && (
                    <div key={label} className="intel-detail-row">
                      <span className="intel-detail-row-label">{label}</span>
                      <span className="intel-detail-row-value">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Comercial */}
                <div className="intel-sec" style={{ marginTop: 16 }}>💼 Comercial</div>
                <div className="intel-section-panel">
                  {[
                    { label: "Status", val: lead.lead_status },
                    { label: "Produto Interesse", val: s(lead, "produto_interesse") },
                    { label: "Valor Oportunidade", val: n(lead, "valor_oportunidade") ? formatCurrency(n(lead, "valor_oportunidade")!) : null },
                    { label: "Proprietário CRM", val: s(lead, "proprietario_lead_crm") },
                    { label: "Funil CRM", val: s(lead, "funil_entrada_crm") },
                    { label: "Última Etapa", val: s(lead, "ultima_etapa_comercial") },
                    { label: "PipeRun Link", val: s(lead, "piperun_link") },
                    { label: "Motivo Perda", val: s(lead, "motivo_perda") },
                  ].map(({ label, val }) => val && (
                    <div key={label} className="intel-detail-row">
                      <span className="intel-detail-row-label">{label}</span>
                      <span className="intel-detail-row-value">
                        {label === "PipeRun Link" ? (
                          <a href={val} target="_blank" rel="noreferrer" style={{ color: "var(--id-blue)" }}>Abrir PipeRun →</a>
                        ) : val}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Loja Integrada */}
                {n(lead, "lojaintegrada_ultimo_pedido_valor") != null && (
                  <>
                    <div className="intel-sec" style={{ marginTop: 16 }}>🛒 Loja Integrada</div>
                    <div className="intel-section-panel">
                      {[
                        { label: "Último Pedido", val: s(lead, "lojaintegrada_ultimo_pedido_numero") },
                        { label: "Valor", val: n(lead, "lojaintegrada_ultimo_pedido_valor") ? formatCurrency(n(lead, "lojaintegrada_ultimo_pedido_valor")!) : null },
                        { label: "Status", val: s(lead, "lojaintegrada_ultimo_pedido_status") },
                        { label: "Data", val: fmtDate(s(lead, "lojaintegrada_ultimo_pedido_data")) !== "—" ? fmtDate(s(lead, "lojaintegrada_ultimo_pedido_data")) : null },
                        { label: "LTV E-commerce", val: n(lead, "lojaintegrada_ltv") ? formatCurrency(n(lead, "lojaintegrada_ltv")!) : null },
                        { label: "Total Pedidos Pagos", val: s(lead, "lojaintegrada_total_pedidos_pagos") },
                      ].map(({ label, val }) => val && (
                        <div key={label} className="intel-detail-row">
                          <span className="intel-detail-row-label">{label}</span>
                          <span className="intel-detail-row-value">{val}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Astron */}
                {s(lead, "astron_status") && (
                  <>
                    <div className="intel-sec" style={{ marginTop: 16 }}>🎓 Astron Academy</div>
                    <div className="intel-section-panel">
                      {[
                        { label: "Status", val: s(lead, "astron_status") },
                        { label: "Cursos Total", val: s(lead, "astron_courses_total") },
                        { label: "Cursos Completos", val: s(lead, "astron_courses_completed") },
                        { label: "Último Login", val: fmtDateTime(s(lead, "astron_last_login_at")) !== "—" ? fmtDateTime(s(lead, "astron_last_login_at")) : null },
                      ].map(({ label, val }) => val && (
                        <div key={label} className="intel-detail-row">
                          <span className="intel-detail-row-label">{label}</span>
                          <span className="intel-detail-row-value">{val}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* RAW JSON blocks */}
                <div className="intel-sec" style={{ marginTop: 16 }}>🗄️ Dados Brutos</div>
                {[
                  { label: "intelligence_score", data: lead.intelligence_score },
                  { label: "cognitive_analysis", data: lead.cognitive_analysis as unknown },
                  { label: "piperun_deals_history", data: lead.piperun_deals_history as unknown },
                ].map(({ label, data }) => {
                  if (!data || (typeof data === "object" && Object.keys(data as object).length === 0)) return null;
                  return (
                    <details key={label} style={{ marginBottom: 8 }}>
                      <summary style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--id-muted)", cursor: "pointer" }}>{label}</summary>
                      <pre style={{ fontSize: 10, background: "var(--id-s2)", padding: 8, borderRadius: 8, marginTop: 4, overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--id-muted2)" }}>
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
    if (advFilters.itemProposta !== "all") query = query.ilike("itens_proposta_crm", `%${advFilters.itemProposta}%`);
    if (advFilters.interestProduct !== "all") query = query.not(advFilters.interestProduct, "is", null);
    if (advFilters.statusCRM !== "all") query = query.eq("status_atual_lead_crm", advFilters.statusCRM);

    if (debouncedSearch) {
      query = query.or(`nome.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,telefone_normalized.ilike.%${debouncedSearch}%`);
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
                {/* Item Proposta */}
                <select className="intel-select" value={advFilters.itemProposta} onChange={(e) => setAdv("itemProposta", e.target.value)}>
                  {ITEM_PROPOSTA_OPTIONS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
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
