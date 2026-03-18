import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import { WorkflowPortfolio, type Portfolio } from "./WorkflowPortfolio";

// ─── Constants ───
const API_BASE = "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1";

// ─── Types ───
interface SupportTicket {
  id: string;
  ticket_full_id: string;
  equipment: string | null;
  client_summary: string | null;
  ai_summary: string | null;
  status: "open" | "resolved" | "pending";
  created_at: string;
  resolved_at: string | null;
  n_messages: number;
  resolution_hours: number | null;
  open_hours: number | null;
  last_message: { sender: string; message: string; created_at: string } | null;
  messages_preview: { sender: string; message: string; created_at: string }[];
}

interface SupportSummary {
  total: number;
  open: number;
  resolved: number;
  avg_resolution_hours: number | null;
}

interface Opportunity {
  opportunity_type: string;
  product_name: string;
  recommended_action: string;
  recommended_message: string | null;
  competitor_product: string | null;
  priority: string;
  score: number;
  value_est_brl: number;
}

interface ActivityLogEvent {
  id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  event_data: Record<string, any> | null;
  source_channel: string | null;
  value_numeric: number | null;
  event_timestamp: string;
  created_at: string;
}

interface DetailResponse {
  lead: Record<string, any>;
  person: Record<string, any> | null;
  company: Record<string, any> | null;
  opportunities: Opportunity[];
  portfolio: Portfolio | null;
  portfolio_embed_url: string | null;
  support_tickets: SupportTicket[];
  support_summary: SupportSummary | null;
  activity_log: ActivityLogEvent[];
}

type TabKey = "historico" | "cognitivo" | "upsell" | "fluxo" | "lis" | "acoes";

const TABS: { key: TabKey; label: string }[] = [
  { key: "historico", label: "📋 Histórico Completo" },
  { key: "cognitivo", label: "🧠 Análise Cognitiva IA" },
  { key: "upsell", label: "🚀 Upsell & Previsão" },
  { key: "fluxo", label: "🔄 Fluxo Digital" },
  { key: "lis", label: "📊 LIS Breakdown" },
  { key: "acoes", label: "⚡ Ações Recomendadas" },
];

