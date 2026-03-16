import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";

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

interface TimelineEvent { id: string; event_type: string; event_timestamp: string; entity_type: string | null; entity_name: string | null; event_data: Record<string, unknown>; source_channel: string | null; value_numeric: number | null; }
interface AgentInteraction { id: string; created_at: string; user_message: string; agent_response: string | null; feedback: string | null; }
interface WhatsAppMsg { id: string; created_at: string; message_text: string | null; direction: string; intent_detected: string | null; media_url: string | null; media_type: string | null; }
interface MsgLog { id: string; tipo: string | null; mensagem_preview: string | null; status: string; data_envio: string | null; }
interface ProductHistory { id: string; product_name: string | null; total_purchased_value: number | null; purchased_at: string | null; purchase_count: number | null; }
interface CourseProgress { id: string; course_name: string | null; status: string | null; progress_percent: number | null; enrolled_at: string | null; }
interface FormSubmission { id: string; form_name: string | null; submitted_at: string | null; equipment_mentioned: string | null; product_mentioned: string | null; }
interface CartHistory { id: string; total_value: number | null; status: string | null; created_at: string | null; items_count: number | null; }
interface SdrInteraction { id: string; contacted_at: string | null; notes: string | null; channel: string | null; outcome: string | null; }
interface StateEvent { id: string; from_stage: string | null; to_stage: string | null; changed_at: string | null; is_regression: boolean | null; trigger_source: string | null; }

