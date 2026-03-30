import React, { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import { WorkflowPortfolio, type Portfolio } from "./WorkflowPortfolio";

// ─── Constants ───
const API_BASE = "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1";

// ─── Status helpers (case-insensitive) ───
const isWon = (s: string | null | undefined) => ["ganha", "won"].includes((s || "").toLowerCase());
const isLost = (s: string | null | undefined) => ["perdida", "lost"].includes((s || "").toLowerCase());

// Strip HTML tags and return clean text
const stripHtml = (str: any): string => {
  if (!str || typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
};

// Check if a proposal item is a valid displayable item (not a placeholder)
const isValidItem = (_item: any): boolean => {
  // Accept all items — combos have R$0 items that must be shown
  return true;
};

const getItemName = (item: any): string => {
  const raw = item.product_name || item.nome || item.name || "";
  const cleaned = stripHtml(raw);
  return cleaned || "Produto";
};

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

type TabKey = "historico" | "cognitivo" | "upsell" | "fluxo" | "lis" | "acoes" | "cs";

const TABS: { key: TabKey; label: string }[] = [
  { key: "historico", label: "📋 Histórico Completo" },
  { key: "cognitivo", label: "🧠 Análise Cognitiva IA" },
  { key: "upsell", label: "🚀 Upsell & Previsão" },
  { key: "fluxo", label: "🔄 Fluxo Digital" },
  { key: "lis", label: "📊 LIS Breakdown" },
  { key: "acoes", label: "⚡ Ações Recomendadas" },
  { key: "cs", label: "🎓 CS" },
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
  if (!dt || typeof dt !== 'string' || !dt.trim()) return "—";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
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
  const res = await fetch(`${API_BASE}/cognitive-lead-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro na análise");
  if (data.skip) throw new Error(`Análise não disponível: ${data.skip === "insufficient_messages" ? "Lead precisa de pelo menos 5 mensagens com a Dra. LIA" : data.skip}`);
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

    // Lead created — for LI leads use real origin date
    const leadOriginDate = ld.source === "loja_integrada"
      ? (ld.lojaintegrada_cliente_data_criacao || ld.data_primeiro_contato || ld.created_at)
      : (ld.data_primeiro_contato || ld.created_at);
    if (leadOriginDate) {
      events.push({
        date: leadOriginDate,
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
        const items = (Array.isArray(prop.items) ? prop.items : []).filter(isValidItem);
        items.forEach((item: any) => {
          const name = getItemName(item);
          const qty = item.qtd || item.quantidade || item.quantity || 1;
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

    // Activity log events (e-commerce, forms, SDR, etc.) — deduplicate by event_type+entity_id
    const seenActivityKeys = new Set<string>();
    const dedupedActivityLogs = (detail?.activity_log || []).filter((ev: any) => {
      if (!ev.entity_id) return true;
      const key = `${ev.event_type}|${ev.entity_id}`;
      if (seenActivityKeys.has(key)) return false;
      seenActivityKeys.add(key);
      return true;
    });
    dedupedActivityLogs.forEach((ev: any) => {
      const isEcommerce = ev.source_channel === "ecommerce";
      const evData = ev.event_data || {};
      const ecommerceDetail: Record<string, string> = {};
      if (isEcommerce) {
        if (evData.valor) ecommerceDetail["Valor"] = formatBRLFull(evData.valor);
        if (evData.valor_desconto) ecommerceDetail["Desconto"] = formatBRLFull(evData.valor_desconto);
        if (evData.valor_envio) ecommerceDetail["Frete"] = formatBRLFull(evData.valor_envio);
        if (evData.status) ecommerceDetail["Status"] = evData.status;
        if (evData.tracking) ecommerceDetail["Rastreio"] = evData.tracking;
        if (evData.forma_pagamento) ecommerceDetail["Pagamento"] = evData.forma_pagamento;
        if (evData.parcelas) ecommerceDetail["Parcelas"] = `${evData.parcelas}x${evData.bandeira ? " · " + evData.bandeira : ""}`;
        if (evData.forma_envio) ecommerceDetail["Envio"] = evData.forma_envio;
        if (evData.cupom && typeof evData.cupom === "object" && evData.cupom.codigo) ecommerceDetail["Cupom"] = evData.cupom.codigo;
        if (evData.itens && Array.isArray(evData.itens) && evData.itens.length > 0) {
          ecommerceDetail["Itens"] = evData.itens.map((it: any) => `${it.nome} (${it.qty}× R$${Number(it.preco || 0).toFixed(0)})`).slice(0, 4).join(", ");
        }
        if (evData.fonte) ecommerceDetail["Fonte"] = evData.fonte;
      }
      events.push({
        date: ev.event_timestamp || ev.created_at,
        dotCls: isEcommerce ? "tl-dot-buy" : "tl-dot-crm",
        title: isEcommerce
          ? `🛒 ${(ev.event_type || "").replace("ecommerce_", "")} — Pedido #${evData.pedido || ev.entity_id || "?"}`
          : ev.event_type || "Evento",
        desc: ev.entity_name || (evData.produtos ? evData.produtos.join(", ") : "") || "",
        tags: evData.tags_added?.slice(0, 3) || [],
        detail: isEcommerce ? ecommerceDetail : {
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

    // CRM tags — only show non-ecommerce tags with real dated events (skip EC_ tags that generate false timeline entries)
    tags.filter((tag) => RELEVANT_TAGS.includes(tag) && !tag.startsWith("EC_")).forEach((tag) => {
      events.push({
        date: ld.updated_at || ld.created_at,
        dotCls: tag.startsWith("LIA") || tag.startsWith("A_H") ? "tl-dot-ai" : "tl-dot-crm",
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
  const wonDeals = allDeals.filter((d: any) => isWon(d.status));
  const lostDeals = allDeals.filter((d: any) => isLost(d.status));
  const ltvWon = wonDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
  const ltvLost = lostDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
  const openDeals = allDeals.filter((d: any) => !isWon(d.status) && !isLost(d.status));
  const psWon = wonDeals.reduce((s: number, d: any) => s + (Number(d.value_products) || Number(d.value) || 0), 0);
  const psOpen = openDeals.reduce((s: number, d: any) => s + (Number(d.value_products) || Number(d.value) || 0), 0);
  const mrrWon = wonDeals.reduce((s: number, d: any) => s + (Number(d.value_mrr) || 0), 0);
  const mrrOpenLost = [...openDeals, ...lostDeals].reduce((s: number, d: any) => s + (Number(d.value_mrr) || 0), 0);

  // ── E-commerce data (pre-computed for hero, mix, and table) ──
  const liHistorico = (() => {
    let hist = (Array.isArray(ld.lojaintegrada_historico_pedidos) ? [...ld.lojaintegrada_historico_pedidos] : [])
      .filter((p: any) => p.numero && String(p.numero) !== "undefined")
      .sort((a: any, b: any) => new Date(b.data || b.data_criacao || 0).getTime() - new Date(a.data || a.data_criacao || 0).getTime());
    if (hist.length === 0 && detail?.activity_log) {
      const ecomEvents = detail.activity_log.filter((ev: any) =>
        ev.source_channel === "ecommerce" &&
        (ev.event_type?.startsWith("order_") || ev.event_type?.startsWith("ecommerce_order_")) &&
        (ev.entity_id || ev.event_data?.pedido)
      );
      const seenOrders = new Set<string>();
      const reconstructed: any[] = [];
      for (const ev of ecomEvents) {
        const evd = ev.event_data || {};
        const orderId = String(evd.pedido || ev.entity_id || "");
        if (!orderId || seenOrders.has(orderId)) continue;
        seenOrders.add(orderId);
        const isApproved = (ev.event_type || "").includes("invoiced") || (ev.event_type || "").includes("paid") || (ev.event_type || "").includes("completed");
        reconstructed.push({
          numero: orderId,
          data_criacao: ev.event_timestamp,
          valor_total: evd.valor || evd.value || ev.value_numeric || 0,
          situacao_nome: evd.status || ev.event_type?.replace("ecommerce_order_", "").replace("order_", "") || "—",
          situacao_aprovado: isApproved,
          situacao_cancelado: (ev.event_type || "").includes("cancelled"),
          itens_resumo: evd.produtos?.join(", ") || evd.itens_resumo || ev.entity_name || null,
          valor_envio: evd.valor_envio || null,
          cupom_desconto: evd.cupom || null,
          forma_pagamento: evd.forma_pagamento || null,
          forma_envio: evd.forma_envio || null,
          link_rastreio: evd.tracking || null,
          parcelas: evd.parcelas || null,
          bandeira: evd.bandeira || null,
          itens: evd.itens || null,
          _from_activity: true,
        });
      }
      hist = reconstructed.sort((a: any, b: any) => new Date(b.data_criacao || 0).getTime() - new Date(a.data_criacao || 0).getTime());
    }
    return hist;
  })();
  const liApproved = liHistorico.filter((p: any) => p.situacao_aprovado && !p.situacao_cancelado);
  const liCancelled = liHistorico.filter((p: any) => p.situacao_cancelado);
  const ltvEcommerce = liApproved.reduce((sum: number, p: any) => sum + (parseFloat(p.valor_total) || 0), 0);
  const ltvAbandono = liCancelled.reduce((sum: number, p: any) => sum + (parseFloat(p.valor_total) || 0), 0);
  const ecomWon = liApproved.length;
  const ecomLost = liCancelled.length;
  const financeiroTotal = psWon + ltvEcommerce;

  // Consolidated proposal items (filtered: skip empty/placeholder items)
  const allProposalItems: { dealId: string; proposalId: string; name: string; sku: string; qty: number; unitVal: number; totalVal: number; dealStatus: string }[] = [];
  allDeals.forEach((d: any) => {
    const proposals = Array.isArray(d.proposals) ? d.proposals : [];
    proposals.forEach((prop: any) => {
      const items = (Array.isArray(prop.items) ? prop.items : []).filter(isValidItem);
      if (items.length > 0) {
        items.forEach((item: any) => {
          const qty = Number(item.qtd || item.quantidade || item.quantity || 1);
          const unitVal = Number(item.valor_unitario || item.unit_value || item.unit || item.value || 0);
          const totalVal = Number(item.valor_total || item.total_value || item.total || 0) || (qty * unitVal);
          const sku = String(item.sku || item.external_code || item.referencia || item.cod || item.item_id || "—");
          allProposalItems.push({
            dealId: String(d.deal_id || "—"),
            proposalId: String(prop.proposal_id || prop.id || "—"),
            name: getItemName(item),
            sku,
            qty,
            unitVal,
            totalVal,
            dealStatus: d.status || "aberto",
          });
        });
      } else if (Number(prop.valor_ps || prop.value || 0) > 0) {
        // No valid items but proposal has value — show summary line
        allProposalItems.push({
          dealId: String(d.deal_id || "—"),
          proposalId: String(prop.proposal_id || prop.id || "—"),
          name: d.product || d.deal_title || prop.sigla || d.pipeline_name || "Proposta",
          sku: "—",
          qty: 1,
          unitVal: Number(prop.valor_ps || prop.value || 0),
          totalVal: Number(prop.valor_ps || prop.value || 0),
          dealStatus: d.status || "aberto",
        });
      }
    });
  });

  // Cross-reference: deals sem proposals embutidos → buscar em ld.proposals_data
  if (allProposalItems.length === 0 && Array.isArray(ld.proposals_data) && (ld.proposals_data as any[]).length > 0) {
    (ld.proposals_data as any[]).forEach((prop: any) => {
      const items = (Array.isArray(prop.items) ? prop.items : []).filter(isValidItem);
      const dealId = String(prop.deal_id || ld.piperun_id || "—");
      const propId = String(prop.id || prop.hash || "—");
      if (items.length > 0) {
        items.forEach((item: any) => {
          const qty = Number(item.quantity || item.qtd || item.quantidade || 1);
          const unitVal = Number(item.value || item.cost || item.valor_unitario || 0);
          const totalVal = Number(item.value || item.cost || item.valor_total || 0) || (qty * unitVal);
          allProposalItems.push({
            dealId, proposalId: propId,
            name: getItemName(item), sku: String(item.code || item.reference || item.sku || "—"),
            qty, unitVal, totalVal, dealStatus: "aberta",
          });
        });
      } else if (Number(prop.value) > 0) {
        allProposalItems.push({
          dealId, proposalId: propId,
          name: "Proposta (resumo)", sku: "—",
          qty: 1, unitVal: Number(prop.value), totalVal: Number(prop.value),
          dealStatus: "aberta",
        });
      }
    });
  }

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
      const items = (Array.isArray(prop.items) ? prop.items : []).filter(isValidItem);
      items.forEach((item: any) => {
        const name = getItemName(item);
        const qty = Number(item.qtd || item.quantidade || item.quantity || 1);
        const total = Number(item.valor_total || item.total_value || item.total || qty * Number(item.valor_unitario || item.unit_value || item.unit || 0));
        if (!productAggMap[name]) productAggMap[name] = { qty: 0, totalVal: 0 };
        productAggMap[name].qty += qty;
        productAggMap[name].totalVal += total;
      });
    });
  });
  // Fallback complementar: wonDeals sem proposals → merge com itens_proposta_parsed
  const dealsWithoutProposals = wonDeals.filter((d: any) => !Array.isArray(d.proposals) || d.proposals.length === 0);
  if (dealsWithoutProposals.length > 0 && ld.itens_proposta_parsed && Array.isArray(ld.itens_proposta_parsed) && ld.itens_proposta_parsed.length > 0) {
    ld.itens_proposta_parsed.forEach((item: any) => {
      const name = item.name || item.item || "Produto";
      // Ignorar itens corrompidos com HTML
      if (name.includes('<') || name.includes('rgb(') || name.length > 100) return;
      const qty = Number(item.qty || item.quantidade || 1);
      if (!productAggMap[name]) productAggMap[name] = { qty: 0, totalVal: 0 };
      productAggMap[name].qty += qty;
    });
  }
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
  // Fallback complementar: wonDeals sem owner → atribuir a proprietario_lead_crm
  const dealsWithoutOwner = wonDeals.filter((d: any) => ownerDisplay(d.owner_name) === "—");
  if (dealsWithoutOwner.length > 0 && ld.proprietario_lead_crm) {
    const name = String(ld.proprietario_lead_crm);
    if (name && name !== "—") {
      if (!sellerAggMap[name]) sellerAggMap[name] = { count: 0, totalVal: 0 };
      sellerAggMap[name].count += dealsWithoutOwner.length;
      sellerAggMap[name].totalVal += dealsWithoutOwner.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);
    }
  }
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

  // ── Flat Proposals Table ──
  const flatProposals: { date: string; sigla: string; funil: string; itens: string; valor: number; frete: string; pgto: string; vendedor: string; status: string }[] = [];
  allDeals.forEach((d: any) => {
    const proposals = Array.isArray(d.proposals) ? d.proposals : [];
    proposals.forEach((prop: any) => {
      const items = (Array.isArray(prop.items) ? prop.items : []).filter(isValidItem);
      const itensSummary = items.length > 0
        ? items.slice(0, 3).map((it: any) => `${it.qtd || it.quantidade || it.quantity || 1}× ${getItemName(it)}`).join(", ") + (items.length > 3 ? ` (+${items.length - 3})` : "")
        : (d.product && d.product !== ld.nome) ? d.product : "—";
      const freteVal = Number(prop.valor_frete || prop.value_freight || 0);
      const freteTipo = prop.tipo_frete || prop.freight_type || "";
      const freteStr = freteVal > 0 ? `${formatBRLFull(freteVal)}${freteTipo ? " " + freteTipo : ""}` : freteTipo || "—";
      const parcelas = prop.parcelas || prop.payment_installments || null;
      const pgtoStr = parcelas ? `${parcelas}×` : "—";
      flatProposals.push({
        date: d.created_at || "",
        sigla: prop.sigla || prop.proposal_id || `PRO${prop.id || "?"}`,
        funil: d.pipeline_name || "—",
        itens: itensSummary,
        valor: Number(prop.valor_ps || prop.value_products || prop.value || 0),
        frete: freteStr,
        pgto: pgtoStr,
        vendedor: prop.vendedor || ownerDisplay(d.owner_name),
        status: d.status || "aberto",
      });
    });
    // Deal without proposals — still show a row
    if (proposals.length === 0 && (Number(d.value) || 0) > 0) {
      flatProposals.push({
        date: d.created_at || "",
        sigla: `Deal #${d.deal_id}`,
        funil: d.pipeline_name || "—",
        itens: (d.product && d.product !== ld.nome) ? d.product : (d.deal_title && d.deal_title !== ld.nome ? d.deal_title : "—"),
        valor: Number(d.value) || 0,
        frete: "—",
        pgto: "—",
        vendedor: ownerDisplay(d.owner_name),
        status: d.status || "aberto",
      });
    }
  });

  // Cross-reference: inject ld.proposals_data into flatProposals when deals lack embedded proposals
  if (flatProposals.every(fp => fp.itens === "—" || !fp.itens) && Array.isArray(ld.proposals_data) && (ld.proposals_data as any[]).length > 0) {
    (ld.proposals_data as any[]).forEach((prop: any) => {
      const items = (Array.isArray(prop.items) ? prop.items : []).filter(isValidItem);
      const itensSummary = items.length > 0
        ? items.slice(0, 3).map((it: any) => `${it.quantity || it.qtd || 1}× ${getItemName(it)}`).join(", ") + (items.length > 3 ? ` (+${items.length - 3})` : "")
        : "—";
      const freteVal = Number(prop.valor_frete || prop.value_freight || 0);
      const freteTipo = prop.tipo_frete || prop.freight_type || "";
      const freteStr = freteVal > 0 ? `${formatBRLFull(freteVal)}${freteTipo ? " " + freteTipo : ""}` : freteTipo || "—";
      const parcelas = prop.parcelas || prop.payment_installments || null;
      flatProposals.push({
        date: prop.created_at || "",
        sigla: prop.sigla || `PRO${prop.id || "?"}`,
        funil: prop.pipeline_name || "—",
        itens: itensSummary,
        valor: Number(prop.value || prop.valor_ps || 0),
        frete: freteStr,
        pgto: parcelas ? `${parcelas}×` : "—",
        vendedor: prop.vendedor || "—",
        status: "aberta",
      });
    });
  }

  // ── Product Mix Intelligence (CRM won deals + E-commerce approved) ──
  interface ProductMixItem {
    cod: string;
    name: string;
    deals: Set<string>;
    qtyTotal: number;
    receita: number;
    timestamps: number[];
  }
  const mixMap: Record<string, ProductMixItem> = {};
  // CRM won deals
  wonDeals.forEach((d: any) => {
    const dealTs = new Date(d.created_at || 0).getTime();
    const proposals = Array.isArray(d.proposals) ? d.proposals : [];
    proposals.forEach((prop: any) => {
      const items = (Array.isArray(prop.items) ? prop.items : []).filter(isValidItem);
      items.forEach((item: any) => {
        const name = getItemName(item);
        const cod = String(item.sku || item.external_code || item.item_id || item.cod || item.referencia || "—");
        const qty = Number(item.qtd || item.quantidade || item.quantity || 1);
        const total = Number(item.valor_total || item.total_value || item.total || qty * Number(item.valor_unitario || item.unit_value || item.unit || 0));
        const key = name.toLowerCase().trim();
        if (!mixMap[key]) {
          mixMap[key] = { cod, name, deals: new Set(), qtyTotal: 0, receita: 0, timestamps: [] };
        }
        mixMap[key].deals.add(String(d.deal_id));
        mixMap[key].qtyTotal += qty;
        mixMap[key].receita += total;
        if (dealTs > 0) mixMap[key].timestamps.push(dealTs);
      });
    });
  });
  // Fallback complementar: wonDeals sem proposals → merge com itens_proposta_parsed no mixMap
  if (dealsWithoutProposals.length > 0 && ld.itens_proposta_parsed && Array.isArray(ld.itens_proposta_parsed) && ld.itens_proposta_parsed.length > 0) {
    const mostRecentWon = wonDeals[0] || allDeals[0];
    ld.itens_proposta_parsed.forEach((item: any) => {
      const name = item.name || item.item || "Produto";
      // Ignorar itens corrompidos com HTML
      if (name.includes('<') || name.includes('rgb(') || name.length > 100) return;
      const key = name.toLowerCase().trim();
      if (!mixMap[key]) {
        mixMap[key] = { cod: "—", name, deals: new Set(), qtyTotal: 0, receita: 0, timestamps: [] };
      }
      mixMap[key].deals.add(String(mostRecentWon?.deal_id || "—"));
      mixMap[key].qtyTotal += Number(item.qty || item.quantidade || 1);
    });
  }
  // E-commerce approved orders → merge into mix
  liApproved.forEach((order: any) => {
    const orderTs = new Date(order.data_criacao || 0).getTime();
    const orderItems: any[] = Array.isArray(order.itens) ? order.itens : [];
    if (orderItems.length > 0) {
      orderItems.forEach((item: any) => {
        const name = String(item.nome || item.name || "Produto E-com");
        const cod = String(item.sku || item.referencia || "—");
        const qty = Number(item.qty || item.quantidade || 1);
        const unitPrice = Number(item.preco || item.valor_unitario || 0);
        const total = qty * unitPrice;
        const key = name.toLowerCase().trim();
        if (!mixMap[key]) {
          mixMap[key] = { cod, name, deals: new Set(), qtyTotal: 0, receita: 0, timestamps: [] };
        }
        mixMap[key].deals.add(`EC-${order.numero}`);
        mixMap[key].qtyTotal += qty;
        mixMap[key].receita += total;
        if (orderTs > 0) mixMap[key].timestamps.push(orderTs);
      });
    } else {
      // No item detail — use itens_resumo as single product
      const resumo = order.itens_resumo || "Produto E-commerce";
      const key = resumo.toLowerCase().trim();
      const total = parseFloat(order.valor_total) || 0;
      if (!mixMap[key]) {
        mixMap[key] = { cod: "—", name: resumo, deals: new Set(), qtyTotal: 0, receita: 0, timestamps: [] };
      }
      mixMap[key].deals.add(`EC-${order.numero}`);
      mixMap[key].qtyTotal += 1;
      mixMap[key].receita += total;
      if (orderTs > 0) mixMap[key].timestamps.push(orderTs);
    }
  });
  // Cross-reference: inject ld.proposals_data items into mixMap for open deals
  if (Object.keys(mixMap).length === 0 && Array.isArray(ld.proposals_data) && (ld.proposals_data as any[]).length > 0) {
    (ld.proposals_data as any[]).forEach((prop: any) => {
      const items = (Array.isArray(prop.items) ? prop.items : []).filter(isValidItem);
      items.forEach((item: any) => {
        const name = getItemName(item);
        const cod = String(item.code || item.reference || item.sku || "—");
        const qty = Number(item.quantity || item.qtd || 1);
        const total = Number(item.value || item.cost || 0);
        const key = name.toLowerCase().trim();
        if (!mixMap[key]) {
          mixMap[key] = { cod, name, deals: new Set(), qtyTotal: 0, receita: 0, timestamps: [] };
        }
        mixMap[key].deals.add(String(prop.deal_id || "open"));
        mixMap[key].qtyTotal += qty;
        mixMap[key].receita += total;
      });
    });
  }
  const totalMixReceita = Object.values(mixMap).reduce((s, m) => s + m.receita, 0);
  const productMixRows = Object.values(mixMap)
    .sort((a, b) => b.receita - a.receita)
    .map((m) => {
      let trend = "— Uma vez";
      const sortedTs = [...m.timestamps].sort();
      if (sortedTs.length >= 3) {
        const midpoint = Math.floor(sortedTs.length / 2);
        const firstHalf = sortedTs.slice(0, midpoint).length;
        const secondHalf = sortedTs.slice(midpoint).length;
        trend = secondHalf > firstHalf ? "↑ Crescendo" : secondHalf === firstHalf ? "→ Recorrente" : "↓ Diminuindo";
      } else if (sortedTs.length === 2) {
        const gap = sortedTs[1] - sortedTs[0];
        trend = gap < 180 * 86400000 ? "→ Recorrente" : "→ Estável";
      }
      return {
        cod: m.cod,
        name: m.name,
        deals: m.deals.size,
        qtyTotal: m.qtyTotal,
        receita: m.receita,
        pctMix: totalMixReceita > 0 ? ((m.receita / totalMixReceita) * 100).toFixed(1) : "0",
        trend,
      };
    });

  // === FALLBACK OBRIGATÓRIO PARA ITENS DE PROPOSTAS ===
  // Quando proposals[].items[] está vazio/null (comum em deals abertos), usa itens_proposta_parsed
  if (allProposalItems.length === 0 && ld.itens_proposta_parsed && Array.isArray(ld.itens_proposta_parsed) && ld.itens_proposta_parsed.length > 0) {
    // Usa o deal mais recente para vincular (se houver múltiplos deals)
    const mostRecentDeal = allDeals.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || {};
    ld.itens_proposta_parsed.forEach((item: any) => {
      allProposalItems.push({
        name: item.name || item.item || "Item sem nome",
        qty: Number(item.qty || item.quantidade || 1),
        
        sku: item.sku || "—",
        unitVal: 0,
        totalVal: 0,
        dealId: mostRecentDeal.deal_id || ld.piperun_id || "—",
        dealStatus: mostRecentDeal.status || ld.status_oportunidade || "aberta",
        proposalId: "—"  // Como vem do parsed flat, não tem proposal individual
      });
    });
  }

  // Sort proposals descending by date, invalid/missing dates go to end
  flatProposals.sort((a, b) => {
    const dateA = a.date?.trim() ? new Date(a.date).getTime() : 0;
    const dateB = b.date?.trim() ? new Date(b.date).getTime() : 0;
    if (isNaN(dateA)) return 1;
    if (isNaN(dateB)) return -1;
    return dateB - dateA;
  });


  // Academy courses
  const astronCourses = Array.isArray(ld.astron_courses_access) ? (ld.astron_courses_access as any[]) : [];

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
        <div className="ltv-block" style={{ minWidth: 260 }}>
          <div className="ltv-label" style={{ fontSize: "0.65rem", letterSpacing: "0.05em", marginBottom: 6 }}>Oportunidades ganhas / Propostas abertas</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
            <div>
              <div className="ltv-val" style={{ fontSize: "1rem", color: "var(--won, #22c55e)" }}>{formatBRL(psWon)}</div>
              <div style={{ fontSize: "0.6rem", opacity: 0.7 }}>Valor de P&S (ganhas)</div>
            </div>
            <div>
              <div className="ltv-val" style={{ fontSize: "1rem", color: "var(--accent-foreground, #3b82f6)" }}>{formatBRL(psOpen)}</div>
              <div style={{ fontSize: "0.6rem", opacity: 0.7 }}>Valor de P&S (abertas)</div>
            </div>
            <div>
              <div className="ltv-val" style={{ fontSize: "0.85rem", opacity: mrrWon === 0 ? 0.4 : 1 }}>{formatBRL(mrrWon)}</div>
              <div style={{ fontSize: "0.6rem", opacity: 0.7 }}>Valor MRR (ganhas)</div>
            </div>
            <div>
              <div className="ltv-val" style={{ fontSize: "0.85rem", opacity: mrrOpenLost === 0 ? 0.4 : 1 }}>{formatBRL(mrrOpenLost)}</div>
              <div style={{ fontSize: "0.6rem", opacity: 0.7 }}>Valor MRR (abertas+perdidas)</div>
            </div>
          </div>
          <div className="ltv-sub" style={{ marginTop: 4 }}>{wonDeals.length} ganho{wonDeals.length !== 1 ? "s" : ""} · {openDeals.length} aberta{openDeals.length !== 1 ? "s" : ""} · {lostDeals.length} perdido{lostDeals.length !== 1 ? "s" : ""}</div>

          {/* E-commerce financial block */}
          {(ltvEcommerce > 0 || ltvAbandono > 0 || ecomWon > 0 || ecomLost > 0) && (
            <>
              <div className="ltv-label" style={{ fontSize: "0.65rem", letterSpacing: "0.05em", marginTop: 10, marginBottom: 6 }}>Vendas E-commerce</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
                <div>
                  <div className="ltv-val" style={{ fontSize: "0.95rem", color: "var(--won, #22c55e)" }}>{formatBRL(ltvEcommerce)}</div>
                  <div style={{ fontSize: "0.6rem", opacity: 0.7 }}>LTV E-commerce ({ecomWon})</div>
                </div>
                <div>
                  <div className="ltv-val" style={{ fontSize: "0.95rem", color: ltvAbandono > 0 ? "var(--hot, #ef4444)" : "var(--muted)" }}>{formatBRL(ltvAbandono)}</div>
                  <div style={{ fontSize: "0.6rem", opacity: 0.7 }}>LTV Abandono ({ecomLost})</div>
                </div>
              </div>
            </>
          )}

          {/* Financeiro Total consolidado */}
          {financeiroTotal > 0 && (
            <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <div style={{ fontSize: "0.6rem", opacity: 0.7, marginBottom: 2 }}>💰 Financeiro Total (CRM + E-com)</div>
              <div className="ltv-val" style={{ fontSize: "1.1rem", color: "var(--won, #22c55e)", fontWeight: 800 }}>{formatBRL(financeiroTotal)}</div>
            </div>
          )}
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
                         <React.Fragment key={`deal-${i}`}>
                          <tr>
                            <td>{formatDate(d.created_at)}</td>
                            <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>#{d.deal_id}</td>
                            <td>{d.pipeline_name || "—"}</td>
                            <td>{d.stage_name || "—"}</td>
                            <td className="green">{formatBRLFull(d.value)}</td>
                            <td>
                              <span className={`status-chip ${isWon(d.status) ? "s-ganho" : isLost(d.status) ? "s-perdido" : "s-aberto"}`}>
                                {isWon(d.status) ? "✓ Ganho" : isLost(d.status) ? "✗ Perdido" : "● Aberto"}
                              </span>
                            </td>
                            <td>{ownerDisplay(d.owner_name)}</td>
                          </tr>
                          {(d.person_id || d.company_id || d.origem) && (
                            <tr>
                              <td colSpan={7} style={{ padding: "2px 16px 4px", borderTop: "none" }}>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--muted2)" }}>
                                  {d.origem ? `📣 Última conversão: ${d.origem}` : ""}
                                  {d.origem && (d.person_id || d.company_id) ? " · " : ""}
                                  {d.person_id ? `👤 Pessoa: #${d.person_id}` : ""}
                                  {d.person_id && d.company_id ? " · " : ""}
                                  {d.company_id ? `🏢 Org: #${d.company_id}` : ""}
                                </span>
                              </td>
                            </tr>
                          )}
                          {proposals.map((prop: any, pi: number) => {
                            const validItems = (Array.isArray(prop.items) ? prop.items : []).filter(isValidItem);
                            const items = validItems;
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
                                            {getItemName(item)}
                                          </span>
                                          <span style={{ fontFamily: "'DM Mono', monospace", minWidth: 36, textAlign: "right" }}>
                                            {item.qtd || item.quantidade || item.quantity || 1}×
                                          </span>
                                          <span style={{ fontFamily: "'DM Mono', monospace", minWidth: 90, textAlign: "right", color: "var(--accent2)" }}>
                                            {formatBRLFull(item.valor_unitario || item.unit_value || item.unit || 0)}
                                          </span>
                                          <span style={{ fontFamily: "'DM Mono', monospace", minWidth: 90, textAlign: "right", color: "var(--text)" }}>
                                            {formatBRLFull(item.valor_total || item.total_value || item.total || ((item.qtd || item.quantidade || item.quantity || 1) * (item.valor_unitario || item.unit_value || item.unit || 0)))}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Tabela de Propostas (flat) ── */}
          {flatProposals.length > 0 && (
            <>
              <div className="sec">📋 Propostas Detalhadas ({flatProposals.length})</div>
              <div style={{ overflowX: "auto", marginBottom: 20, border: "1px solid var(--border2)", borderRadius: 10 }}>
                <table className="deal-table">
                  <thead>
                    <tr>
                      <th>Data</th><th>Proposta</th><th>Funil</th><th>Itens</th><th style={{ textAlign: "right" }}>Valor</th><th>Frete</th><th>Pgto</th><th>Vendedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatProposals.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 10, whiteSpace: "nowrap" }}>{formatDate(p.date)}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{p.sigla}</span>
                            <span className={`status-chip ${isWon(p.status) ? "s-ganho" : isLost(p.status) ? "s-perdido" : "s-aberto"}`} style={{ fontSize: 9, padding: "1px 6px" }}>
                              {isWon(p.status) ? "✓" : isLost(p.status) ? "✗" : "●"}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.funil}</td>
                        <td style={{ fontSize: 10, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted2)" }}>{p.itens}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "right", color: "var(--accent2)" }}>{formatBRLFull(p.valor)}</td>
                        <td style={{ fontSize: 10, color: "var(--muted2)" }}>{p.frete}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{p.pgto}</td>
                        <td style={{ fontSize: 10, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.vendedor}</td>
                      </tr>
                    ))}
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

          {/* ── Product Mix Intelligence ── */}
          {productMixRows.length > 0 && (
            <>
              <div className="sec">📊 Product Mix Intelligence</div>
              <div style={{ overflowX: "auto", marginBottom: 20, border: "1px solid var(--border2)", borderRadius: 10 }}>
                <table className="deal-table">
                  <thead>
                    <tr>
                      <th>SKU</th><th>Produto</th><th style={{ textAlign: "right" }}>Deals</th><th style={{ textAlign: "right" }}>Qtd Total</th><th style={{ textAlign: "right" }}>Receita</th><th style={{ textAlign: "right" }}>% Mix</th><th>Tendência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productMixRows.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted2)" }}>{row.cod}</td>
                        <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "right" }}>{row.deals}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "right" }}>{row.qtyTotal}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "right", color: "var(--accent2)" }}>{formatBRLFull(row.receita)}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "right", fontWeight: 600 }}>{row.pctMix}%</td>
                        <td style={{ fontSize: 11, color: row.trend.startsWith("↑") ? "var(--accent2)" : row.trend.startsWith("↓") ? "var(--hot)" : "var(--muted2)" }}>{row.trend}</td>
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
          <div className="sec">🎓 Academy</div>
          {(astronCourses.length > 0 || ld.astron_courses_total > 0 || ld.astron_status === 'active') ? (
            <>
              <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 11, color: "var(--muted2)", flexWrap: "wrap" }}>
                {ld.astron_created_at && <span>📅 Inscrito em: {formatDate(ld.astron_created_at)}</span>}
                {ld.astron_last_login_at && <span>🕐 Último login: {formatDate(ld.astron_last_login_at)}</span>}
                {ld.astron_status && <span>Status: <strong style={{ color: ld.astron_status === 'active' ? "var(--accent2)" : "var(--text)" }}>{ld.astron_status}</strong></span>}
                {ld.astron_courses_total > 0 && <span>{ld.astron_courses_completed}/{ld.astron_courses_total} cursos concluídos</span>}
                {(() => {
                  const access = Array.isArray(ld.astron_courses_access) ? ld.astron_courses_access : [];
                  const pctEntry = access.find((a: any) => a?.percentual_conclusao != null);
                  if (pctEntry && ld.astron_courses_total === 0) {
                    return <span>📊 Conclusão geral: <strong style={{ color: "var(--blue)" }}>{pctEntry.percentual_conclusao}%</strong></span>;
                  }
                  return null;
                })()}
              </div>
              {ld.astron_login_url && (
                <div style={{ marginBottom: 12, fontSize: 11 }}>
                  <a href={ld.astron_login_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)", textDecoration: "underline" }}>
                    🔗 Acessar Academy
                  </a>
                </div>
              )}
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
          ) : (
            <div style={{ padding: "12px 16px", marginBottom: 20, borderRadius: 10, border: "1px dashed var(--border2)", color: "var(--muted)", fontSize: 12, textAlign: "center" }}>
              Nenhum curso na Academy. Lead ainda não se inscreveu na plataforma de cursos.
            </div>
          )}

          {/* 🛒 E-commerce Loja Integrada */}
          {(() => {
            const liTracking = ld.lojaintegrada_tracking_code || null;
            const liTotalPedidos = liApproved.length || Number(ld.lojaintegrada_total_pedidos_pagos) || 0;
            const liCpf = ld.lojaintegrada_cpf || null;
            const liCep = ld.lojaintegrada_cep || null;
            const hasSomething = liHistorico.length > 0 || ltvEcommerce > 0 || liTracking;

            // Build items for each order from activity_log itens or lojaintegrada_itens_json
            const allLiItens = (() => { try { const raw = ld.lojaintegrada_itens_json; return Array.isArray(raw) ? raw : (typeof raw === "string" ? JSON.parse(raw) : []); } catch { return []; } })();

            return (
              <>
                <div className="sec">🛒 E-commerce Loja Integrada</div>
                {!hasSomething ? (
                  <div style={{ border: "1px dashed var(--border2)", borderRadius: 10, padding: "18px 14px", textAlign: "center", color: "var(--muted2)", fontSize: 12, marginBottom: 20 }}>
                    Nenhum pedido e-commerce registrado
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                      {ltvEcommerce > 0 && (
                        <div style={{ padding: "8px 14px", borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border2)" }}>
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>LTV E-commerce</div>
                          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "var(--accent2)" }}>{formatBRLFull(ltvEcommerce)}</div>
                        </div>
                      )}
                      {liTotalPedidos > 0 && (
                        <div style={{ padding: "8px 14px", borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border2)" }}>
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>Pedidos Pagos</div>
                          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{liTotalPedidos}</div>
                        </div>
                      )}
                      {ltvAbandono > 0 && (
                        <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>LTV Abandono</div>
                          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "var(--hot, #ef4444)" }}>{formatBRLFull(ltvAbandono)}</div>
                        </div>
                      )}
                      {(() => {
                        const cupom = ld.lojaintegrada_cupom_desconto;
                        const cupomStr = cupom && String(cupom) !== "[object Object]" ? String(cupom) : null;
                        return cupomStr ? (
                          <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
                            <div style={{ fontSize: 10, color: "var(--muted)" }}>🎟️ Cupom</div>
                            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "rgb(245,158,11)" }}>{cupomStr}</div>
                          </div>
                        ) : null;
                      })()}
                      {liTracking && (
                        <div style={{ padding: "8px 14px", borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border2)" }}>
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>Rastreio</div>
                          <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace" }}>📦 {String(liTracking)}</div>
                        </div>
                      )}
                      {liCpf && (
                        <div style={{ padding: "8px 14px", borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border2)" }}>
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>CPF</div>
                          <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{String(liCpf)}</div>
                        </div>
                      )}
                      {liCep && (
                        <div style={{ padding: "8px 14px", borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border2)" }}>
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>CEP</div>
                          <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{String(liCep)}</div>
                        </div>
                      )}
                    </div>
                    {liHistorico.length > 0 && (
                      <div style={{ overflowX: "auto", marginBottom: 20, border: "1px solid var(--border2)", borderRadius: 10 }}>
                        <table className="deal-table">
                          <thead>
                            <tr>
                              <th>Pedido</th><th>Data</th><th>SKU</th><th>Item</th><th style={{ textAlign: "right" }}>Qtd</th><th style={{ textAlign: "right" }}>Unit</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Frete</th><th>Meio Pgto</th><th>Forma Pgto</th><th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {liHistorico.map((p: any, pi: number) => {
                              // Resolve items: prefer activity itens[], then lojaintegrada_itens_json, then itens_resumo
                              const orderItems: any[] = Array.isArray(p.itens) && p.itens.length > 0
                                ? p.itens
                                : allLiItens.filter((it: any) => it.pedido_numero === p.numero || it.order_id === p.numero);
                              const cupomOrder = p.cupom_desconto || p.cupom || null;
                              const cupomStr = cupomOrder ? (typeof cupomOrder === "object" ? (cupomOrder.codigo || cupomOrder.nome || "") : String(cupomOrder)) : "";
                              const meioPgto = p.forma_pagamento || p.bandeira || "—";
                              const formaPgto = p.parcelas ? `${p.parcelas}×` : "—";
                              const freteVal = p.valor_envio ? formatBRLFull(p.valor_envio) : "—";
                              const formaEnvio = p.forma_envio || "";

                              if (orderItems.length > 0) {
                                return (
                                  <React.Fragment key={pi}>
                                    {orderItems.map((item: any, ii: number) => {
                                      const itemName = item.nome || item.name || "Produto";
                                      const itemSku = item.sku || item.referencia || "—";
                                      const itemQty = Number(item.qty || item.quantidade || 1);
                                      const itemUnit = Number(item.preco || item.valor_unitario || 0);
                                      const itemTotal = itemQty * itemUnit;
                                      return (
                                        <tr key={`${pi}-${ii}`}>
                                          {ii === 0 && (
                                            <td rowSpan={orderItems.length} style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, verticalAlign: "top" }}>#{p.numero || pi + 1}</td>
                                          )}
                                          {ii === 0 && (
                                            <td rowSpan={orderItems.length} style={{ fontSize: 10, color: "var(--muted2)", verticalAlign: "top" }}>{formatDate(p.data_criacao || p.data || p.created_at)}</td>
                                          )}
                                          <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted2)", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={itemSku}>{itemSku}</td>
                                          <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemName}</td>
                                          <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right" }}>{itemQty}×</td>
                                          <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right", color: "var(--muted2)" }}>{formatBRLFull(itemUnit)}</td>
                                          <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right" }}>{formatBRLFull(itemTotal)}</td>
                                          {ii === 0 && (
                                            <td rowSpan={orderItems.length} style={{ fontFamily: "'DM Mono', monospace", textAlign: "right", fontSize: 10, verticalAlign: "top" }}>{freteVal}{formaEnvio ? ` ${formaEnvio}` : ""}</td>
                                          )}
                                          {ii === 0 && (
                                            <td rowSpan={orderItems.length} style={{ fontSize: 10, verticalAlign: "top" }}>{meioPgto}</td>
                                          )}
                                          {ii === 0 && (
                                            <td rowSpan={orderItems.length} style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, verticalAlign: "top" }}>{formaPgto}</td>
                                          )}
                                          {ii === 0 && (
                                            <td rowSpan={orderItems.length} style={{ verticalAlign: "top" }}>
                                              <span className={`status-chip ${p.situacao_aprovado === true ? "s-ganho" : p.situacao_cancelado === true ? "s-perdido" : "s-aberto"}`}>
                                                {p.situacao_nome || p.status || "—"}
                                              </span>
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              }

                              // No item detail — single row with itens_resumo
                              return (
                                <tr key={pi}>
                                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>#{p.numero || pi + 1}</td>
                                  <td style={{ fontSize: 10, color: "var(--muted2)" }}>{formatDate(p.data_criacao || p.data || p.created_at)}</td>
                                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted2)" }}>—</td>
                                  <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.itens_resumo || "—"}</td>
                                  <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right" }}>—</td>
                                  <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right", color: "var(--muted2)" }}>—</td>
                                  <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right" }}>{formatBRLFull(p.valor_total || p.valor || 0)}</td>
                                  <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right", fontSize: 10 }}>{freteVal}{formaEnvio ? ` ${formaEnvio}` : ""}</td>
                                  <td style={{ fontSize: 10 }}>{meioPgto}</td>
                                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{formaPgto}</td>
                                  <td>
                                    <span className={`status-chip ${p.situacao_aprovado === true ? "s-ganho" : p.situacao_cancelado === true ? "s-perdido" : "s-aberto"}`}>
                                      {p.situacao_nome || p.status || "—"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </>
            );
          })()}

          {allProposalItems.length > 0 && (
            <>
              <div className="sec">📦 Itens de Propostas ({allProposalItems.length})</div>
              <div style={{ overflowX: "auto", marginBottom: 20, border: "1px solid var(--border2)", borderRadius: 10 }}>
                <table className="deal-table">
                  <thead>
                    <tr>
                      <th>Deal</th><th>SKU</th><th>Item</th><th>Qtd</th><th>Unit</th><th>Total</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allProposalItems.map((item, ii) => (
                      <tr key={ii}>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>#{item.dealId}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--muted2)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.sku}>{item.sku}</td>
                        <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right" }}>{item.qty}×</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right", color: "var(--muted2)" }}>{formatBRLFull(item.unitVal)}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", textAlign: "right", color: "var(--text)" }}>{formatBRLFull(item.totalVal)}</td>
                        <td>
                          <span className={`status-chip ${isWon(item.dealStatus) ? "s-ganho" : isLost(item.dealStatus) ? "s-perdido" : "s-aberto"}`}>
                            {isWon(item.dealStatus) ? "✓ Ganho" : isLost(item.dealStatus) ? "✗ Perdido" : "● Aberto"}
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
          <div className="sec">🔧 Chamados de Suporte Técnico</div>
          {support_tickets.length > 0 ? (
            <>
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
          ) : (
            <div style={{ padding: "12px 16px", marginBottom: 20, borderRadius: 10, border: "1px dashed var(--border2)", color: "var(--muted)", fontSize: 12, textAlign: "center" }}>
              Nenhum chamado de suporte técnico registrado para este lead.
            </div>
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
          ) : cog?.ai_narrative ? (
            <div className="cog-card" style={{ marginTop: 16 }}>
              <h4>🧠 Análise Cognitiva</h4>
              <p style={{ lineHeight: 1.7, fontSize: 13, whiteSpace: "pre-line" }}>{cog.ai_narrative}</p>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                ⚠️ Formato simplificado. Clique "↺ Reanalisar" para gerar cards estruturados.
              </div>
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

      {/* ── CS — Treinamentos ── */}
      {activeTab === "cs" && (
        <CsEnrollmentsTab leadId={lead.id} />
      )}
    </div>
  );
}

// ─── CS Tab Component ───
function CsEnrollmentsTab({ leadId }: { leadId: string }) {
  const [enrollments, setEnrollments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editId, setEditId] = React.useState<string | null>(null);

  const API_BASE = "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1";

  React.useEffect(() => {
    loadEnrollments();
  }, [leadId]);

  const loadEnrollments = async () => {
    setLoading(true);
    try {
      const token = (await (window as any).__supabase_session?.())?.access_token;
      const headers: Record<string, string> = {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk',
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        `https://okeogjgqijbfkudfjadz.supabase.co/rest/v1/smartops_course_enrollments?lead_id=eq.${leadId}&select=id,status,enrolled_at,validated_at,numero_contrato,numero_proposta,instagram,tipo_entrega,rastreamento,person_name,especialidade,area_atuacao,deal_title,deal_value,equipment_data,proposal_items_snapshot,wa_sent_at,wa_error,notes,course:smartops_courses(title,modality,instructor_name),turma:smartops_course_turmas(label),companions:smartops_enrollment_companions(*)&order=enrolled_at.desc`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data);
      }
    } catch (e) {
      console.warn('[CS tab]', e);
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async (enrollment: any, form: any) => {
    try {
      const changed: Record<string, any> = {};
      if (form.status !== enrollment.status) changed.status = form.status;
      if (form.numero_contrato !== (enrollment.numero_contrato || '')) changed.numero_contrato = form.numero_contrato || null;
      if (form.numero_proposta !== (enrollment.numero_proposta || '')) changed.numero_proposta = form.numero_proposta || null;
      if (form.instagram !== (enrollment.instagram || '')) changed.instagram = form.instagram || null;
      if (form.tipo_entrega !== (enrollment.tipo_entrega || '')) changed.tipo_entrega = form.tipo_entrega || null;
      if (form.rastreamento !== (enrollment.rastreamento || '')) changed.rastreamento = form.tipo_entrega === 'enviar' ? (form.rastreamento || null) : null;
      if (form.notes !== (enrollment.notes || '')) changed.notes = form.notes || null;
      if (JSON.stringify(form.equipment_data) !== JSON.stringify(enrollment.equipment_data || {})) changed.equipment_data = form.equipment_data;

      if (Object.keys(changed).length === 0) { setEditId(null); return; }

      const token = (await (window as any).__supabase_session?.())?.access_token;
      const headers: Record<string, string> = {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk',
        'Content-Type': 'application/json', 'Prefer': 'return=minimal',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(
        `https://okeogjgqijbfkudfjadz.supabase.co/rest/v1/smartops_course_enrollments?id=eq.${enrollment.id}`,
        { method: 'PATCH', headers, body: JSON.stringify({ ...changed, updated_at: new Date().toISOString() }) }
      );

      if (changed.instagram) {
        await fetch(
          `https://okeogjgqijbfkudfjadz.supabase.co/rest/v1/lia_attendances?id=eq.${leadId}&merged_into=is.null`,
          { method: 'PATCH', headers, body: JSON.stringify({ instagram: changed.instagram }) }
        );
      }

      setEditId(null);
      loadEnrollments();
    } catch (e) {
      console.warn('[CS save]', e);
    }
  };

  if (loading) return <div className="tab-content"><div style={{ color: "var(--muted)", fontSize: 12 }}>Carregando treinamentos...</div></div>;
  if (!enrollments.length) return <div className="tab-content"><div style={{ color: "var(--muted)", fontSize: 12 }}>Nenhum treinamento agendado.</div></div>;

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    agendado: { label: 'Agendado', color: '#3b82f6' }, confirmado: { label: 'Confirmado', color: '#8b5cf6' },
    presente: { label: 'Presente', color: '#22c55e' }, ausente: { label: 'Ausente', color: '#ef4444' },
    cancelado: { label: 'Cancelado', color: '#6b7280' },
  };

  return (
    <div className="tab-content" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {enrollments.map((e: any) => {
        const st = STATUS_MAP[e.status] || { label: e.status, color: '#888' };
        const isEditing = editId === e.id;
        const equipEntries = Object.entries(e.equipment_data || {}).filter(([, v]: any) => v?.serial);
        const companionNames = (e.companions || []).map((c: any) => c.name).filter(Boolean).join(', ');
        const waStatus = e.wa_sent_at ? `✓ enviado em ${new Date(e.wa_sent_at).toLocaleDateString('pt-BR')}` : e.wa_error ? `✗ erro` : '— não enviado';

        if (isEditing) return <CsEditForm key={e.id} enrollment={e} onSave={(form: any) => saveEdit(e, form)} onCancel={() => setEditId(null)} />;

        return (
          <div key={e.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <strong>📚 {e.course?.title || 'Curso'}</strong>
                {e.turma?.label && <span style={{ color: "var(--muted)", marginLeft: 8 }}>— {e.turma.label}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: st.color, color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>{st.label}</span>
                <button onClick={() => setEditId(e.id)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>✏ Editar</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", fontSize: 12, color: "var(--muted)" }}>
              <div>Participante: <span style={{ color: "var(--foreground)" }}>{e.person_name}</span></div>
              {e.numero_contrato && <div>Contrato: <span style={{ color: "var(--foreground)" }}>{e.numero_contrato}</span></div>}
              {e.numero_proposta && <div>Proposta: <span style={{ color: "var(--foreground)" }}>{e.numero_proposta}</span></div>}
              {e.instagram && <div>Instagram: <span style={{ color: "var(--foreground)" }}>{e.instagram}</span></div>}
              {e.tipo_entrega && <div>Entrega: <span style={{ color: "var(--foreground)" }}>{e.tipo_entrega.toUpperCase()}{e.rastreamento ? ` — ${e.rastreamento}` : ''}</span></div>}
              {e.deal_title && <div>Deal: <span style={{ color: "var(--foreground)" }}>{e.deal_title}</span></div>}
            </div>
            {equipEntries.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <span style={{ color: "var(--muted)" }}>Equipamentos:</span>
                {equipEntries.map(([key, entry]: [string, any]) => (
                  <div key={key} style={{ marginLeft: 12 }}>• {entry.item_nome || key}: {entry.serial}{entry.ativacao ? ` (${entry.ativacao})` : ''}</div>
                ))}
              </div>
            )}
            {companionNames && <div style={{ marginTop: 4, fontSize: 12 }}>Acompanhantes: {companionNames}</div>}
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>WA: {waStatus}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── CS Edit Form (inline) ───
function CsEditForm({ enrollment, onSave, onCancel }: { enrollment: any; onSave: (form: any) => void; onCancel: () => void }) {
  const [form, setForm] = React.useState({
    status: enrollment.status || 'agendado',
    numero_contrato: enrollment.numero_contrato || '',
    numero_proposta: enrollment.numero_proposta || '',
    instagram: enrollment.instagram || '',
    tipo_entrega: enrollment.tipo_entrega || '',
    rastreamento: enrollment.rastreamento || '',
    notes: enrollment.notes || '',
    equipment_data: { ...(enrollment.equipment_data || {}) },
  });

  const statuses = ['agendado', 'confirmado', 'presente', 'ausente', 'cancelado'];
  const equipEntries = Object.entries(form.equipment_data).filter(([, v]: any) => v);
  const inputStyle = { border: "1px solid var(--border)", borderRadius: 4, padding: "4px 8px", fontSize: 12, width: "100%", background: "var(--background)" } as const;

  return (
    <div style={{ border: "1px solid var(--primary)", borderRadius: 8, padding: 12, fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Editando — {enrollment.course?.title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
        <div>
          <div style={{ color: "var(--muted)", marginBottom: 2 }}>Status</div>
          <select value={form.status} onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value }))} style={inputStyle}>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div><div style={{ color: "var(--muted)", marginBottom: 2 }}>Contrato</div><input style={inputStyle} value={form.numero_contrato} onChange={(ev) => setForm((f) => ({ ...f, numero_contrato: ev.target.value }))} /></div>
        <div><div style={{ color: "var(--muted)", marginBottom: 2 }}>Proposta</div><input style={inputStyle} value={form.numero_proposta} onChange={(ev) => setForm((f) => ({ ...f, numero_proposta: ev.target.value }))} /></div>
        <div><div style={{ color: "var(--muted)", marginBottom: 2 }}>Instagram</div><input style={inputStyle} value={form.instagram} onChange={(ev) => setForm((f) => ({ ...f, instagram: ev.target.value }))} placeholder="@usuario" /></div>
        <div>
          <div style={{ color: "var(--muted)", marginBottom: 2 }}>Entrega</div>
          <div style={{ display: "flex", gap: 4 }}>
            {['enviar', 'retirar'].map((t) => (
              <button key={t} onClick={() => setForm((f) => ({ ...f, tipo_entrega: t, ...(t === 'retirar' ? { rastreamento: '' } : {}) }))}
                style={{ padding: "2px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer", border: "1px solid var(--border)", background: form.tipo_entrega === t ? "var(--primary)" : "transparent", color: form.tipo_entrega === t ? "#fff" : "inherit" }}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {form.tipo_entrega === 'enviar' && (
          <div><div style={{ color: "var(--muted)", marginBottom: 2 }}>Rastreamento</div><input style={inputStyle} value={form.rastreamento} onChange={(ev) => setForm((f) => ({ ...f, rastreamento: ev.target.value }))} /></div>
        )}
        <div style={{ gridColumn: "1 / -1" }}><div style={{ color: "var(--muted)", marginBottom: 2 }}>Observações</div><textarea style={{ ...inputStyle, minHeight: 40 }} value={form.notes} onChange={(ev) => setForm((f) => ({ ...f, notes: ev.target.value }))} /></div>
      </div>
      {equipEntries.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <div style={{ color: "var(--muted)", marginBottom: 4 }}>Equipamentos</div>
          {equipEntries.map(([key, entry]: [string, any]) => (
            <div key={key} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <span style={{ minWidth: 80, color: "var(--muted)" }}>{entry?.item_nome || key}:</span>
              <input style={{ ...inputStyle, flex: 1 }} value={entry?.serial || ''} placeholder="Serial"
                onChange={(ev) => setForm((f) => ({ ...f, equipment_data: { ...f.equipment_data, [key]: { ...entry, serial: ev.target.value } } }))} />
              <input style={{ ...inputStyle, width: 120 }} type="date" value={entry?.ativacao || ''}
                onChange={(ev) => setForm((f) => ({ ...f, equipment_data: { ...f.equipment_data, [key]: { ...entry, ativacao: ev.target.value } } }))} />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => onSave(form)} style={{ padding: "4px 16px", borderRadius: 4, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12 }}>Salvar</button>
        <button onClick={onCancel} style={{ padding: "4px 16px", borderRadius: 4, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 12 }}>Cancelar</button>
      </div>
    </div>
  );
}