// ─── Helpers ───
const formatBRL = (val: any): string => {
  const n = Number(val) || 0;
  if (n >= 1_000_000) return `R$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$${(n / 1_000).toFixed(0)}k`;
  return `R$${n.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
};

const formatBRLFull = (val: any): string => {
  const n = Number(val) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatDate = (dt: string | null | undefined): string => {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const avgTicket = (lead: any): number => {
  if (!lead.ltv_total || !lead.total_deals) return 0;
  return Number(lead.ltv_total) / lead.total_deals;
};

const ownerDisplay = (name: string | null): string => {
  if (!name) return "—";
  return /^\d+$/.test(name) ? "Vendedor" : name;
};

const initials = (nome: string): string => {
  const parts = (nome || "").trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ─── Tag labels ───
const TAG_LABELS: Record<string, string> = {
  LIA_LEAD_ATIVADO: "Reativado via LIA",
  A_HANDOFF_LIA: "Handoff para vendedor",
  EC_INICIOU_CHECKOUT: "Iniciou checkout e-commerce",
  EC_PROD_RESINA: "Interesse em resina (e-com)",
  COMPROU_SCANNER: "Comprou scanner SmartDent",
  C_PRIMEIRO_CONTATO: "Primeiro contato registrado",
  C_RECUPERADO: "Lead recuperado",
};
const TAG_DESCS: Record<string, string> = {
  LIA_LEAD_ATIVADO: "Lead reativado pelo chatbot LIA",
  A_HANDOFF_LIA: "Transferido da LIA para vendedor humano",
  EC_INICIOU_CHECKOUT: "Adicionou produto ao carrinho mas não finalizou",
  EC_PROD_RESINA: "Interagiu com produto de resina na loja",
};
const RELEVANT_TAGS = ["LIA_LEAD_ATIVADO", "A_HANDOFF_LIA", "EC_INICIOU_CHECKOUT", "EC_PROD_RESINA", "COMPROU_SCANNER", "C_PRIMEIRO_CONTATO", "C_RECUPERADO"];

// ─── Timeline event type ───
interface TLEvent {
  date: string;
  dotCls: string;
  title: string;
  desc: string;
  tags?: string[];
  detail?: Record<string, string>;
}

// ─── Cognitive analysis call ───
async function runCognitiveAnalysis(leadId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/smart-ops-cognitive-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lead_id: leadId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro na análise");
  return data.analysis;
}

// ─── COMPONENT ───
export function LeadDetailPanel({ lead, onClose }: { lead: { id: string; nome: string; [key: string]: unknown }; onClose: () => void }) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("historico");
  const [cognitiveLoading, setCognitiveLoading] = useState(false);
  const [cognitiveText, setCognitiveText] = useState<string | null>(null);
  const cachedIdRef = useRef<string | null>(null);

  // Fetch detail when lead changes
  useEffect(() => {
    if (!lead?.id || lead.id === cachedIdRef.current) return;
    setLoading(true);
    setError(null);
    setActiveTab("historico");
    setCognitiveText(null);

    fetch(`${API_BASE}/smart-ops-leads-api?action=detail&id=${lead.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data?.lead) {
          setError(data?.error ? `Erro: ${typeof data.error === 'object' ? JSON.stringify(data.error) : data.error}` : "Lead não encontrado");
          return;
        }
        setDetail(data);
        cachedIdRef.current = lead.id;
        // Pre-fill cognitive text from saved data
        if (data?.lead?.cognitive_analysis?.ai_narrative) {
          setCognitiveText(data.lead.cognitive_analysis.ai_narrative);
        }
      })
      .catch(() => setError("Erro ao carregar dados do lead"))
      .finally(() => setLoading(false));
  }, [lead?.id]);

  // Reset cache on lead change
  useEffect(() => {
    if (lead?.id !== cachedIdRef.current) {
      cachedIdRef.current = null;
    }
  }, [lead?.id]);

  const handleReanalisar = async () => {
    if (!detail?.lead?.id) return;
    setCognitiveLoading(true);
    try {
      const text = await runCognitiveAnalysis(detail.lead.id);
      setCognitiveText(text);
    } catch {
      setCognitiveText("Erro ao gerar análise. Tente novamente.");
    } finally {
      setCognitiveLoading(false);
    }
  };

  // Loading / Error states
  if (loading) {
    return (
      <div className="intel-detail" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="live-dot" style={{ width: 10, height: 10 }} />
        <span style={{ marginLeft: 8, color: "var(--muted)", fontSize: 13 }}>Carregando...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="intel-detail" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--hot)", fontSize: 13 }}>
        {error}
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="intel-detail-empty">
        <div className="big">📊</div>
        <p>Selecione um lead para ver o Intelligence Card</p>
      </div>
    );
  }

  const ld = detail.lead;
  const person = detail.person;
  const opportunities = detail.opportunities || [];
  const support_tickets = detail.support_tickets || [];
  const support_summary = detail.support_summary;
  const tags = (ld.tags_crm as string[]) || [];

  // LIS
  const lis = ld.intelligence_score_total || (ld.intelligence_score as any)?.score_total || 0;
  const lisCls = lis >= 70 ? "lis-hot" : lis >= 40 ? "lis-warm" : "lis-cold";
  const heatCls = lis >= 70 ? "heat-hot" : lis >= 40 ? "heat-warm" : "heat-cold";
  const heatTxt = lis >= 70 ? "🔴 HOT" : lis >= 40 ? "🟡 MORNO" : "⚪ FRIO";

  // Buyer type
  const tipoCls = ld.buyer_type === "company" ? "buyer-pj" : "buyer-pf";
  const tipoTxt = ld.buyer_type === "company" ? "🏢 B2B — CNPJ" : "👤 B2C";

  // Meta row
  const meta = [
    ld.cidade && ld.uf && `🏙️ ${ld.cidade}, ${ld.uf}`,
    ld.data_primeiro_contato && `📅 Primeiro: ${formatDate(ld.data_primeiro_contato)}`,
    ld.updated_at && `🔄 Último: ${formatDate(ld.updated_at)}`,
    ld.total_deals && `💼 ${ld.total_deals} deal${ld.total_deals !== 1 ? "s" : ""}`,
    person?.nome && `👤 ${person.nome}`,
    ld.area_atuacao,
    ld.especialidade && `🦷 ${ld.especialidade}`,
    ld.piperun_stage_name && `📍 ${ld.piperun_stage_name}`,
  ].filter(Boolean) as string[];

  // Axes
  const axes = (ld.intelligence_score as any)?.axes || {};
  const sh = Math.round(axes.sales_heat?.value || 0);
  const be = Math.round(axes.behavioral_engagement?.value || 0);
  const tm = Math.round(axes.technical_maturity?.value || 0);
  const pp = Math.round(axes.purchase_power?.value || 0);

  // Timeline
  const buildTimeline = (): TLEvent[] => {
    const events: TLEvent[] = [];

    // Lead created
    if (ld.data_primeiro_contato) {
      events.push({
        date: ld.data_primeiro_contato,
        dotCls: "tl-dot-lead",
        title: "Lead criado no sistema",
        desc: `Origem: ${ld.source || "piperun"}${ld.utm_source ? " · " + ld.utm_source : ""}`,
      });
    }

    // Deals with proposal items summary
    ((ld.piperun_deals_history as any[]) || []).forEach((d: any) => {
      // Build items summary for timeline detail
      const proposals = Array.isArray(d.proposals) ? d.proposals : [];
      const allItems: string[] = [];
      proposals.forEach((prop: any) => {
        const items = Array.isArray(prop.items) ? prop.items : [];
        items.forEach((item: any) => {
          const name = item.nome || item.name || item.product_name || "Produto";
          const qty = item.quantidade || item.quantity || 1;
          allItems.push(`${name} (${qty}×)`);
        });
      });

      events.push({
        date: d.created_at,
      dotCls: isWon(d.status) ? "tl-dot-buy" : isLost(d.status) ? "tl-dot-hot" : "tl-dot-crm",
      title: `Deal #${d.deal_id} — ${d.pipeline_name || ""}`,
      desc: d.stage_name || "",
      tags: [isWon(d.status) ? "✓ Ganho" : isLost(d.status) ? "✗ Perdido" : "● Aberto"],
        detail: {
          Valor: formatBRLFull(d.value),
          Status: d.status,
          Responsável: ownerDisplay(d.owner_name),
          ...(proposals.length > 0 ? { Propostas: `${proposals.length}` } : {}),
          ...(allItems.length > 0 ? { Itens: allItems.slice(0, 5).join(", ") + (allItems.length > 5 ? ` (+${allItems.length - 5})` : "") } : {}),
          ...(d.closed_at ? { "Fechado em": formatDate(d.closed_at) } : {}),
        },
      });
    });

    // Activity log events (e-commerce, forms, SDR, etc.)
    (detail?.activity_log || []).forEach((ev) => {
      const isEcommerce = ev.source_channel === "ecommerce";
      const evData = ev.event_data || {};
      events.push({
        date: ev.event_timestamp || ev.created_at,
        dotCls: isEcommerce ? "tl-dot-buy" : "tl-dot-crm",
        title: isEcommerce
          ? `🛒 ${(ev.event_type || "").replace("ecommerce_", "")} — Pedido #${evData.pedido || ev.entity_id || "?"}`
          : ev.event_type || "Evento",
        desc: ev.entity_name || (evData.produtos ? evData.produtos.join(", ") : "") || "",
        tags: evData.tags_added?.slice(0, 3) || [],
        detail: {
          ...(evData.valor ? { Valor: formatBRLFull(evData.valor) } : {}),
          ...(evData.status ? { Status: evData.status } : {}),
          ...(evData.fonte ? { Fonte: evData.fonte } : {}),
        },
      });
    });

    // Academy
    if (ld.astron_courses_total > 0) {
      events.push({
        date: ld.data_primeiro_contato || ld.created_at,
        dotCls: "tl-dot-course",
        title: `Academy — ${ld.astron_courses_completed}/${ld.astron_courses_total} cursos`,
        desc: `Status: ${ld.astron_status}`,
        tags: [ld.astron_courses_completed === ld.astron_courses_total ? "✓ Completo" : "Em progresso"],
      });
    }

    // Support tickets
    support_tickets.forEach((t) => {
      events.push({
        date: t.created_at,
        dotCls: t.status === "resolved" ? "tl-dot-buy" : t.open_hours && t.open_hours > 72 ? "tl-dot-hot" : "tl-dot-support",
        title: `🔧 Chamado #${t.ticket_full_id}${t.equipment ? " — " + t.equipment : ""}`,
        desc: t.client_summary || t.ai_summary || "Chamado de suporte técnico",
        tags: [
          t.status === "resolved"
            ? `✓ Resolvido em ${t.resolution_hours}h`
            : t.open_hours && t.open_hours > 72
              ? `⚠️ Aberto há ${Math.round(t.open_hours / 24)}d`
              : `🟡 Aberto · ${t.n_messages} msgs`,
        ],
        detail: {
          Ticket: t.ticket_full_id,
          Equipamento: t.equipment || "—",
          Status: t.status === "open" ? "🟡 Em aberto" : "✅ Resolvido",
          Mensagens: String(t.n_messages),
          ...(t.open_hours && !t.resolved_at ? { "Aberto há": `${t.open_hours}h` } : {}),
          ...(t.resolved_at ? { "Resolvido em": formatDate(t.resolved_at) } : {}),
        },
      });
    });

    // CRM tags
    tags.filter((tag) => RELEVANT_TAGS.includes(tag)).forEach((tag) => {
      events.push({
        date: ld.updated_at || ld.created_at,
        dotCls: tag.startsWith("LIA") || tag.startsWith("A_H") ? "tl-dot-ai" : tag.startsWith("EC") ? "tl-dot-warn" : "tl-dot-crm",
        title: TAG_LABELS[tag] || tag,
        desc: TAG_DESCS[tag] || "",
      });
    });

    return events.filter((e) => Boolean(e.date)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const timeline = buildTimeline();

  // Stats — count proposals across all deals
  const allDeals = (ld.piperun_deals_history as any[]) || [];
  const totalProposals = allDeals.reduce((sum: number, d: any) => {
    const props = Array.isArray(d.proposals) ? d.proposals.length : 0;
    return sum + props;
  }, 0);
  const wonDeals = allDeals.filter((d: any) => d.status === "ganha");
  const lostDeals = allDeals.filter((d: any) => d.status === "perdida");
  const ltvWon = wonDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
  const ltvLost = lostDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);

  // Consolidated proposal items
  const allProposalItems: { dealId: string; proposalId: string; name: string; qty: number; unitVal: number; totalVal: number; dealStatus: string }[] = [];
  allDeals.forEach((d: any) => {
    const proposals = Array.isArray(d.proposals) ? d.proposals : [];
    proposals.forEach((prop: any) => {
      const items = Array.isArray(prop.items) ? prop.items : [];
      items.forEach((item: any) => {
        const qty = Number(item.quantidade || item.quantity || 1);
        const unitVal = Number(item.valor_unitario || item.unit_value || 0);
        const totalVal = Number(item.valor_total || item.total_value || qty * unitVal);
        allProposalItems.push({
          dealId: String(d.deal_id || "—"),
          proposalId: String(prop.proposal_id || "—"),
          name: item.nome || item.name || item.product_name || "Produto",
          qty,
          unitVal,
          totalVal,
          dealStatus: d.status || "aberto",
        });
      });
    });
  });

  const stats = [
    { num: ltvWon > 0 ? formatBRLFull(ltvWon) : (ltvLost > 0 ? formatBRLFull(ltvLost) : "R$ 0"), lbl: ltvWon > 0 ? "LTV Ganho" : (ltvLost > 0 ? "$ Perdido" : "LTV"), cls: ltvWon > 0 ? "green" : (ltvLost > 0 ? "red" : "") },
    { num: String(wonDeals.length), lbl: "Ganhos", cls: "green" },
    { num: String(lostDeals.length), lbl: "Perdidos", cls: lostDeals.length > 0 ? "red" : "" },
    { num: String(totalProposals || "—"), lbl: "Propostas", cls: "" },
    { num: ltvWon > 0 ? formatBRLFull(ltvWon / wonDeals.length) : "—", lbl: "Ticket médio", cls: "green" },
    { num: support_summary?.total ? String(support_summary.total) : "—", lbl: "Chamados", cls: support_summary?.open ? "red" : "green" },
  ];

  // Cognitive cards
  const cog = ld.cognitive_analysis as any;
  const cogCards = [
    { title: "🎯 Perfil Psicológico", content: cog?.psychological_profile || ld.psychological_profile, tags: [] as string[] },
    { title: "💡 Motivação Principal", content: cog?.primary_motivation || ld.primary_motivation, tags: cog?.interest_timeline ? [`⚡ ${cog.interest_timeline}`] : [] },
    { title: "⚠️ Objeções e Riscos", content: cog?.objection_risk || ld.objection_risk, tags: cog?.urgency_level ? [`🔥 Urgência ${cog.urgency_level}`] : [] },
    { title: "🗺️ Trajetória do Lead", content: cog?.stage_trajectory, tags: cog?.lead_stage_detected ? [`📍 ${cog.lead_stage_detected}`] : [] },
    {
      title: "📞 Abordagem Recomendada",
      content: cog?.recommended_approach || ld.recommended_approach,
      tags: [support_tickets.length > 0 && `🔧 ${support_tickets.length} chamados ativos`, cog?.confidence_score_analysis && `📊 Confiança ${cog.confidence_score_analysis}%`].filter(Boolean) as string[],
    },
    { title: "🔄 Padrão Sazonal", content: cog?.seasonal_pattern, tags: [] as string[] },
  ].filter((c) => c.content);

  // Upsell cards
  const sortedOpps = [...opportunities].sort((a, b) => {
    const w: Record<string, number> = { critica: 3, alta: 2, media: 1, baixa: 0 };
    return (w[b.priority] || 0) - (w[a.priority] || 0);
  });
  const CARD_TYPES = ["hot", "warm", "cold"] as const;
  const upsellCards = Array.from({ length: 3 }, (_, i) => {
    const opp = sortedOpps[i];
    const type = CARD_TYPES[i];
    if (!opp) return { isEmpty: true, type, title: "Motor processando...", desc: "Oportunidades calculadas a cada 30 min", value: "—", score: 0, window: "" };
    return {
      isEmpty: false, type,
      title: `${opp.opportunity_type} · ${opp.product_name}`,
      desc: `${opp.recommended_action}${opp.competitor_product ? " (vs " + opp.competitor_product + ")" : ""}`,
      value: formatBRL(opp.value_est_brl),
      score: Math.min(opp.score, 100),
      window: opp.recommended_message || "",
    };
  });

  // Actions
  const actions = [
    ...sortedOpps.map((opp) => ({
      icon: opp.priority === "critica" ? "🔴" : opp.priority === "alta" ? "🟠" : "🔵",
      title: `${opp.opportunity_type} · ${opp.product_name}`,
      desc: `${opp.recommended_action}${opp.competitor_product ? " · vs " + opp.competitor_product : ""}`,
      script: opp.recommended_message || null,
      priority: opp.priority === "critica" ? "HOJE" : opp.priority === "alta" ? "ESTA SEMANA" : "30 DIAS",
      priorityCls: opp.priority === "critica" ? "ap-hoje" : opp.priority === "alta" ? "ap-semana" : "ap-mes",
      itemCls: opp.priority === "critica" ? "critical" : opp.priority === "alta" ? "medium" : "",
    })),
    ...(support_tickets.filter((t) => t.status === "open").length > 0
      ? [{
          icon: "🔧",
          title: `Resolver ${support_tickets.filter((t) => t.status === "open").length} chamado${support_tickets.filter((t) => t.status === "open").length !== 1 ? "s" : ""} de suporte em aberto`,
          desc: support_tickets.filter((t) => t.status === "open").map((t) => `#${t.ticket_full_id} — ${t.equipment || "sem equip."}`).join(" · "),
          script: null, priority: "HOJE", priorityCls: "ap-hoje", itemCls: "critical",
        }]
      : []),
    ...(ld.astron_courses_total > 0 && ld.astron_courses_completed < ld.astron_courses_total
      ? [{ icon: "🎓", title: `Engajar com cursos incompletos — ${ld.astron_courses_completed}/${ld.astron_courses_total}`, desc: "Lead iniciou cursos na Academy mas não concluiu todos.", script: null, priority: "30 DIAS", priorityCls: "ap-mes", itemCls: "" }]
      : []),
    ...(ld.astron_courses_completed > 0 && ld.astron_courses_completed === ld.astron_courses_total && !ld.imersao_concluida
      ? [{ icon: "🏆", title: "Convidar para Imersão Presencial", desc: `Concluiu ${ld.astron_courses_completed}/${ld.astron_courses_total} cursos online. Próximo passo natural é a imersão presencial.`, script: `"${ld.nome}, você concluiu todos os cursos da Academy! O próximo passo natural é a Imersão Presencial — posso te enviar os detalhes?"`, priority: "ESTA SEMANA", priorityCls: "ap-semana", itemCls: "medium" }]
      : []),
  ];

  // ── Produtos mais vendidos (agregado de proposal items dos deals ganhos) ──
  const productAggMap: Record<string, { qty: number; totalVal: number }> = {};
  wonDeals.forEach((d: any) => {
    const proposals = Array.isArray(d.proposals) ? d.proposals : [];
    proposals.forEach((prop: any) => {
      const items = Array.isArray(prop.items) ? prop.items : [];
      items.forEach((item: any) => {
        const name = (item.nome || item.name || item.product_name || "Produto").trim();
        const qty = Number(item.quantidade || item.quantity || 1);
        const total = Number(item.valor_total || item.total_value || qty * Number(item.valor_unitario || item.unit_value || 0));
        if (!productAggMap[name]) productAggMap[name] = { qty: 0, totalVal: 0 };
        productAggMap[name].qty += qty;
        productAggMap[name].totalVal += total;
      });
    });
  });
  const topProducts = Object.entries(productAggMap)
    .sort((a, b) => b[1].totalVal - a[1].totalVal)
    .slice(0, 8);

  // ── Vendedor top (agregado por owner_name dos deals ganhos) ──
  const sellerAggMap: Record<string, { count: number; totalVal: number }> = {};
  wonDeals.forEach((d: any) => {
    const name = ownerDisplay(d.owner_name);
    if (name === "—") return;
    if (!sellerAggMap[name]) sellerAggMap[name] = { count: 0, totalVal: 0 };
    sellerAggMap[name].count += 1;
    sellerAggMap[name].totalVal += Number(d.value) || 0;
  });
  const topSellers = Object.entries(sellerAggMap)
    .sort((a, b) => b[1].totalVal - a[1].totalVal)
    .slice(0, 5);

  // Product mix (legacy — kept for backward compat but unused in UI)
  const productMap: Record<string, number> = {};
  ((ld.piperun_deals_history as any[]) || []).forEach((d: any) => {
    const p = (d.product || "Produto").replace(/^\d{1,2}\/\d{1,2}\/\d{4}.*Zapier.*$/, "Deal").slice(0, 30);
    productMap[p] = (productMap[p] || 0) + (Number(d.value) || 0);
  });
  const totalProductVal = Object.values(productMap).reduce((s, v) => s + v, 0);
  const top5Products = Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, val]) => ({ name, val, pct: totalProductVal > 0 ? ((val / totalProductVal) * 100).toFixed(1) : "0" }));


  // Academy courses
  const astronCourses = (ld.astron_courses_access as any[]) || [];

  // LIS ring
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (lis / 100) * circ;
  const ringColor = lis >= 70 ? "var(--hot)" : lis >= 40 ? "var(--warm)" : "var(--cold)";

  const breakdown = [
    { label: "Sales Heat", val: sh, color: "var(--hot)" },
    { label: "Behavioral Engagement", val: be, color: "var(--warm)" },
    { label: "Technical Maturity", val: tm, color: "var(--accent2)" },
    { label: "Purchase Power", val: pp, color: "var(--blue)" },
  ];

  const totalPipeline = opportunities.reduce((s, o) => s + (Number(o.value_est_brl) || 0), 0);

  return (
    <div className="intel-detail">
      {/* Close button */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", justifyContent: "flex-end", padding: "8px 12px", background: "var(--bg)" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}>
          <X size={18} />
        </button>
      </div>

      {/* ═══ HERO ═══ */}
      <div className="hero">
        <div className="avatar">{initials(ld.nome)}</div>
        <div>
          <div className="lead-name">{ld.nome}</div>
          <div className={`buyer-type ${tipoCls}`}>{tipoTxt}</div>
          <div className="badges-row">
            {support_summary && support_summary.open > 0 && (
              <span className="ctx-badge ctx-badge-support">🔧 {support_summary.open} chamado{support_summary.open !== 1 ? "s" : ""} aberto{support_summary.open !== 1 ? "s" : ""}</span>
            )}
            {ld.astron_courses_total > 0 && (
              <span className="ctx-badge ctx-badge-academy">🎓 Academy {ld.astron_courses_completed}/{ld.astron_courses_total}</span>
            )}
            {tags.includes("EC_INICIOU_CHECKOUT") && (
              <span className="ctx-badge ctx-badge-cart">🛒 Carrinho pendente</span>
            )}
          </div>
          <div className="meta-row">
            {meta.map((m, i) => (
              <span key={i} className="meta">{m}</span>
            ))}
          </div>
        </div>
        <div className="ltv-block">
          <div className="ltv-label">{ltvWon > 0 ? "LTV GANHO" : (ltvLost > 0 ? "$ PERDIDO" : "LTV")}</div>
          <div className="ltv-val" style={ltvWon === 0 && ltvLost > 0 ? { color: "var(--hot)" } : undefined}>{formatBRL(ltvWon > 0 ? ltvWon : ltvLost)}</div>
          <div className="ltv-sub">{wonDeals.length} ganho{wonDeals.length !== 1 ? "s" : ""} · {lostDeals.length} perdido{lostDeals.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="lis-block">
          <div className={`lis-val ${lisCls}`}>{lis}</div>
          <div className={`heat-badge ${heatCls}`}>{heatTxt}</div>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="tabs">
        {TABS.map((t) => (
          <div key={t.key} className={`tab${activeTab === t.key ? " active" : ""}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ═══ TAB CONTENT ═══ */}

      {/* ── HISTÓRICO ── */}
      {activeTab === "historico" && (
        <div className="tab-content">
          <div className="sec">Resumo Financeiro</div>
          <div className="stats-row">
            {stats.map((s, i) => (
              <div key={i} className="stat-box">
                <div className={`stat-num ${s.cls}`}>{s.num}</div>
                <div className="stat-lbl">{s.lbl}</div>
              </div>
            ))}
          </div>

          {/* Deal table with proposal items */}
          {allDeals.length > 0 && (
            <>
              <div className="sec">Deals PipeRun</div>
              <div style={{ overflowX: "auto", marginBottom: 20, border: "1px solid var(--border2)", borderRadius: 10 }}>
                <table className="deal-table">
                  <thead>
                    <tr>
                      <th>Data</th><th>Deal ID</th><th>Funil</th><th>Etapa</th><th>Valor</th><th>Status</th><th>Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDeals.map((d: any, i: number) => {
                      const proposals = Array.isArray(d.proposals) ? d.proposals : [];
                      return (
                        <> 
                          <tr key={`deal-${i}`}>
                            <td>{formatDate(d.created_at)}</td>
                            <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>#{d.deal_id}</td>
                            <td>{d.pipeline_name || "—"}</td>
                            <td>{d.stage_name || "—"}</td>
                            <td className="green">{formatBRLFull(d.value)}</td>
                            <td>
                              <span className={`status-chip ${d.status === "ganha" ? "s-ganho" : d.status === "perdida" ? "s-perdido" : "s-aberto"}`}>
                                {d.status === "ganha" ? "✓ Ganho" : d.status === "perdida" ? "✗ Perdido" : "● Aberto"}
                              </span>
                            </td>
                            <td>{ownerDisplay(d.owner_name)}</td>
                          </tr>
                          {proposals.map((prop: any, pi: number) => {
                            const items = Array.isArray(prop.items) ? prop.items : [];
                            return (
                              <tr key={`prop-${i}-${pi}`} style={{ background: "var(--surface2)" }}>
                                <td colSpan={7} style={{ padding: "8px 16px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: items.length > 0 ? 8 : 0 }}>
                                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--accent2)" }}>
                                      └ {prop.proposal_id || `PRO${pi + 1}`}
                                    </span>
                                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                                      · {items.length} ite{items.length !== 1 ? "ns" : "m"}
                                      {prop.value_products ? ` · ${formatBRLFull(prop.value_products)}` : ""}
                                    </span>
                                    {(prop.freight_type || prop.value_freight) && (
                                      <span style={{ fontSize: 10, color: "var(--muted2)" }}>
                                        · Frete: {prop.freight_type || "—"} {prop.value_freight ? formatBRLFull(prop.value_freight) : ""}
                                      </span>
                                    )}
                                    {prop.payment_installments && (
                                      <span style={{ fontSize: 10, color: "var(--muted2)" }}>· {prop.payment_installments}× parcelas</span>
                                    )}
                                  </div>
                                  {items.length > 0 && (
                                    <div style={{ display: "grid", gap: 3 }}>
                                      {items.map((item: any, ii: number) => (
                                        <div key={ii} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--muted2)", paddingLeft: 20 }}>
                                          <span style={{ flex: 1, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {item.nome || item.name || item.product_name || "Produto"}
                                          </span>
                                          <span style={{ fontFamily: "'DM Mono', monospace", minWidth: 36, textAlign: "right" }}>
                                            {item.quantidade || item.quantity || 1}×
                                          </span>
                                          <span style={{ fontFamily: "'DM Mono', monospace", minWidth: 90, textAlign: "right", color: "var(--accent2)" }}>
                                            {formatBRLFull(item.valor_unitario || item.unit_value || 0)}
                                          </span>
                                          <span style={{ fontFamily: "'DM Mono', monospace", minWidth: 90, textAlign: "right", color: "var(--text)" }}>
                                            {formatBRLFull(item.valor_total || item.total_value || ((item.quantidade || item.quantity || 1) * (item.valor_unitario || item.unit_value || 0)))}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Produtos mais vendidos ── */}
          {topProducts.length > 0 && (
            <>
              <div className="sec">🏆 Produtos Mais Vendidos</div>
              <div style={{ overflowX: "auto", marginBottom: 20, border: "1px solid var(--border2)", borderRadius: 10 }}>
                <table className="deal-table">
                  <thead>
                    <tr>
                      <th>Produto</th><th style={{ textAlign: "right" }}>Qtd</th><th style={{ textAlign: "right" }}>Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map(([name, agg], i) => (
                      <tr key={i}>
                        <td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "right" }}>{agg.qty}×</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "right", color: "var(--accent2)" }}>{formatBRLFull(agg.totalVal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Vendedor Top ── */}
          {topSellers.length > 0 && (
            <>
              <div className="sec">👤 Vendedor Top</div>
              <div style={{ overflowX: "auto", marginBottom: 20, border: "1px solid var(--border2)", borderRadius: 10 }}>
                <table className="deal-table">
                  <thead>
                    <tr>
                      <th>Vendedor</th><th style={{ textAlign: "right" }}>Deals</th><th style={{ textAlign: "right" }}>Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSellers.map(([name, agg], i) => (
                      <tr key={i}>
                        <td>{name}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "right" }}>{agg.count}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "right", color: "var(--accent2)" }}>{formatBRLFull(agg.totalVal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 🎓 Academy section */}
          {(astronCourses.length > 0 || ld.astron_courses_total > 0) && (
            <>
              <div className="sec">🎓 Academy</div>
              <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 11, color: "var(--muted2)" }}>
                {ld.astron_created_at && <span>📅 Inscrito em: {formatDate(ld.astron_created_at)}</span>}
                {ld.astron_status && <span>Status: <strong style={{ color: "var(--text)" }}>{ld.astron_status}</strong></span>}
                <span>{ld.astron_courses_completed}/{ld.astron_courses_total} cursos concluídos</span>
              </div>
              {astronCourses.length > 0 && (
                <div style={{ border: "1px solid var(--border2)", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
                  <table className="deal-table">
                    <thead>
                      <tr>
                        <th>Curso</th><th>Aulas</th><th>Progresso</th><th>Atualização</th>
                      </tr>
                    </thead>
                    <tbody>
                      {astronCourses.map((course: any, ci: number) => {
                        const pct = Number(course.percentage) || 0;
                        const completed = course.completed_classes || 0;
                        const total = course.total_classes || 0;
                        return (
                          <tr key={ci}>
                            <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {course.course_name || "Curso"}
                            </td>
                            <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                              {completed}/{total}
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ flex: 1, background: "var(--surface3)", borderRadius: 4, height: 6, overflow: "hidden", maxWidth: 100 }}>
                                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: pct === 100 ? "var(--accent2)" : "var(--blue)" }} />
                                </div>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: pct === 100 ? "var(--accent2)" : "var(--muted2)", minWidth: 36 }}>
                                  {pct}%
                                </span>
                              </div>
                            </td>
                            <td style={{ fontSize: 10, color: "var(--muted)" }}>{formatDate(course.updated_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* 📦 Consolidated proposal items */}
          {allProposalItems.length > 0 && (
            <>
              <div className="sec">📦 Itens de Propostas ({allProposalItems.length})</div>
              <div style={{ overflowX: "auto", marginBottom: 20, border: "1px solid var(--border2)", borderRadius: 10 }}>
                <table className="deal-table">
                  <thead>
                    <tr>
                      <th>Deal</th><th>Item</th><th>Qtd</th><th>Unit</th><th>Total</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allProposalItems.map((item, ii) => (
                      <tr key={ii}>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>#{item.dealId}</td>
                        <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right" }}>{item.qty}×</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right", color: "var(--muted2)" }}>{formatBRLFull(item.unitVal)}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right", color: "var(--text)" }}>{formatBRLFull(item.totalVal)}</td>
                        <td>
                          <span className={`status-chip ${item.dealStatus === "ganha" ? "s-ganho" : item.dealStatus === "perdida" ? "s-perdido" : "s-aberto"}`}>
                            {item.dealStatus === "ganha" ? "✓ Ganho" : item.dealStatus === "perdida" ? "✗ Perdido" : "● Aberto"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Timeline */}
          <div className="sec">Timeline Unificada</div>
          <div className="timeline">
            {timeline.map((ev, i) => (
              <div key={i} className="tl-item">
                <div className={`tl-dot ${ev.dotCls}`} />
                <div className="tl-body">
                  <div className="tl-date">{formatDate(ev.date)}</div>
                  <div className="tl-title">{ev.title}</div>
                  {ev.desc && <div className="tl-desc">{ev.desc}</div>}
                  {ev.tags && (
                    <div className="tl-tags">
                      {ev.tags.map((tag, ti) => (
                        <span key={ti} className="tl-tag" style={{ background: "var(--surface3)", border: "1px solid var(--border2)", color: "var(--muted2)" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {ev.detail && (
                    <div className="tl-detail">
                      {Object.entries(ev.detail).map(([k, v]) => (
                        <div key={k} className="tl-detail-row">
                          <span style={{ color: "var(--muted)" }}>{k}</span>
                          <span style={{ fontWeight: 500 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Support tickets block */}
          {support_tickets.length > 0 && (
            <>
              <div className="sec">🔧 Chamados de Suporte Técnico</div>
              <div style={{ fontSize: 11, color: "var(--muted2)", marginBottom: 12 }}>
                {support_summary?.total} total · {support_summary?.open} abertos
                {(support_summary?.resolved || 0) > 0 && ` · ${support_summary?.resolved} resolvidos`}
              </div>
              {support_tickets.map((ticket) => (
                <div key={ticket.id} className={`ticket-card ${ticket.status === "resolved" ? "ticket-resolved" : ""} ${ticket.open_hours && ticket.open_hours > 72 ? "ticket-old" : ""}`} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <span className="ticket-id">#{ticket.ticket_full_id}</span>
                      <span style={{ fontSize: 12, marginLeft: 8, color: "var(--text)" }}>{ticket.equipment || "Equipamento não especificado"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className={`status-chip ${ticket.status === "resolved" ? "s-ganho" : "s-aberto"}`}>
                        {ticket.status === "resolved" ? "✓ Resolvido" : "🟡 Aberto"}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>
                        {ticket.resolved_at ? `Resolvido em ${ticket.resolution_hours}h` : `Aberto há ${ticket.open_hours}h`}
                      </span>
                    </div>
                  </div>
                  {ticket.client_summary && <div style={{ fontSize: 12, color: "var(--muted2)", marginBottom: 6, fontStyle: "italic" }}>"{ticket.client_summary}"</div>}
                  {ticket.ai_summary && (
                    <div className="ticket-ai-box" style={{ marginBottom: 6 }}>
                      <strong style={{ color: "var(--blue)" }}>🤖 IA:</strong> {ticket.ai_summary}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--muted)" }}>
                    <span>📅 {formatDate(ticket.created_at)}</span>
                    <span>💬 {ticket.n_messages} mensagem{ticket.n_messages !== 1 ? "s" : ""}</span>
                    {ticket.last_message && <span>Última: {ticket.last_message.sender} · {formatDate(ticket.last_message.created_at)}</span>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── COGNITIVO ── */}
      {activeTab === "cognitivo" && (
        <div className="tab-content">
          <div className="ai-panel">
            <div className="ai-panel-header">
              <span>🧠</span>
              <span>Análise Cognitiva — gerada por IA com base em {ld.total_deals || 0} deal{(ld.total_deals || 0) !== 1 ? "s" : ""} + histórico completo</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <span className="badge badge-ai">DeepSeek v3</span>
                <button
                  onClick={handleReanalisar}
                  disabled={cognitiveLoading}
                  style={{
                    background: "rgba(79,143,255,.15)", border: "1px solid rgba(79,143,255,.3)", color: "var(--blue)",
                    padding: "3px 10px", borderRadius: 6, cursor: cognitiveLoading ? "default" : "pointer", fontSize: 11,
                    opacity: cognitiveLoading ? 0.5 : 1,
                  }}
                >
                  {cognitiveLoading ? "⏳ Analisando..." : "↺ Reanalisar"}
                </button>
              </div>
            </div>
            <div className={`ai-panel-body${cognitiveLoading ? " loading" : ""}`}>
              {cognitiveLoading ? (
                <>
                  <div className="live-dot" />
                  Analisando histórico, deals, suporte e padrões de comportamento...
                </>
              ) : cognitiveText ? (
                <div
                  style={{ lineHeight: 1.7, fontSize: 13 }}
                  dangerouslySetInnerHTML={{
                    __html: cognitiveText.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                  }}
                />
              ) : (
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  Clique em "↺ Reanalisar" para gerar análise cognitiva ao vivo.
                  {cog?.stage_trajectory && <div style={{ marginTop: 8, color: "var(--muted2)" }}>Última análise salva: {cog.stage_trajectory}</div>}
                </div>
              )}
            </div>
          </div>

          {cogCards.length > 0 ? (
            <div className="cog-grid">
              {cogCards.map((card, i) => (
                <div key={i} className="cog-card">
                  <h4>{card.title}</h4>
                  <p>{card.content}</p>
                  {card.tags.length > 0 && (
                    <div className="approach-tags">
                      {card.tags.map((tag, ti) => <span key={ti} className="approach-tag">{tag}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="cog-card" style={{ marginTop: 16 }}>
              <p style={{ color: "var(--muted)" }}>Clique em "Reanalisar" para gerar análise cognitiva.</p>
            </div>
          )}
        </div>
      )}

      {/* ── UPSELL ── */}
      {activeTab === "upsell" && (
        <div className="tab-content">
          <div className="sec">Oportunidades Detectadas</div>
          <div className="upsell-grid">
            {upsellCards.map((card, i) => (
              <div key={i} className={`upsell-card upsell-${card.type}`}>
                <div className="upsell-prob" style={{ color: card.type === "hot" ? "var(--hot)" : card.type === "warm" ? "var(--warm)" : "var(--muted2)" }}>
                  {card.type === "hot" ? "🔴" : card.type === "warm" ? "🟡" : "⚪"} {card.isEmpty ? "—" : `${card.score}%`}
                </div>
                <div className="upsell-title">{card.title}</div>
                <div className="upsell-desc">{card.desc}</div>
                <div className="upsell-val" style={{ color: card.type === "hot" ? "var(--hot)" : card.type === "warm" ? "var(--warm)" : "var(--muted)" }}>{card.value}</div>
                {card.window && <div className="upsell-window">{card.window}</div>}
                {!card.isEmpty && (
                  <div className="prob-bar">
                    <div className="prob-fill" style={{ width: `${card.score}%`, background: card.type === "hot" ? "var(--hot)" : card.type === "warm" ? "var(--warm)" : "var(--cold)" }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="sec">Projeção LTV</div>
          <div className="stats-row" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {[
              { label: "LTV Atual", val: formatBRL(ld.ltv_total), color: "var(--accent2)" },
              { label: "Pipeline aberto", val: formatBRL(totalPipeline), color: "var(--accent)" },
              { label: "Ticket Médio", val: formatBRL(avgTicket(ld)), color: "var(--muted2)" },
              { label: "Oportunidades", val: String(opportunities.length), color: "var(--blue)" },
            ].map((m, i) => (
              <div key={i} className="stat-box">
                <div className="stat-num" style={{ color: m.color }}>{m.val}</div>
                <div className="stat-lbl">{m.label}</div>
              </div>
            ))}
          </div>

          {top5Products.length > 0 && (
            <>
              <div className="sec">Mix de Produtos (Top 5)</div>
              {top5Products.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--muted2)", minWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <div style={{ flex: 1, background: "var(--surface3)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{ width: `${p.pct}%`, height: "100%", borderRadius: 4, background: "var(--accent2)" }} />
                  </div>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text)", minWidth: 60, textAlign: "right" }}>{formatBRL(p.val)}</span>
                  <span style={{ fontSize: 10, color: "var(--muted)", minWidth: 36 }}>{p.pct}%</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── FLUXO ── */}
      {activeTab === "fluxo" && (
        <div className="tab-content">
          {detail.portfolio ? (
            <WorkflowPortfolio portfolio={detail.portfolio} />
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Portfolio não disponível para este lead.</div>
          )}

          {opportunities.length > 0 && (
            <div style={{ marginTop: 16, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
                Gap do Fluxo — Oportunidades Não Exploradas
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {opportunities.map((opp) => (
                  <span
                    key={opp.product_name}
                    style={{
                      background: opp.priority === "critica" ? "rgba(255,71,87,.08)" : opp.priority === "alta" ? "rgba(232,255,71,.06)" : "rgba(79,143,255,.08)",
                      border: opp.priority === "critica" ? "1px solid rgba(255,71,87,.2)" : opp.priority === "alta" ? "1px solid rgba(232,255,71,.2)" : "1px solid rgba(79,143,255,.2)",
                      color: opp.priority === "critica" ? "var(--hot)" : opp.priority === "alta" ? "var(--accent)" : "var(--blue)",
                      fontSize: 12, padding: "5px 12px", borderRadius: 20,
                    }}
                  >
                    {opp.priority === "critica" ? "🔴" : opp.priority === "alta" ? "🟡" : "🔵"} {opp.product_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LIS BREAKDOWN ── */}
      {activeTab === "lis" && (
        <div className="tab-content">
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", marginBottom: 20 }}>
            <div className="score-ring-wrap">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface3)" strokeWidth="8" />
                <circle cx="50" cy="50" r={radius} fill="none" stroke={ringColor} strokeWidth="8" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
              </svg>
              <div className="score-ring-center">
                <div className="score-ring-val" style={{ color: ringColor }}>{lis}</div>
                <div className="score-ring-lbl">LIS</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="lis-breakdown">
                {breakdown.map((b, i) => (
                  <div key={i} className="lis-comp">
                    <span className="lis-comp-label">{b.label}</span>
                    <div className="lis-bar-wrap">
                      <div className="lis-bar" style={{ width: `${b.val}%`, background: b.color }} />
                    </div>
                    <span className="lis-comp-val" style={{ color: b.color }}>{b.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="formula-box" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted2)", lineHeight: 1.8 }}>
            <div>LIS = (SH×0.35) + (BE×0.25) + (TM×0.20) + (PP×0.20)</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;= ({sh}×.35) + ({be}×.25) + ({tm}×.20) + ({pp}×.20)</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;= {(sh * 0.35 + be * 0.25 + tm * 0.2 + pp * 0.2).toFixed(1)} ≈ {lis}</div>
            {cog?.confidence_score_analysis && (
              <div style={{ marginTop: 8, color: "var(--warm)" }}>⚠️ Confiança da análise: {cog.confidence_score_analysis}%</div>
            )}
          </div>
        </div>
      )}

      {/* ── AÇÕES ── */}
      {activeTab === "acoes" && (
        <div className="tab-content">
          {actions.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Motor de oportunidades processando... (atualiza a cada 30 min)</div>
          ) : (
            <div className="action-list">
              {actions.map((action, i) => (
                <div key={i} className={`action-item ${action.itemCls}`}>
                  <div className="action-icon">{action.icon}</div>
                  <div className="action-body">
                    <div className="action-title">{action.title}</div>
                    <div className="action-desc">{action.desc}</div>
                    {action.script && <div className="action-script">{action.script}</div>}
                  </div>
                  <div className={`action-priority ${action.priorityCls}`}>{action.priority}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