// Unified timeline item
interface UnifiedEvent {
  id: string;
  timestamp: string;
  type: string;
  emoji: string;
  dotColor: string;
  title: string;
  detail: string | null;
  value: string | null;
  isNew?: boolean;
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
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
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

// ─── Build unified timeline ───
function buildUnifiedTimeline(
  timelineEvents: TimelineEvent[],
  liaInteractions: AgentInteraction[],
  whatsappMsgs: WhatsAppMsg[],
  messageLogs: MsgLog[],
  productHistory: ProductHistory[],
  courseProgress: CourseProgress[],
  formSubmissions: FormSubmission[],
  cartHistory: CartHistory[],
  sdrInteractions: SdrInteraction[],
  stateEvents: StateEvent[]
): UnifiedEvent[] {
  const items: UnifiedEvent[] = [];

  // lead_activity_log
  timelineEvents.forEach(e => {
    const EMOJI: Record<string, string> = {
      crm_deal_created: "🆕", crm_deal_updated: "🔄", crm_deal_won: "✅", crm_deal_lost: "❌",
      ecommerce_order_created: "🛒", ecommerce_order_paid: "💳", ecommerce_order_cancelled: "🚫",
      ecommerce_order_invoiced: "📦", ecommerce_order_delivered: "🚚",
      lia_conversation: "💬", form_submission: "📝", sellflux_sync: "🔗", astron_enrollment: "🎓", cognitive_analysis: "🧠",
    };
    const LABEL: Record<string, string> = {
      crm_deal_created: "Deal criado", crm_deal_updated: "Deal atualizado", crm_deal_won: "Deal ganho 🎉",
      crm_deal_lost: "Deal perdido", ecommerce_order_created: "Pedido criado", ecommerce_order_paid: "Pagamento aprovado",
      ecommerce_order_cancelled: "Pedido cancelado", ecommerce_order_invoiced: "Pedido enviado",
      ecommerce_order_delivered: "Pedido entregue",
    };
    items.push({
      id: `tl-${e.id}`, timestamp: e.event_timestamp, type: "activity",
      emoji: EMOJI[e.event_type] || "📌", dotColor: "blue",
      title: LABEL[e.event_type] || e.event_type.replace(/_/g, " "),
      detail: e.entity_name || null,
      value: e.value_numeric != null && e.value_numeric > 0 ? formatCurrency(e.value_numeric) : null,
      isNew: Date.now() - new Date(e.event_timestamp).getTime() < 60_000,
    });
  });

  // form_submissions
  formSubmissions.forEach(fs => {
    items.push({
      id: `fs-${fs.id}`, timestamp: fs.submitted_at || "", type: "form",
      emoji: "📝", dotColor: "blue",
      title: `Formulário: ${fs.form_name || "Cadastro"}`,
      detail: [fs.equipment_mentioned && `🔧 ${fs.equipment_mentioned}`, fs.product_mentioned && `🏷️ ${fs.product_mentioned}`].filter(Boolean).join(" · ") || null,
      value: null,
    });
  });

  // course_progress
  courseProgress.forEach(cp => {
    items.push({
      id: `cp-${cp.id}`, timestamp: cp.enrolled_at || "", type: "course",
      emoji: "🎓", dotColor: "yellow",
      title: `Curso: ${cp.course_name || "—"}`,
      detail: `${cp.status || "—"}${cp.progress_percent != null ? ` · ${cp.progress_percent}%` : ""}`,
      value: null,
    });
  });

  // product_history
  productHistory.forEach(ph => {
    items.push({
      id: `ph-${ph.id}`, timestamp: ph.purchased_at || "", type: "purchase",
      emoji: "🛒", dotColor: "green",
      title: `Compra: ${ph.product_name || "—"}`,
      detail: ph.purchase_count ? `${ph.purchase_count}x compras` : null,
      value: ph.total_purchased_value ? formatCurrency(ph.total_purchased_value) : null,
    });
  });

  // cart_history
  cartHistory.forEach(ch => {
    items.push({
      id: `ch-${ch.id}`, timestamp: ch.created_at || "", type: "cart",
      emoji: ch.status === "abandoned" ? "🛒❌" : "🛒", dotColor: ch.status === "abandoned" ? "warn" : "green",
      title: `Carrinho ${ch.status === "abandoned" ? "abandonado" : ch.status || ""}`,
      detail: `${ch.items_count || 0} itens`,
      value: ch.total_value ? formatCurrency(ch.total_value) : null,
    });
  });

  // sdr_interactions
  sdrInteractions.forEach(si => {
    items.push({
      id: `si-${si.id}`, timestamp: si.contacted_at || "", type: "sdr",
      emoji: "📞", dotColor: "purple",
      title: `SDR: ${si.channel || "contato"} · ${si.outcome || ""}`,
      detail: si.notes || null, value: null,
    });
  });

  // state_events
  stateEvents.forEach(se => {
    items.push({
      id: `se-${se.id}`, timestamp: se.changed_at || "", type: "stage",
      emoji: se.is_regression ? "⚠️" : "🔄",
      dotColor: se.is_regression ? "hot" : "cold",
      title: `${se.from_stage || "—"} → ${se.to_stage || "—"}`,
      detail: [se.trigger_source, se.is_regression ? "REGRESSÃO" : null].filter(Boolean).join(" · ") || null,
      value: null,
    });
  });

  // message_logs
  messageLogs.forEach(ml => {
    items.push({
      id: `ml-${ml.id}`, timestamp: ml.data_envio || "", type: "message",
      emoji: "📨", dotColor: "blue",
      title: `${ml.tipo || "Mensagem"} · ${ml.status}`,
      detail: ml.mensagem_preview ? (ml.mensagem_preview.length > 120 ? ml.mensagem_preview.slice(0, 120) + "…" : ml.mensagem_preview) : null,
      value: null,
    });
  });

  // agent_interactions (LIA)
  liaInteractions.forEach(ai => {
    items.push({
      id: `ai-${ai.id}`, timestamp: ai.created_at, type: "lia",
      emoji: "💬", dotColor: "blue",
      title: `LIA: ${ai.user_message.length > 60 ? ai.user_message.slice(0, 60) + "…" : ai.user_message}`,
      detail: ai.agent_response ? (ai.agent_response.length > 100 ? ai.agent_response.slice(0, 100) + "…" : ai.agent_response) : null,
      value: null,
    });
  });

  // whatsapp_inbox
  whatsappMsgs.forEach(wa => {
    items.push({
      id: `wa-${wa.id}`, timestamp: wa.created_at, type: "whatsapp",
      emoji: wa.direction === "inbound" ? "📱" : "📤",
      dotColor: wa.direction === "inbound" ? "green" : "blue",
      title: `WhatsApp ${wa.direction === "inbound" ? "⬅️" : "➡️"} ${wa.intent_detected ? `🎯 ${wa.intent_detected}` : ""}`,
      detail: wa.message_text ? (wa.message_text.length > 120 ? wa.message_text.slice(0, 120) + "…" : wa.message_text) : "[sem texto]",
      value: null,
    });
  });

  // Sort desc by timestamp
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items;
}

// ─── DETAIL PANEL ───
export function LeadDetailPanel({ lead, onClose }: { lead: LeadFull; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState("history");
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

  // IA tabs state
  const [cognitiveResult, setCognitiveResult] = useState("");
  const [cognitiveLoading, setCognitiveLoading] = useState(false);
  const [upsellResult, setUpsellResult] = useState("");
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [actionsResult, setActionsResult] = useState("");
  const [actionsLoading, setActionsLoading] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Timeline display limit
  const [timelineLimit, setTimelineLimit] = useState(100);

  // Merge state
  const [mergeInfo, setMergeInfo] = useState<{ count: number; sources: string[] } | null>(null);
  const [mergeRunning, setMergeRunning] = useState(false);

  // Reset on lead change
  useEffect(() => {
    setCognitiveResult(""); setUpsellResult(""); setActionsResult("");
    setChatMessages([]); setChatInput(""); setTimelineLimit(100);
    setMergeInfo(null);
  }, [lead?.id]);

  // Auto-trigger AI tabs when activated
  useEffect(() => {
    if (activeTab === "cognitive" && !cognitiveResult && !cognitiveLoading) {
      callCopilotForTab("cognitive");
    }
    if (activeTab === "upsell" && !upsellResult && !upsellLoading) {
      callCopilotForTab("upsell");
    }
    if (activeTab === "actions" && !actionsResult && !actionsLoading) {
      callCopilotForTab("actions");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Auto-detect and merge duplicates
  useEffect(() => {
    if (!lead?.id || mergeRunning) return;
    const detectAndMerge = async () => {
      try {
        // Find duplicates by empresa_piperun_id, pessoa_piperun_id, or email domain
        const conditions: string[] = [];
        if (lead.empresa_piperun_id) conditions.push(`empresa_piperun_id.eq.${lead.empresa_piperun_id}`);
        if (lead.pessoa_piperun_id) conditions.push(`pessoa_piperun_id.eq.${lead.pessoa_piperun_id}`);
        const emailDomain = lead.email?.split("@")[1];
        if (emailDomain && !emailDomain.includes("placeholder") && !["gmail.com", "hotmail.com", "outlook.com", "yahoo.com"].includes(emailDomain)) {
          conditions.push(`email.ilike.%@${emailDomain}`);
        }
        if (conditions.length === 0) return;

        const { data: dupes } = await supabase
          .from("lia_attendances")
          .select("id, nome, email, ltv_total, total_deals, piperun_id, created_at")
          .or(conditions.join(","))
          .neq("id", lead.id)
          .limit(20);

        if (!dupes || dupes.length === 0) return;

        // Auto-merge: call edge function
        setMergeRunning(true);
        const { data: mergeResult, error } = await supabase.functions.invoke("smart-ops-merge-leads", {
          body: { primary_id: lead.id, secondary_ids: dupes.map(d => d.id) },
        });

        if (!error) {
          setMergeInfo({
            count: dupes.length + 1,
            sources: dupes.map(d => d.nome || d.email || "—"),
          });
        }
      } catch {
        // Silent fail for merge
      } finally {
        setMergeRunning(false);
      }
    };
    detectAndMerge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  // Load all related data
  useEffect(() => {
    if (!lead?.id) return;
    setLoadingDetail(true);
    const promises = [
      supabase.from("lead_activity_log").select("id, event_type, event_timestamp, entity_type, entity_name, event_data, source_channel, value_numeric").eq("lead_id", lead.id).order("event_timestamp", { ascending: false }).limit(200),
      supabase.from("agent_interactions").select("id, created_at, user_message, agent_response, feedback").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("whatsapp_inbox").select("id, created_at, message_text, direction, intent_detected, media_url, media_type").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("message_logs").select("id, tipo, mensagem_preview, status, data_envio").eq("lead_id", lead.id).order("data_envio", { ascending: false }).limit(50),
      supabase.from("lead_product_history").select("id, product_name, total_purchased_value, purchased_at, purchase_count").eq("lead_id", lead.id).order("purchased_at", { ascending: false }).limit(50),
      supabase.from("lead_course_progress").select("id, course_name, status, progress_percent, enrolled_at").eq("lead_id", lead.id).order("enrolled_at", { ascending: false }).limit(50),
      supabase.from("lead_form_submissions").select("id, form_name, submitted_at, equipment_mentioned, product_mentioned").eq("lead_id", lead.id).order("submitted_at", { ascending: false }).limit(50),
      supabase.from("lead_cart_history").select("id, total_value, status, created_at, items_count").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("lead_sdr_interactions").select("id, contacted_at, notes, channel, outcome").eq("lead_id", lead.id).order("contacted_at", { ascending: false }).limit(50),
      supabase.from("lead_state_events").select("id, from_stage, to_stage, changed_at, is_regression, trigger_source").eq("lead_id", lead.id).order("changed_at", { ascending: false }).limit(50),
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

    const channel = supabase
      .channel(`timeline-${lead.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lead_activity_log", filter: `lead_id=eq.${lead.id}` },
        (payload) => setTimelineEvents(prev => [payload.new as TimelineEvent, ...prev])
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
  const dealsHistory = Array.isArray(lead.piperun_deals_history) ? lead.piperun_deals_history as Record<string, unknown>[] : [];

  // Unified timeline
  const unifiedTimeline = useMemo(() =>
    buildUnifiedTimeline(timelineEvents, liaInteractions, whatsappMsgs, messageLogs, productHistory, courseProgress, formSubmissions, cartHistory, sdrInteractions, stateEvents),
    [timelineEvents, liaInteractions, whatsappMsgs, messageLogs, productHistory, courseProgress, formSubmissions, cartHistory, sdrInteractions, stateEvents]
  );

  // Stats computation from deals history
  const stats = useMemo(() => {
    let totalUnits = 0, biggestDeal = 0, totalValue = 0;
    dealsHistory.forEach(d => {
      const v = Number(d.value || d.value_total || 0);
      const qty = Number(d.quantity || (Array.isArray(d.items) ? (d.items as unknown[]).length : 1));
      totalValue += v;
      totalUnits += qty;
      if (v > biggestDeal) biggestDeal = v;
    });
    const avgTicket = dealsHistory.length > 0 ? totalValue / dealsHistory.length : 0;
    // Repurchase cycle: avg days between deals
    const dates = dealsHistory.map(d => new Date(String(d.date || d.created_at || "")).getTime()).filter(t => t > 0).sort();
    let avgCycle = 0;
    if (dates.length > 1) {
      let totalDays = 0;
      for (let i = 1; i < dates.length; i++) totalDays += (dates[i] - dates[i - 1]) / 86400000;
      avgCycle = Math.round(totalDays / (dates.length - 1));
    }
    return { totalUnits, biggestDeal, avgTicket, avgCycle };
  }, [dealsHistory]);

  // Build lead context string for AI calls
  const buildLeadContext = useCallback(() => {
    const fields = [
      `Nome: ${lead.nome}`, `Email: ${lead.email}`, `Telefone: ${lead.telefone_normalized || "—"}`,
      `Buyer Type: ${bt || "—"}`, `Área: ${lead.area_atuacao || "—"}`, `Empresa: ${lead.empresa_nome || "—"}`,
      `Status: ${lead.lead_status}`, `LTV: ${brl(lead.ltv_total)}`, `Deals: ${lead.total_deals || 0}`,
      `LIS Score: ${lis}`, `Workflow: ${wfScore}/10`,
      `Scanner: ${lead.equip_scanner || "—"} (${lead.status_scanner || "—"})`,
      `Impressora: ${lead.impressora_modelo || "—"} (${lead.status_impressora || "—"})`,
      `CAD: ${lead.status_cad || "—"}`,
      `Pipeline: ${lead.piperun_pipeline_name || "—"} / ${lead.piperun_stage_name || "—"}`,
      s(lead, "urgency_level") ? `Urgência: ${s(lead, "urgency_level")}` : null,
      s(lead, "psychological_profile") ? `Perfil: ${s(lead, "psychological_profile")}` : null,
      s(lead, "recommended_approach") ? `Abordagem: ${s(lead, "recommended_approach")}` : null,
      s(lead, "resumo_historico_ia") ? `Resumo IA: ${s(lead, "resumo_historico_ia")}` : null,
      s(lead, "produto_interesse") ? `Produto Interesse: ${s(lead, "produto_interesse")}` : null,
      dealsHistory.length > 0 ? `Deals History (JSON): ${JSON.stringify(dealsHistory.slice(0, 15))}` : null,
      productHistory.length > 0 ? `Produtos Comprados: ${productHistory.map(p => `${p.product_name} (${p.purchase_count}x, ${brl(p.total_purchased_value)})`).join(", ")}` : null,
      courseProgress.length > 0 ? `Cursos: ${courseProgress.map(c => `${c.course_name} ${c.status} ${c.progress_percent || 0}%`).join(", ")}` : null,
      cartHistory.filter(c => c.status === "abandoned").length > 0 ? `Carrinhos Abandonados: ${cartHistory.filter(c => c.status === "abandoned").length}` : null,
    ].filter(Boolean).join("\n");
    return fields;
  }, [lead, lis, wfScore, bt, dealsHistory, productHistory, courseProgress, cartHistory]);

  const callCopilotForTab = useCallback(async (tab: "cognitive" | "upsell" | "actions") => {
    const setLoading = tab === "cognitive" ? setCognitiveLoading : tab === "upsell" ? setUpsellLoading : setActionsLoading;
    const setResult = tab === "cognitive" ? setCognitiveResult : tab === "upsell" ? setUpsellResult : setActionsResult;
    setLoading(true); setResult("");

    const prompts: Record<string, string> = {
      cognitive: `Faça uma análise cognitiva completa deste lead para uso do vendedor. Estruture em EXATAMENTE 6 seções com headers markdown (##):
## 🎯 Perfil de Compra Identificado
## 📈 Padrão de Escalada Documentado
## 💳 Perfil de Crédito e Confiança
## ⚠️ Riscos e Alertas
## 💡 Abordagem Recomendada
## 🧩 Oportunidades de Expansão

Use dados concretos, números e padrões observados. Inclua tags/badges relevantes ao final de cada seção. Seja direto e acionável.`,
      upsell: `Analise este lead e gere previsões de recompra/upsell. Estruture em markdown:
## 🔮 Previsão de Recompra — Motor Preditivo IA
Para cada oportunidade identificada, crie um bloco com:
- **Probabilidade** (🔴 >70%, 🟡 40-70%, ⚪ <40%)
- **Produto** e descrição
- **Valor estimado** (range)
- **Janela temporal**
- **Justificativa** baseada em dados

Depois adicione:
## 📊 Projeção LTV
Tabela com: LTV Atual, +12m, +24m, Com Equipamentos

## 🔍 Gap do Fluxo — Oportunidades Não Exploradas
Tags com oportunidades não aproveitadas`,
      actions: `Analise este lead e gere ações recomendadas priorizadas. Estruture em markdown:
## ⚡ Ações Recomendadas — Priorizadas por IA
### 🔴 HOJE
Ação imediata mais importante com script de abordagem em citação

### 🟡 ESTA SEMANA
Ações de curto prazo

### 🔵 30 DIAS
Ações de médio prazo

### ⚪ 60-90 DIAS
Ações de longo prazo

Para cada ação: emoji, título, descrição curta, e se aplicável um script de abordagem em blockquote. Baseie em dados reais do lead.`,
    };

    try {
      const { data, error } = await supabase.functions.invoke("smart-ops-copilot", {
        body: {
          message: `${prompts[tab]}\n\n--- DADOS COMPLETOS DO LEAD ---\n${buildLeadContext()}`,
          context: { source: `${tab}_tab`, lead_id: lead.id, action: tab },
        },
      });
      if (error) throw error;
      setResult(data?.response || data?.message || "Sem resposta da IA.");
    } catch (err: unknown) {
      setResult(`❌ Erro: ${err instanceof Error ? err.message : "Desconhecido"}`);
    } finally {
      setLoading(false);
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
      const systemCtx = `Você é a LIA (Lead Intelligence Assistant). Responda sobre o lead abaixo com dados concretos e markdown.\n\n--- DADOS ---\n${buildLeadContext()}`;
      const { data, error } = await supabase.functions.invoke("smart-ops-copilot", {
        body: { message: msg, context: { source: "chat_tab", lead_id: lead.id, system_override: systemCtx, history: allMsgs.slice(-10) } },
      });
      if (error) throw error;
      setChatMessages(prev => [...prev, { role: "assistant", content: data?.response || data?.message || "Sem resposta." }]);
    } catch (err: unknown) {
      setChatMessages(prev => [...prev, { role: "assistant", content: `❌ Erro: ${err instanceof Error ? err.message : "Desconhecido"}` }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [chatInput, chatLoading, chatMessages, buildLeadContext, lead.id]);

  const tabs = [
    { key: "history", label: "📋 Histórico" },
    { key: "cognitive", label: "🧠 Cognitiva" },
    { key: "upsell", label: "🚀 Upsell" },
    { key: "flow", label: "🔄 Fluxo" },
    { key: "lis", label: "📊 LIS" },
    { key: "actions", label: "⚡ Ações" },
    { key: "chat", label: "💬 IA" },
  ];

  const dotColorMap: Record<string, string> = {
    blue: "var(--id-blue)", green: "var(--id-teal)", yellow: "var(--id-acc)",
    purple: "var(--id-purple)", hot: "var(--id-hot)", warn: "var(--id-warm)", cold: "var(--id-muted)",
  };

  return (
    <div className="intel-detail">
      <div className="intel-card-inner">
        <button className="intel-btn mb-3 lg:hidden" onClick={onClose}><X size={14} /> Voltar</button>

        {/* HERO */}
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
              {s(lead, "cidade") && <span className="intel-meta">🏙 <strong>{s(lead, "cidade")}{s(lead, "uf") ? `, ${s(lead, "uf")}` : ""}</strong></span>}
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
            {tabs.map(tab => (
              <div key={tab.key} className={`intel-tab ${activeTab === tab.key ? "active" : ""}`} onClick={() => setActiveTab(tab.key)}>
                {tab.label}
              </div>
            ))}
          </div>
          <div className="intel-tab-body">

            {/* ═══ TAB 1: HISTÓRICO COMPLETO ═══ */}
            {activeTab === "history" && (
              <div>
                {/* Stats Row */}
                <div className="intel-sec">Resumo Financeiro</div>
                <div className="intel-stats-row" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
                  {[
                    { label: "LTV Total", val: brl(lead.ltv_total), cls: "g" },
                    { label: "Deals", val: String(lead.total_deals || 0), cls: "b" },
                    { label: "Unidades", val: String(stats.totalUnits), cls: "" },
                    { label: "Ticket Médio", val: stats.avgTicket > 0 ? brl(stats.avgTicket) : "—", cls: "y" },
                    { label: "Maior Compra", val: stats.biggestDeal > 0 ? brl(stats.biggestDeal) : "—", cls: "r" },
                    { label: "Ciclo Recompra", val: stats.avgCycle > 0 ? `${stats.avgCycle}d` : "—", cls: "" },
                  ].map((s, i) => (
                    <div key={i} className="intel-stat-box">
                      <div className={`intel-stat-num ${s.cls}`}>{s.val}</div>
                      <div className="intel-stat-lbl">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Deal Table */}
                {dealsHistory.length > 0 && (
                  <>
                    <div className="intel-sec">Histórico de Deals ({dealsHistory.length})</div>
                    <div className="intel-deal-table-wrap">
                      <table className="intel-deal-table">
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Produto</th>
                            <th>Qtd</th>
                            <th>Frete</th>
                            <th>Parcelas</th>
                            <th>Total</th>
                            <th>Vendedor</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dealsHistory.map((deal, i) => {
                            const rawItems = deal.items;
                            const items = Array.isArray(rawItems) ? rawItems as Record<string, unknown>[] : [];
                            const productName = items.length > 0
                              ? items.map(it => String(it.name || it.product_name || "")).filter(Boolean).join(", ")
                              : String(deal.product || deal.title || `Deal #${i + 1}`);
                            const qty = items.length > 0
                              ? items.reduce((sum, it) => sum + Number(it.quantity || it.qty || 1), 0)
                              : Number(deal.quantity || 1);
                            return (
                              <tr key={i}>
                                <td>{fmtDate(String(deal.date || deal.created_at || ""))}</td>
                                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {productName}
                                </td>
                                <td>{qty}</td>
                                <td>{String(deal.freight_type || deal.tipo_frete || "—")}</td>
                                <td>{String(deal.payment_installments || deal.installments || "—")}x</td>
                                <td style={{ color: "var(--id-teal)", fontWeight: 600 }}>
                                  {deal.value != null ? formatCurrency(Number(deal.value)) : deal.value_total != null ? formatCurrency(Number(deal.value_total)) : "—"}
                                </td>
                                <td>{String(deal.owner_name || "—")}</td>
                                <td>
                                  <span className={`intel-s-chip ${deal.status === "won" || deal.status === "ganha" ? "intel-sc-ok" : deal.status === "lost" || deal.status === "perdida" ? "intel-sc-miss" : "intel-sc-open"}`}>
                                    {String(deal.status || "—")}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Unified Timeline */}
                <div className="intel-sec" style={{ marginTop: 16 }}>
                  Timeline Unificada ({unifiedTimeline.length} eventos)
                </div>
                {loadingDetail && unifiedTimeline.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--id-muted)" }}>Carregando...</p>
                ) : unifiedTimeline.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--id-muted)", fontStyle: "italic" }}>Nenhum evento registrado.</p>
                ) : (
                  <>
                    <div style={{ maxHeight: 500, overflowY: "auto" }}>
                      {unifiedTimeline.slice(0, timelineLimit).map(event => (
                        <div key={event.id} className={`intel-timeline-item ${event.isNew ? "is-new" : ""}`}
                          style={{ borderLeftColor: dotColorMap[event.dotColor] || "var(--id-b1)" }}>
                          <div className="intel-timeline-dot" style={{ background: dotColorMap[event.dotColor], borderColor: dotColorMap[event.dotColor] }}>
                            <span style={{ fontSize: 7 }}>{event.emoji}</span>
                          </div>
                          <div className="intel-timeline-date">{fmtDateTime(event.timestamp)}</div>
                          <div className="intel-timeline-label">{event.title}</div>
                          {event.detail && <div style={{ fontSize: 10, color: "var(--id-muted)", lineHeight: 1.5 }}>{event.detail}</div>}
                          {event.value && <div style={{ fontSize: 10, color: "var(--id-teal)", fontWeight: 600 }}>{event.value}</div>}
                        </div>
                      ))}
                    </div>
                    {unifiedTimeline.length > timelineLimit && (
                      <button className="intel-btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => setTimelineLimit(l => l + 100)}>
                        Carregar mais ({unifiedTimeline.length - timelineLimit} restantes)
                      </button>
                    )}
                  </>
                )}

                {/* Identity Graph (compacted) */}
                <div className="intel-sec" style={{ marginTop: 16 }}>Identity Graph</div>
                <div className="intel-ig-section">
                  <div className="intel-ig-grid">
                    <div className="intel-ig-node" style={{ borderColor: "rgba(79,143,255,.3)" }}>
                      <div className="intel-ig-node-label">📊 lia_attendances</div>
                      <div className="intel-ig-node-name">{lead.nome}</div>
                      <div className="intel-ig-hash ok" onClick={() => copyHash(lead.id)}>{shortHash(lead.id)}</div>
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
                      {personLinked ? <div className="intel-ig-hash ok" onClick={() => copyHash(lead.person_id)}>{shortHash(lead.person_id)}</div>
                        : <div className="intel-ig-hash miss">Não vinculado</div>}
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
                      {companyLinked ? <div className="intel-ig-hash ok" onClick={() => copyHash(lead.company_id)}>{shortHash(lead.company_id)}</div>
                        : <div className="intel-ig-hash miss">Não vinculado</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ TAB 2: ANÁLISE COGNITIVA ═══ */}
            {activeTab === "cognitive" && (
              <div>
                <div className="intel-sec">🧠 Análise Cognitiva — gerada por IA</div>
                <div className="intel-ai-panel">
                  <div className="intel-ai-header">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--id-purple)" }}>🧠 Copilot IA</span>
                    <button className="intel-btn" onClick={() => callCopilotForTab("cognitive")} disabled={cognitiveLoading}>
                      <RefreshCw size={12} className={cognitiveLoading ? "animate-spin" : ""} /> Reanalisar
                    </button>
                  </div>
                  <div className="intel-ai-result">
                    {cognitiveLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--id-blue)" }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span style={{ fontSize: 12 }}>Gerando análise cognitiva...</span>
                      </div>
                    ) : cognitiveResult ? (
                      <div className="intel-ai-md prose prose-sm"><ReactMarkdown>{cognitiveResult}</ReactMarkdown></div>
                    ) : (
                      <div style={{ textAlign: "center", padding: 20, color: "var(--id-muted)" }}>
                        <p style={{ fontSize: 12 }}>Clique em "Reanalisar" para gerar análise cognitiva ao vivo com IA</p>
                        {/* Show existing cognitive data if available */}
                        {s(lead, "resumo_historico_ia") && (
                          <div style={{ textAlign: "left", marginTop: 16 }}>
                            <div className="intel-ai-md prose prose-sm">
                              <h3>📋 Resumo IA Existente</h3>
                              <p>{s(lead, "resumo_historico_ia")}</p>
                            </div>
                          </div>
                        )}
                        {/* Show existing fields */}
                        <div style={{ textAlign: "left", marginTop: 12 }}>
                          {[
                            { label: "Estágio Cognitivo", key: "lead_stage_detected" },
                            { label: "Urgência", key: "urgency_level" },
                            { label: "Perfil Psicológico", key: "psychological_profile" },
                            { label: "Motivação Principal", key: "primary_motivation" },
                            { label: "Risco de Objeção", key: "objection_risk" },
                            { label: "Abordagem Recomendada", key: "recommended_approach" },
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
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ TAB 3: UPSELL & PREVISÃO ═══ */}
            {activeTab === "upsell" && (
              <div>
                <div className="intel-sec">🚀 Upsell & Previsão — Motor Preditivo IA</div>
                <div className="intel-ai-panel">
                  <div className="intel-ai-header">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--id-teal)" }}>🚀 Motor Preditivo</span>
                    <button className="intel-btn" onClick={() => callCopilotForTab("upsell")} disabled={upsellLoading}>
                      <RefreshCw size={12} className={upsellLoading ? "animate-spin" : ""} /> Gerar Previsão
                    </button>
                  </div>
                  <div className="intel-ai-result">
                    {upsellLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--id-teal)" }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span style={{ fontSize: 12 }}>Analisando padrões de compra...</span>
                      </div>
                    ) : upsellResult ? (
                      <div className="intel-ai-md prose prose-sm"><ReactMarkdown>{upsellResult}</ReactMarkdown></div>
                    ) : (
                      <div style={{ textAlign: "center", padding: 20, color: "var(--id-muted)" }}>
                        <p style={{ fontSize: 12 }}>Clique em "Gerar Previsão" para analisar oportunidades de upsell e previsão de recompra</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ TAB 4: FLUXO DIGITAL ═══ */}
            {activeTab === "flow" && (
              <div>
                <div className="intel-sec">Fluxo Digital — mapa de equipamentos</div>
                {/* Equipment flow */}
                {[
                  {
                    label: "🔬 Scanner Intraoral",
                    owned: lead.status_scanner === "tem_smartdent",
                    name: lead.equip_scanner,
                    detail: lead.status_scanner === "tem_smartdent" ? "SmartDent ✓" : lead.equip_scanner ? "concorrente" : lead.status_scanner || "Não mapeado",
                  },
                  {
                    label: "🖨️ Impressora 3D",
                    owned: lead.status_impressora === "tem_com_resina_sd",
                    name: lead.impressora_modelo,
                    detail: lead.status_impressora === "tem_com_resina_sd" ? "com resina SD ✓" : lead.impressora_modelo ? "sem resina SD" : lead.status_impressora || "Não mapeado",
                  },
                  {
                    label: "💻 Software CAD",
                    owned: lead.status_cad === "tem_exocad",
                    name: lead.status_cad === "tem_exocad" ? "Exocad" : null,
                    detail: lead.status_cad === "tem_exocad" ? "Exocad ✓" : lead.status_cad === "interesse" ? "interesse" : "não mapeado",
                  },
                ].map((eq, i) => (
                  <div key={i} className="intel-flow-section">
                    <div className="intel-flow-label">{eq.label}</div>
                    <div className="intel-flow-items">
                      <div className={`intel-fi ${eq.owned ? "intel-fi-owned" : eq.name ? "intel-fi-interest" : "intel-fi-none"}`}>
                        <div className="intel-fi-dot" />
                        {eq.name ? `${eq.name} — ${eq.detail}` : eq.detail}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Product history enrichment */}
                {productHistory.length > 0 && (
                  <>
                    <div className="intel-sec" style={{ marginTop: 14 }}>Produtos Comprados (e-commerce)</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {productHistory.map(ph => (
                        <div key={ph.id} className="intel-section-panel" style={{ padding: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{ph.product_name || "—"}</span>
                            {ph.total_purchased_value != null && <span style={{ color: "var(--id-teal)", fontWeight: 700 }}>{formatCurrency(ph.total_purchased_value)}</span>}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--id-muted)" }}>
                            {ph.purchased_at && <span>📅 {fmtDate(ph.purchased_at)}</span>}
                            {ph.purchase_count != null && <span> · {ph.purchase_count}x compras</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Gap Analysis */}
                <div className="intel-gap-box" style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--id-acc)", marginBottom: 6 }}>Gap do Fluxo — Oportunidades Não Exploradas</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {!lead.status_scanner && <span className="intel-s-chip intel-sc-miss">🔬 Scanner</span>}
                    {!lead.status_cad && <span className="intel-s-chip intel-sc-miss">💻 CAD</span>}
                    {!lead.impressora_modelo && !lead.status_impressora && <span className="intel-s-chip intel-sc-open">🖨️ Impressora</span>}
                    {courseProgress.length === 0 && <span className="intel-s-chip intel-sc-open">📚 Cursos</span>}
                    {wfScore >= 7 && <span className="intel-s-chip intel-sc-ok">✅ Setup Avançado</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--id-muted2)", lineHeight: 1.7 }}>
                    Workflow score <strong style={{ color: "var(--id-acc)" }}>{wfScore}/10</strong>.
                    {wfScore < 5 && <span style={{ color: "var(--id-hot)" }}> Setup técnico incompleto — múltiplas oportunidades de expansão.</span>}
                    {wfScore >= 7 && <span style={{ color: "var(--id-teal)" }}> Setup avançado — foco em consumíveis e expansão.</span>}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ TAB 5: LIS BREAKDOWN ═══ */}
            {activeTab === "lis" && (
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
                </div>

                {/* Score History from state events */}
                {stateEvents.length > 0 && (
                  <>
                    <div className="intel-sec" style={{ marginTop: 16 }}>Histórico de Transições ({stateEvents.length})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {stateEvents.map(se => (
                        <div key={se.id} className="intel-detail-row">
                          <span className="intel-detail-row-label">
                            {se.is_regression ? "⚠️" : "➡️"} {se.from_stage || "—"} → {se.to_stage || "—"}
                          </span>
                          <span className="intel-detail-row-value">
                            {fmtDateTime(se.changed_at)}
                            {se.is_regression && <span style={{ color: "var(--id-hot)" }}> REGRESSÃO</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══ TAB 6: AÇÕES RECOMENDADAS ═══ */}
            {activeTab === "actions" && (
              <div>
                <div className="intel-sec">⚡ Ações Recomendadas — Priorizadas por IA</div>
                <div className="intel-ai-panel">
                  <div className="intel-ai-header">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--id-acc)" }}>⚡ Ações Priorizadas</span>
                    <button className="intel-btn" onClick={() => callCopilotForTab("actions")} disabled={actionsLoading}>
                      <RefreshCw size={12} className={actionsLoading ? "animate-spin" : ""} /> Gerar Ações
                    </button>
                  </div>
                  <div className="intel-ai-result">
                    {actionsLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--id-acc)" }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span style={{ fontSize: 12 }}>Gerando ações recomendadas...</span>
                      </div>
                    ) : actionsResult ? (
                      <div className="intel-ai-md prose prose-sm"><ReactMarkdown>{actionsResult}</ReactMarkdown></div>
                    ) : (
                      <div style={{ textAlign: "center", padding: 20, color: "var(--id-muted)" }}>
                        <p style={{ fontSize: 12 }}>Clique em "Gerar Ações" para criar uma lista priorizada de ações com scripts de abordagem</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ TAB 7: CHAT IA ═══ */}
            {activeTab === "chat" && (
              <div>
                <div className="intel-sec">💬 Perguntar à IA — conversa contextual</div>
                <div className="intel-chat-wrap">
                  <div className="intel-chat-messages">
                    {chatMessages.length === 0 && (
                      <div style={{ textAlign: "center", padding: "30px 20px" }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
                        <p style={{ fontSize: 12, color: "var(--id-muted)", lineHeight: 1.7 }}>
                          Converse com a LIA sobre este lead.<br />
                          Pergunte sobre perfil, histórico, estratégias ou qualquer dado.
                        </p>
                        <div className="intel-chat-quick-asks">
                          {[
                            "Qual o perfil deste lead?",
                            "Quais produtos recomendar?",
                            "Histórico de compras",
                            "Risco de churn?",
                            "Script de abordagem",
                            "Estratégia de reativação",
                          ].map(q => (
                            <button key={q} className="intel-chat-qa" onClick={() => setChatInput(q)}>{q}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`intel-msg ${msg.role === "user" ? "intel-msg-user" : "intel-msg-ai"}`}>
                        {msg.role === "assistant" ? (
                          <div className="intel-ai-md prose prose-sm"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                        ) : msg.content}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="intel-msg intel-msg-ai" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Loader2 size={14} className="animate-spin" style={{ color: "var(--id-blue)" }} />
                        <span style={{ fontSize: 11, color: "var(--id-muted)" }}>LIA pensando...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="intel-chat-input-wrap">
                    <input
                      className="intel-chat-input"
                      placeholder="Pergunte sobre este lead..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChatMessage()}
                      disabled={chatLoading}
                    />
                    <button className="intel-chat-send" onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}>
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
