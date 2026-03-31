import { useEffect, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Lead, ParsedProposalItem } from "./KanbanLeadCard";

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch { return d; }
}
function fmtDateTime(d: string | null | undefined): string | null {
  if (!d) return null;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const mins = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch { return d; }
}

interface KanbanLeadDetailProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

function DetailRow({ label, value, emoji }: { label: string; value: string | number | boolean | null | undefined; emoji?: string }) {
  if (value === null || value === undefined || value === "") return null;
  const display = typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value);
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{emoji && `${emoji} `}{label}</span>
      <span className="font-medium text-right max-w-[60%] break-words">{display}</span>
    </div>
  );
}

/** Always visible row — shows "—" for empty values */
function TrackingRow({ label, value, emoji }: { label: string; value: string | number | boolean | null | undefined; emoji?: string }) {
  const isEmpty = value === null || value === undefined || value === "";
  const display = isEmpty ? "—" : typeof value === "boolean" ? (value ? "✔" : "✗") : String(value);
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{emoji && `${emoji} `}{label}</span>
      <span className={`font-medium text-right max-w-[60%] break-words ${isEmpty ? "text-muted-foreground/50" : ""}`}>{display}</span>
    </div>
  );
}

function EquipRow({ emoji, label, name, serial, date }: { emoji: string; label: string; name: string | null; serial: string | null; date: string | null }) {
  if (!name) return null;
  return (
    <div className="text-xs py-1 space-y-0.5">
      <div className="flex justify-between">
        <span className="text-muted-foreground">{emoji} {label}</span>
        <span className="font-medium text-right max-w-[60%] truncate">{name}</span>
      </div>
      <div className="flex gap-3 pl-5 text-[10px] text-muted-foreground">
        <span>Nº Série: {serial || "—"}</span>
        <span>Ativação: {date ? fmtDate(date) : "—"}</span>
      </div>
    </div>
  );
}

/** Collapsible section that auto-hides when no children render */
function Section({ title, emoji, children, defaultOpen = false }: { title: string; emoji: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase py-1.5 hover:text-foreground transition-colors">
        <span>{emoji} {title}</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Helpers to safely read dynamic lead fields
function s(lead: Lead, key: string): string | null {
  const v = lead[key];
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}
function n(lead: Lead, key: string): number | null {
  const v = lead[key];
  if (v === null || v === undefined) return null;
  return Number(v);
}
function b(lead: Lead, key: string): boolean | null {
  const v = lead[key];
  if (v === null || v === undefined) return null;
  return Boolean(v);
}

// Check if at least one field in a group has a value
function hasAny(lead: Lead, keys: string[]): boolean {
  return keys.some((k) => {
    const v = lead[k];
    return v !== null && v !== undefined && v !== "" && v !== false && v !== 0;
  });
}

interface MsgLog {
  id: string;
  tipo: string | null;
  mensagem_preview: string | null;
  status: string;
  data_envio: string | null;
  whatsapp_number: string | null;
}

const SYSTEM_TO_SELLER_TYPES = ["escalation_vendedor", "escalation_especialista", "escalation_cs_suporte", "ecommerce_order_created"];
const SELLER_TO_LEAD_TYPES = ["handoff_seller_to_lead", "handoff_unanswered", "proactive_primeira_duvida", "waleads_text", "sellflux_text"];

function MessageItem({ msg }: { msg: MsgLog }) {
  const [expanded, setExpanded] = useState(false);
  const preview = msg.mensagem_preview || "-";
  const needsTruncate = preview.length > 200;

  return (
    <div className="border rounded-md p-2 text-xs space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground whitespace-nowrap">
          {msg.data_envio ? new Date(msg.data_envio).toLocaleString("pt-BR") : "-"}
        </span>
        <div className="flex items-center gap-1">
          {msg.tipo && <Badge variant="outline" className="text-[10px]">{msg.tipo}</Badge>}
          <Badge
            variant={msg.status === "enviado" ? "default" : msg.status === "erro" ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {msg.status}
          </Badge>
        </div>
      </div>
      <p
        className={`text-foreground ${!expanded && needsTruncate ? "line-clamp-3 cursor-pointer" : "cursor-pointer"}`}
        onClick={() => needsTruncate && setExpanded(!expanded)}
      >
        {expanded ? preview : preview.slice(0, 200)}{!expanded && needsTruncate ? "…" : ""}
      </p>
    </div>
  );
}

function MessageSection({ title, emoji, messages }: { title: string; emoji: string; messages: MsgLog[] }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase py-1 hover:text-foreground transition-colors">
        <span>{emoji} {title} ({messages.length})</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-1">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhuma mensagem</p>
        ) : (
          messages.map((m) => <MessageItem key={m.id} msg={m} />)
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface AgentInteraction {
  id: string;
  created_at: string;
  user_message: string;
  agent_response: string | null;
  feedback: string | null;
  lang: string | null;
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

interface TimelineEvent {
  id: string;
  event_type: string;
  event_timestamp: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  event_data: Record<string, unknown>;
  source_channel: string | null;
  value_numeric: number | null;
}

const TIMELINE_EMOJI: Record<string, string> = {
  crm_deal_created: "🆕",
  crm_deal_updated: "🔄",
  crm_deal_won: "✅",
  crm_deal_lost: "❌",
  ecommerce_order_created: "🛒",
  ecommerce_order_paid: "💳",
  ecommerce_order_cancelled: "🚫",
  ecommerce_order_invoiced: "📦",
  ecommerce_order_delivered: "🚚",
  ecommerce_boleto_generated: "🏦",
  ecommerce_boleto_expired: "⏰",
  lia_conversation: "💬",
  whatsapp_inbound: "📱",
  whatsapp_outbound: "📤",
  form_submission: "📝",
  sellflux_sync: "🔗",
  astron_enrollment: "🎓",
  cognitive_analysis: "🧠",
};

const TIMELINE_LABEL: Record<string, string> = {
  crm_deal_created: "Deal criado no CRM",
  crm_deal_updated: "Deal atualizado",
  crm_deal_won: "Deal ganho 🎉",
  crm_deal_lost: "Deal perdido",
  ecommerce_order_created: "Pedido criado",
  ecommerce_order_paid: "Pagamento aprovado",
  ecommerce_order_cancelled: "Pedido cancelado",
  ecommerce_order_invoiced: "Pedido enviado",
  ecommerce_order_delivered: "Pedido entregue",
  ecommerce_boleto_generated: "Boleto gerado",
  ecommerce_boleto_expired: "Boleto vencido",
};

function TimelineItem({ event }: { event: TimelineEvent }) {
  const emoji = TIMELINE_EMOJI[event.event_type] || "📌";
  const label = TIMELINE_LABEL[event.event_type] || event.event_type.replace(/_/g, " ");
  const data = event.event_data || {};
  const isNew = Date.now() - new Date(event.event_timestamp).getTime() < 60_000;

  return (
    <div className={`relative pl-6 pb-3 border-l-2 ${isNew ? "border-primary animate-pulse" : "border-muted-foreground/20"}`}>
      <div className={`absolute -left-2.5 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isNew ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {emoji}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {new Date(event.event_timestamp).toLocaleString("pt-BR")}
        {event.source_channel && (
          <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">{event.source_channel}</Badge>
        )}
      </div>
      <div className="text-xs font-medium">{label}</div>
      {event.entity_name && (
        <div className="text-[10px] text-muted-foreground truncate">{event.entity_name}</div>
      )}
      {event.value_numeric != null && event.value_numeric > 0 && (
        <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-0.5">
          {formatCurrency(event.value_numeric)}
        </Badge>
      )}
      {data.stage && (
        <div className="text-[10px] text-muted-foreground">Etapa: {String(data.stage)}</div>
      )}
      {data.owner && (
        <div className="text-[10px] text-muted-foreground">👤 {String(data.owner)}</div>
      )}
      {data.produtos && Array.isArray(data.produtos) && data.produtos.length > 0 && (
        <div className="text-[10px] text-muted-foreground">🏷️ {(data.produtos as string[]).join(", ")}</div>
      )}
    </div>
  );
}

export function KanbanLeadDetail({ lead, open, onClose }: KanbanLeadDetailProps) {
  const [systemMsgs, setSystemMsgs] = useState<MsgLog[]>([]);
  const [sellerMsgs, setSellerMsgs] = useState<MsgLog[]>([]);
  const [liaInteractions, setLiaInteractions] = useState<AgentInteraction[]>([]);
  const [whatsappMsgs, setWhatsappMsgs] = useState<WhatsAppMsg[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    if (!lead?.id || !open) {
      setSystemMsgs([]);
      setSellerMsgs([]);
      setLiaInteractions([]);
      setWhatsappMsgs([]);
      setTimelineEvents([]);
      return;
    }
    setLoadingMsgs(true);

    const p1 = supabase
      .from("message_logs")
      .select("id, tipo, mensagem_preview, status, data_envio, whatsapp_number")
      .eq("lead_id", lead.id)
      .order("data_envio", { ascending: false })
      .limit(50);

    const p2 = supabase
      .from("agent_interactions")
      .select("id, created_at, user_message, agent_response, feedback, lang")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(100);

    const p3 = supabase
      .from("whatsapp_inbox")
      .select("id, created_at, message_text, direction, intent_detected, media_url, media_type")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(100);

    const p4 = supabase
      .from("lead_activity_log")
      .select("id, event_type, event_timestamp, entity_type, entity_id, entity_name, event_data, source_channel, value_numeric")
      .eq("lead_id", lead.id)
      .order("event_timestamp", { ascending: false })
      .limit(200);

    Promise.all([p1, p2, p3, p4]).then(([r1, r2, r3, r4]) => {
      const logs = (r1.data || []) as MsgLog[];
      setSystemMsgs(logs.filter((l) => SYSTEM_TO_SELLER_TYPES.includes(l.tipo || "")));
      setSellerMsgs(logs.filter((l) => SELLER_TO_LEAD_TYPES.includes(l.tipo || "")));
      setLiaInteractions((r2.data || []) as AgentInteraction[]);
      setWhatsappMsgs((r3.data || []) as WhatsAppMsg[]);
      setTimelineEvents((r4.data || []) as TimelineEvent[]);
      setLoadingMsgs(false);
    });

    // ─── Realtime subscription for new timeline events ───
    const channel = supabase
      .channel(`timeline-${lead.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lead_activity_log",
          filter: `lead_id=eq.${lead.id}`,
        },
        (payload) => {
          const newEvent = payload.new as TimelineEvent;
          setTimelineEvents((prev) => [newEvent, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lead?.id, open]);

  if (!lead) return null;

  const PESSOA_KEYS = ["pessoa_cpf", "pessoa_cargo", "pessoa_genero", "pessoa_nascimento", "pessoa_linkedin", "pessoa_facebook", "pessoa_observation", "pessoa_piperun_id"];
  const EMPRESA_KEYS = ["empresa_nome", "empresa_razao_social", "empresa_cnpj", "empresa_ie", "empresa_segmento", "empresa_porte", "empresa_situacao", "empresa_website", "empresa_cnae", "empresa_piperun_id"];
  const SDR_KEYS = ["sdr_scanner_interesse", "sdr_impressora_interesse", "sdr_software_cad_interesse", "sdr_caracterizacao_interesse", "sdr_cursos_interesse", "sdr_dentistica_interesse", "sdr_insumos_lab_interesse", "sdr_pos_impressao_interesse", "sdr_solucoes_interesse", "sdr_marca_impressora_param", "sdr_modelo_impressora_param", "sdr_resina_param", "sdr_suporte_equipamento", "sdr_suporte_tipo", "sdr_suporte_descricao"];
  const LOJA_KEYS = ["lojaintegrada_cliente_id", "lojaintegrada_ultimo_pedido_numero", "lojaintegrada_ultimo_pedido_data", "lojaintegrada_ultimo_pedido_valor", "lojaintegrada_ultimo_pedido_status", "lojaintegrada_forma_pagamento", "lojaintegrada_forma_envio", "lojaintegrada_endereco", "lojaintegrada_numero", "lojaintegrada_complemento", "lojaintegrada_bairro", "lojaintegrada_cep", "lojaintegrada_referencia", "lojaintegrada_cupom_desconto", "lojaintegrada_utm_campaign", "lojaintegrada_sexo", "lojaintegrada_data_nascimento", "lojaintegrada_cliente_obs"];
  const ASTRON_KEYS = ["astron_user_id", "astron_status", "astron_nome", "astron_email", "astron_phone", "astron_plans_active", "astron_courses_total", "astron_courses_completed", "astron_last_login_at", "astron_login_url", "astron_created_at", "astron_synced_at"];
  const PIPERUN_EXT_KEYS = ["piperun_pipeline_name", "piperun_stage_name", "piperun_title", "piperun_description", "piperun_observation", "piperun_hash", "piperun_status", "piperun_probability", "piperun_value_mrr", "piperun_lead_time", "piperun_frozen", "piperun_frozen_at", "piperun_last_contact_at", "piperun_stage_changed_at", "piperun_closed_at", "piperun_probably_closed_at", "piperun_pipeline_id", "piperun_stage_id", "piperun_origin_id", "piperun_owner_id", "piperun_deleted"];
  const SELLFLUX_KEYS = ["ativo_scan", "ativo_print", "ativo_cad", "ativo_cad_ia", "ativo_cura", "ativo_insumos", "ativo_notebook", "ativo_smart_slice", "data_ultima_compra_scan", "data_ultima_compra_print", "data_ultima_compra_cad", "data_ultima_compra_cad_ia", "data_ultima_compra_cura", "data_ultima_compra_insumos", "data_ultima_compra_notebook", "data_ultima_compra_smart_slice", "data_contrato", "codigo_contrato", "id_cliente_smart", "data_treinamento"];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">{lead.nome}</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={syncing}
              title="Sincronizar PipeRun"
              onClick={handleSyncPipeRun}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{lead.lead_status}</Badge>
            {lead.temperatura_lead && (
              <Badge variant="secondary">
                {lead.temperatura_lead === "hot" ? "🔥 Quente" : lead.temperatura_lead === "warm" ? "🌡️ Morno" : "❄️ Frio"}
              </Badge>
            )}
            {lead.score != null && lead.score > 0 && (
              <Badge className="bg-primary/10 text-primary">{lead.score} pts</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {/* ===== RESUMO FINANCEIRO (hero card) ===== */}
          {(n(lead, "ltv_total") != null && n(lead, "ltv_total")! > 0) || (n(lead, "proposals_total_value") != null && n(lead, "proposals_total_value")! > 0) || (n(lead, "intelligence_score_total") != null && n(lead, "intelligence_score_total")! > 0) ? (
            <>
              <div className="rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10 p-3 space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">💎 Resumo Financeiro</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-background p-2">
                    <div className="text-lg font-bold text-primary">{n(lead, "ltv_total") ? formatCurrency(n(lead, "ltv_total")!) : "—"}</div>
                    <div className="text-[10px] text-muted-foreground">LTV Total</div>
                  </div>
                  <div className="rounded-md bg-background p-2">
                    <div className="text-lg font-bold">{n(lead, "total_deals") || 0}</div>
                    <div className="text-[10px] text-muted-foreground">Deals</div>
                  </div>
                  <div className="rounded-md bg-background p-2">
                    <div className="text-lg font-bold">{n(lead, "intelligence_score_total") || lead.score || 0}</div>
                    <div className="text-[10px] text-muted-foreground">Score</div>
                  </div>
                </div>
                {s(lead, "anchor_product") && (
                  <div className="text-xs text-muted-foreground">🏷️ Produto âncora: <span className="font-medium text-foreground">{s(lead, "anchor_product")}</span></div>
                )}
                {n(lead, "proposals_total_value") != null && n(lead, "proposals_total_value")! > 0 && n(lead, "proposals_total_value") !== n(lead, "ltv_total") && (
                  <div className="text-xs text-muted-foreground">📊 Propostas: <span className="font-medium text-foreground">{formatCurrency(n(lead, "proposals_total_value")!)}</span></div>
                )}
              </div>
              <Separator />
            </>
          ) : null}

          {/* ===== TIMELINE ATIVA (real-time) ===== */}
          <Section title={`Timeline (${timelineEvents.length})`} emoji="⏱️" defaultOpen>
            {loadingMsgs && timelineEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">Carregando timeline...</p>
            ) : timelineEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum evento registrado ainda. Eventos de CRM, E-commerce, LIA e WhatsApp aparecerão aqui em tempo real.</p>
            ) : (
              <div className="max-h-[350px] overflow-y-auto pr-1">
                {timelineEvents.map((event) => (
                  <TimelineItem key={event.id} event={event} />
                ))}
              </div>
            )}
          </Section>
          <Separator />

          {/* ===== DEALS HISTORY (piperun_deals_history) ===== */}
          {lead.piperun_deals_history && Array.isArray(lead.piperun_deals_history) && (lead.piperun_deals_history as Record<string, unknown>[]).length > 0 && (
            <>
              <Section title={`Histórico de Deals (${(lead.piperun_deals_history as Record<string, unknown>[]).length})`} emoji="📈" defaultOpen>
                <div className="space-y-2">
                  {(lead.piperun_deals_history as Record<string, unknown>[]).map((deal, i) => (
                    <div key={i} className="rounded-md border p-2 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{String(deal.product || deal.title || `Deal #${i + 1}`)}</span>
                        {deal.value != null && <span className="font-bold text-primary">{formatCurrency(Number(deal.value))}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                        {deal.date && <span>📅 {fmtDate(String(deal.date))}</span>}
                        {deal.owner_name && <span>👤 {String(deal.owner_name)}</span>}
                        {deal.status && <Badge variant="outline" className="text-[9px] px-1 py-0">{String(deal.status)}</Badge>}
                      </div>
                      {deal.items && Array.isArray(deal.items) && (deal.items as Record<string, unknown>[]).length > 0 && (
                        <div className="pl-2 border-l-2 border-primary/20 space-y-0.5 mt-1">
                          {(deal.items as Record<string, unknown>[]).map((item, j) => (
                            <div key={j} className="flex justify-between text-[10px]">
                              <span>{String(item.name || item.product_name || '—')}</span>
                              <span className="text-muted-foreground">x{Number(item.qty || item.quantity || 1)} · {item.total != null ? formatCurrency(Number(item.total)) : '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {deal.freight_type && (
                        <div className="text-[10px] text-muted-foreground">🚚 {String(deal.freight_type)} {deal.value_freight != null ? `· ${formatCurrency(Number(deal.value_freight))}` : ''}</div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
              <Separator />
            </>
          )}

          {/* ===== INTELLIGENCE SCORE ===== */}
          {lead.intelligence_score && typeof lead.intelligence_score === 'object' && (
            <>
              <Section title="Intelligence Score" emoji="🎯">
                {(() => {
                  const is = lead.intelligence_score as Record<string, unknown>;
                  return (
                    <div className="space-y-1">
                      <DetailRow label="Total" value={n(lead, "intelligence_score_total")?.toString()} emoji="📊" />
                      {is.sales_heat != null && <DetailRow label="Sales Heat" value={`${Number(is.sales_heat).toFixed(1)}`} emoji="🔥" />}
                      {is.technical_maturity != null && <DetailRow label="Tech Maturity" value={`${Number(is.technical_maturity).toFixed(1)}`} emoji="⚙️" />}
                      {is.behavioral_engagement != null && <DetailRow label="Engagement" value={`${Number(is.behavioral_engagement).toFixed(1)}`} emoji="💬" />}
                      {is.purchase_power != null && <DetailRow label="Purchase Power" value={`${Number(is.purchase_power).toFixed(1)}`} emoji="💰" />}
                      {is.updated_at && <DetailRow label="Calculado em" value={fmtDateTime(String(is.updated_at))} />}
                    </div>
                  );
                })()}
              </Section>
              <Separator />
            </>
          )}

          {/* ===== CONTATO (always open) ===== */}
          <Section title="Contato" emoji="📇" defaultOpen>
            <DetailRow label="Email" value={lead.email} emoji="📧" />
            <DetailRow label="Telefone" value={lead.telefone_normalized} emoji="📱" />
            <DetailRow label="Cidade/UF" value={[lead.cidade, lead.uf].filter(Boolean).join(" - ") || null} emoji="📍" />
            <DetailRow label="1º Contato" value={fmtDateTime(s(lead, "data_primeiro_contato"))} emoji="📅" />
          </Section>
          <Separator />

          {/* ===== COMERCIAL (always open) ===== */}
          <Section title="Comercial" emoji="💼" defaultOpen>
            <DetailRow label="Produto" value={lead.produto_interesse} emoji="🎯" />
            <DetailRow label="Produto (auto)" value={s(lead, "produto_interesse_auto")} />
            {lead.valor_oportunidade != null && lead.valor_oportunidade > 0 && (
              <DetailRow label="Valor" value={formatCurrency(lead.valor_oportunidade)} emoji="💰" />
            )}
            <DetailRow label="Proprietário" value={lead.proprietario_lead_crm} emoji="👤" />
            <DetailRow label="Funil CRM" value={lead.funil_entrada_crm} emoji="🔄" />
            <DetailRow label="Status Oport." value={lead.status_oportunidade} />
            <DetailRow label="Última Etapa" value={s(lead, "ultima_etapa_comercial")} />
            <DetailRow label="Itens Proposta" value={lead.itens_proposta_crm} emoji="📋" />
            <DetailRow label="Motivo Perda" value={lead.motivo_perda} emoji="❌" />
            {lead.comentario_perda && (
              <p className="text-xs text-destructive italic mt-1">"{lead.comentario_perda}"</p>
            )}
            <DetailRow label="Info. Desejada" value={s(lead, "informacao_desejada")} emoji="❓" />
            {lead.piperun_link && (
              <a href={lead.piperun_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block mt-1">🔗 Abrir no PipeRun</a>
            )}
          </Section>
          <Separator />

          {/* ===== PERFIL ===== */}
          <Section title="Perfil" emoji="🧑‍⚕️">
            <DetailRow label="Área" value={lead.area_atuacao} />
            <DetailRow label="Especialidade" value={lead.especialidade} />
            <DetailRow label="Impressora" value={lead.tem_impressora === "não" ? null : (lead.impressora_modelo || lead.tem_impressora)} emoji="🖨️" />
            <DetailRow label="Scanner" value={lead.tem_scanner === "não" ? null : lead.tem_scanner} emoji="📷" />
            <DetailRow label="Digitalização" value={lead.como_digitaliza} emoji="🔍" />
            <DetailRow label="Software CAD" value={lead.software_cad} emoji="💻" />
            <DetailRow label="Vol. Mensal" value={lead.volume_mensal_pecas} emoji="📦" />
            <DetailRow label="Aplicação" value={lead.principal_aplicacao} />
            <DetailRow label="Resina" value={lead.resina_interesse} emoji="🧪" />
          </Section>
          <Separator />

          {/* ===== ANÁLISE IA ===== */}
          <Section title="Análise IA" emoji="🧠">
            <DetailRow label="Estágio" value={lead.lead_stage_detected} emoji="📍" />
            <DetailRow label="Urgência" value={lead.urgency_level} />
            <DetailRow label="Perfil Psicológico" value={lead.psychological_profile} />
            <DetailRow label="Motivação" value={lead.primary_motivation} />
            <DetailRow label="Abordagem" value={lead.recommended_approach} emoji="💡" />
            <DetailRow label="Rota Inicial" value={lead.rota_inicial_lia} emoji="🛤️" />
            <DetailRow label="Risco Objeção" value={s(lead, "objection_risk")} emoji="⚠️" />
            <DetailRow label="Timeline" value={s(lead, "interest_timeline")} />
            {lead.confidence_score_analysis != null && lead.confidence_score_analysis > 0 && (
              <DetailRow label="Confiança" value={`${lead.confidence_score_analysis}%`} emoji="🎯" />
            )}
            <DetailRow label="Precisão Predição" value={n(lead, "prediction_accuracy") != null ? `${n(lead, "prediction_accuracy")}%` : null} />
            <DetailRow label="Resumo Histórico" value={s(lead, "resumo_historico_ia")} />
          </Section>
          <Separator />

          {/* ===== PIPERUN ESTENDIDO ===== */}
          {hasAny(lead, PIPERUN_EXT_KEYS) && (
            <>
              <Section title="PipeRun Detalhado" emoji="📊">
                <DetailRow label="Funil" value={lead.piperun_pipeline_name} />
                <DetailRow label="Etapa" value={lead.piperun_stage_name} />
                <DetailRow label="Título" value={lead.piperun_title} />
                <DetailRow label="Descrição" value={s(lead, "piperun_description")} />
                <DetailRow label="Observação" value={s(lead, "piperun_observation")} />
                <DetailRow label="Hash" value={s(lead, "piperun_hash")} />
                <DetailRow label="Status" value={s(lead, "piperun_status")} />
                <DetailRow label="Probabilidade" value={n(lead, "piperun_probability") != null ? `${n(lead, "piperun_probability")}%` : null} />
                <DetailRow label="MRR" value={n(lead, "piperun_value_mrr") != null && n(lead, "piperun_value_mrr")! > 0 ? formatCurrency(n(lead, "piperun_value_mrr")!) : null} />
                <DetailRow label="Lead Time (dias)" value={n(lead, "piperun_lead_time")?.toString()} />
                <DetailRow label="Congelado" value={b(lead, "piperun_frozen") ? "Sim" : null} emoji="🧊" />
                <DetailRow label="Congelado em" value={fmtDateTime(s(lead, "piperun_frozen_at"))} />
                <DetailRow label="Último Contato" value={fmtDateTime(s(lead, "piperun_last_contact_at"))} />
                <DetailRow label="Mudança Etapa" value={fmtDateTime(s(lead, "piperun_stage_changed_at"))} />
                <DetailRow label="Fechado em" value={fmtDateTime(s(lead, "piperun_closed_at"))} />
                <DetailRow label="Previsão Fech." value={fmtDateTime(s(lead, "piperun_probably_closed_at"))} />
                <DetailRow label="Criado (PR)" value={fmtDateTime(lead.piperun_created_at)} emoji="📅" />
                <DetailRow label="Pipeline ID" value={s(lead, "piperun_pipeline_id")} />
                <DetailRow label="Stage ID" value={s(lead, "piperun_stage_id")} />
                <DetailRow label="Origin ID" value={s(lead, "piperun_origin_id")} />
                <DetailRow label="Owner ID" value={s(lead, "piperun_owner_id")} />
                <DetailRow label="Origem" value={lead.piperun_origin_name} />
                <DetailRow label="Deletado" value={b(lead, "piperun_deleted") ? "Sim" : null} emoji="🗑️" />
              </Section>
              <Separator />
            </>
          )}

          {/* ===== PESSOA ===== */}
          {hasAny(lead, PESSOA_KEYS) && (
            <>
              <Section title="Pessoa" emoji="👤">
                <DetailRow label="CPF" value={s(lead, "pessoa_cpf")} />
                <DetailRow label="Cargo" value={s(lead, "pessoa_cargo")} emoji="💼" />
                <DetailRow label="Gênero" value={s(lead, "pessoa_genero")} />
                <DetailRow label="Nascimento" value={fmtDate(s(lead, "pessoa_nascimento"))} emoji="🎂" />
                {s(lead, "pessoa_linkedin") && (
                  <a href={s(lead, "pessoa_linkedin")!} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block">🔗 LinkedIn</a>
                )}
                {s(lead, "pessoa_facebook") && (
                  <a href={s(lead, "pessoa_facebook")!} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block">🔗 Facebook</a>
                )}
                <DetailRow label="Observação" value={s(lead, "pessoa_observation")} />
                <DetailRow label="PipeRun ID" value={s(lead, "pessoa_piperun_id")} />
              </Section>
              <Separator />
            </>
          )}

          {/* ===== EMPRESA ===== */}
          {hasAny(lead, EMPRESA_KEYS) && (
            <>
              <Section title="Empresa" emoji="🏢">
                <DetailRow label="Nome" value={s(lead, "empresa_nome")} />
                <DetailRow label="Razão Social" value={s(lead, "empresa_razao_social")} />
                <DetailRow label="CNPJ" value={s(lead, "empresa_cnpj")} />
                <DetailRow label="IE" value={s(lead, "empresa_ie")} />
                <DetailRow label="Segmento" value={s(lead, "empresa_segmento")} />
                <DetailRow label="Porte" value={s(lead, "empresa_porte")} />
                <DetailRow label="Situação" value={s(lead, "empresa_situacao")} />
                <DetailRow label="CNAE" value={s(lead, "empresa_cnae")} />
                {s(lead, "empresa_website") && (
                  <a href={s(lead, "empresa_website")!} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block">🌐 {s(lead, "empresa_website")}</a>
                )}
                <DetailRow label="PipeRun ID" value={s(lead, "empresa_piperun_id")} />
              </Section>
              <Separator />
            </>
          )}

          {/* ===== SDR INTERESSES ===== */}
          {hasAny(lead, SDR_KEYS) && (
            <>
              <Section title="SDR Interesses" emoji="🎯">
                <DetailRow label="Scanner" value={s(lead, "sdr_scanner_interesse")} emoji="📷" />
                <DetailRow label="Impressora" value={s(lead, "sdr_impressora_interesse")} emoji="🖨️" />
                <DetailRow label="Software CAD" value={s(lead, "sdr_software_cad_interesse")} emoji="💻" />
                <DetailRow label="Caracterização" value={s(lead, "sdr_caracterizacao_interesse")} />
                <DetailRow label="Cursos" value={s(lead, "sdr_cursos_interesse")} emoji="🎓" />
                <DetailRow label="Dentística" value={s(lead, "sdr_dentistica_interesse")} emoji="🦷" />
                <DetailRow label="Insumos Lab" value={s(lead, "sdr_insumos_lab_interesse")} emoji="🧪" />
                <DetailRow label="Pós-Impressão" value={s(lead, "sdr_pos_impressao_interesse")} emoji="♨️" />
                <DetailRow label="Soluções" value={s(lead, "sdr_solucoes_interesse")} />
                <DetailRow label="Marca Impressora" value={s(lead, "sdr_marca_impressora_param")} />
                <DetailRow label="Modelo Impressora" value={s(lead, "sdr_modelo_impressora_param")} />
                <DetailRow label="Resina Param" value={s(lead, "sdr_resina_param")} />
                <DetailRow label="Suporte Equip." value={s(lead, "sdr_suporte_equipamento")} />
                <DetailRow label="Suporte Tipo" value={s(lead, "sdr_suporte_tipo")} />
                <DetailRow label="Suporte Desc." value={s(lead, "sdr_suporte_descricao")} />
              </Section>
              <Separator />
            </>
          )}

          {/* ===== LOJA INTEGRADA ===== */}
          {hasAny(lead, LOJA_KEYS) && (
            <>
              <Section title="Loja Integrada" emoji="🛒">
                <DetailRow label="Cliente ID" value={s(lead, "lojaintegrada_cliente_id")} />
                <DetailRow label="Últ. Pedido #" value={s(lead, "lojaintegrada_ultimo_pedido_numero")} />
                <DetailRow label="Últ. Pedido Data" value={fmtDate(s(lead, "lojaintegrada_ultimo_pedido_data"))} />
                <DetailRow label="Últ. Pedido Valor" value={n(lead, "lojaintegrada_ultimo_pedido_valor") != null ? formatCurrency(n(lead, "lojaintegrada_ultimo_pedido_valor")!) : null} emoji="💰" />
                <DetailRow label="Últ. Pedido Status" value={s(lead, "lojaintegrada_ultimo_pedido_status")} />
                <DetailRow label="Pagamento" value={s(lead, "lojaintegrada_forma_pagamento")} />
                <DetailRow label="Envio" value={s(lead, "lojaintegrada_forma_envio")} />
                <DetailRow label="Endereço" value={[s(lead, "lojaintegrada_endereco"), s(lead, "lojaintegrada_numero"), s(lead, "lojaintegrada_complemento")].filter(Boolean).join(", ") || null} />
                <DetailRow label="Bairro" value={s(lead, "lojaintegrada_bairro")} />
                <DetailRow label="CEP" value={s(lead, "lojaintegrada_cep")} />
                <DetailRow label="Referência" value={s(lead, "lojaintegrada_referencia")} />
                <DetailRow label="Cupom" value={s(lead, "lojaintegrada_cupom_desconto")} emoji="🎟️" />
                <DetailRow label="UTM Campaign" value={s(lead, "lojaintegrada_utm_campaign")} />
                <DetailRow label="Sexo" value={s(lead, "lojaintegrada_sexo")} />
                <DetailRow label="Nascimento" value={fmtDate(s(lead, "lojaintegrada_data_nascimento"))} />
                <DetailRow label="Obs. Cliente" value={s(lead, "lojaintegrada_cliente_obs")} />
                <DetailRow label="Atualizado" value={fmtDateTime(s(lead, "lojaintegrada_updated_at"))} />
              </Section>
              <Separator />
            </>
          )}

          {/* ===== ASTRON ===== */}
          {hasAny(lead, ASTRON_KEYS) && (
            <>
              <Section title="Astron" emoji="🎓">
                <DetailRow label="User ID" value={s(lead, "astron_user_id")} />
                <DetailRow label="Status" value={s(lead, "astron_status")} />
                <DetailRow label="Nome" value={s(lead, "astron_nome")} />
                <DetailRow label="Email" value={s(lead, "astron_email")} />
                <DetailRow label="Telefone" value={s(lead, "astron_phone")} />
                <DetailRow label="Planos Ativos" value={Array.isArray(lead.astron_plans_active) && (lead.astron_plans_active as string[]).length > 0 ? (lead.astron_plans_active as string[]).join(", ") : null} />
                <DetailRow label="Cursos Total" value={s(lead, "astron_courses_total")} />
                <DetailRow label="Cursos Completos" value={s(lead, "astron_courses_completed")} />
                <DetailRow label="Último Login" value={fmtDateTime(s(lead, "astron_last_login_at"))} />
                {s(lead, "astron_login_url") && (
                  <a href={s(lead, "astron_login_url")!} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block">🔗 Login URL</a>
                )}
                <DetailRow label="Criado em" value={fmtDateTime(s(lead, "astron_created_at"))} />
                <DetailRow label="Sincronizado" value={fmtDateTime(s(lead, "astron_synced_at"))} />
              </Section>
              <Separator />
            </>
          )}

          {/* ===== ATIVO / COMPRAS (SellFlux) ===== */}
          {hasAny(lead, SELLFLUX_KEYS) && (
            <>
              <Section title="Produtos Ativos & Recompra" emoji="🔄">
                <DetailRow label="Scanner Ativo" value={b(lead, "ativo_scan")} emoji="📷" />
                <DetailRow label="Últ. Compra Scan" value={fmtDate(s(lead, "data_ultima_compra_scan"))} />
                <DetailRow label="Impressora Ativa" value={b(lead, "ativo_print")} emoji="🖨️" />
                <DetailRow label="Últ. Compra Print" value={fmtDate(s(lead, "data_ultima_compra_print"))} />
                <DetailRow label="CAD Ativo" value={b(lead, "ativo_cad")} emoji="💻" />
                <DetailRow label="Últ. Compra CAD" value={fmtDate(s(lead, "data_ultima_compra_cad"))} />
                <DetailRow label="CAD IA Ativo" value={b(lead, "ativo_cad_ia")} />
                <DetailRow label="Últ. Compra CAD IA" value={fmtDate(s(lead, "data_ultima_compra_cad_ia"))} />
                <DetailRow label="Cura Ativo" value={b(lead, "ativo_cura")} emoji="♨️" />
                <DetailRow label="Últ. Compra Cura" value={fmtDate(s(lead, "data_ultima_compra_cura"))} />
                <DetailRow label="Insumos Ativo" value={b(lead, "ativo_insumos")} emoji="🧪" />
                <DetailRow label="Últ. Compra Insumos" value={fmtDate(s(lead, "data_ultima_compra_insumos"))} />
                <DetailRow label="Notebook Ativo" value={b(lead, "ativo_notebook")} emoji="💻" />
                <DetailRow label="Últ. Compra Notebook" value={fmtDate(s(lead, "data_ultima_compra_notebook"))} />
                <DetailRow label="Smart Slice Ativo" value={b(lead, "ativo_smart_slice")} />
                <DetailRow label="Últ. Compra Smart Slice" value={fmtDate(s(lead, "data_ultima_compra_smart_slice"))} />
                <DetailRow label="Contrato" value={s(lead, "codigo_contrato")} />
                <DetailRow label="Data Contrato" value={fmtDate(s(lead, "data_contrato"))} />
                <DetailRow label="ID Cliente Smart" value={s(lead, "id_cliente_smart")} />
                <DetailRow label="Data Treinamento" value={s(lead, "data_treinamento")} />
              </Section>
              <Separator />
            </>
          )}

          {/* ===== EQUIPAMENTOS & TÉCNICO ===== */}
          {(lead.equip_scanner || lead.equip_impressora || lead.equip_cad || lead.equip_pos_impressao || lead.equip_notebook || lead.insumos_adquiridos) && (
            <>
              <Section title="Equipamentos & Técnico" emoji="⚙️" defaultOpen>
                <EquipRow emoji="📷" label="Scanner" name={lead.equip_scanner} serial={lead.equip_scanner_serial} date={lead.equip_scanner_ativacao} />
                <EquipRow emoji="🖨️" label="Impressora" name={lead.equip_impressora} serial={lead.equip_impressora_serial} date={lead.equip_impressora_ativacao} />
                <EquipRow emoji="💻" label="CAD" name={lead.equip_cad} serial={lead.equip_cad_serial} date={lead.equip_cad_ativacao} />
                <EquipRow emoji="♨️" label="Pós-Impressão" name={lead.equip_pos_impressao} serial={lead.equip_pos_impressao_serial} date={lead.equip_pos_impressao_ativacao} />
                <EquipRow emoji="💻" label="Notebook" name={lead.equip_notebook} serial={lead.equip_notebook_serial} date={lead.equip_notebook_ativacao} />
                {lead.insumos_adquiridos && (
                  <DetailRow label="Insumos" value={lead.insumos_adquiridos} emoji="🧪" />
                )}
              </Section>
              <Separator />
            </>
          )}

          {/* ===== ITENS DA PROPOSTA ===== */}
          {lead.itens_proposta_parsed && Array.isArray(lead.itens_proposta_parsed) && lead.itens_proposta_parsed.length > 0 && (
            <>
              <Section title={`Itens da Proposta (${lead.itens_proposta_parsed.length})`} emoji="📋" defaultOpen>
                <div className="space-y-1">
                  {(lead.itens_proposta_parsed as ParsedProposalItem[]).map((item, i) => {
                    const emoji = item.category === "scanner" ? "📷" : item.category === "impressora" ? "🖨️" : item.category === "cad" ? "💻" : item.category === "pos_impressao" ? "♨️" : item.category === "notebook" ? "💻" : item.category === "insumos" ? "🧪" : "📦";
                    return (
                      <div key={i} className="flex items-center justify-between text-xs py-0.5">
                        <span>{emoji} {item.name}</span>
                        <span className="text-muted-foreground">x{item.qty}</span>
                      </div>
                    );
                  })}
                </div>
              </Section>
              <Separator />
            </>
          )}

          {/* ===== PROPOSTAS (JSONB) ===== */}
          {lead.proposals_data && Array.isArray(lead.proposals_data) && (lead.proposals_data as unknown[]).length > 0 && (
            <>
              <Section title={`Propostas PipeRun (${(lead.proposals_data as unknown[]).length})`} emoji="📄">
                <DetailRow label="Valor Total" value={n(lead, "proposals_total_value") != null && n(lead, "proposals_total_value")! > 0 ? formatCurrency(n(lead, "proposals_total_value")!) : null} emoji="💰" />
                <DetailRow label="MRR Total" value={n(lead, "proposals_total_mrr") != null && n(lead, "proposals_total_mrr")! > 0 ? formatCurrency(n(lead, "proposals_total_mrr")!) : null} />
                <DetailRow label="Último Status" value={s(lead, "proposals_last_status")} />
              </Section>
              <Separator />
            </>
          )}

          {/* ===== CS & SUPORTE ===== */}
          <Section title="CS & Suporte" emoji="🎧">
            <TrackingRow label="CS Treinamento" value={s(lead, "cs_treinamento")} emoji="🎓" />
            <TrackingRow label="Data Treinamento" value={fmtDate(s(lead, "data_treinamento"))} emoji="📅" />
            <TrackingRow label="Data Contrato" value={fmtDate(s(lead, "data_contrato"))} emoji="📝" />
            <TrackingRow label="Código Contrato" value={s(lead, "codigo_contrato")} emoji="🔖" />
            <TrackingRow label="Suporte Equip." value={s(lead, "sdr_suporte_equipamento")} emoji="🔧" />
            <TrackingRow label="Suporte Tipo" value={s(lead, "sdr_suporte_tipo")} emoji="📋" />
            <TrackingRow label="Suporte Descrição" value={s(lead, "sdr_suporte_descricao")} emoji="📝" />
            <TrackingRow label="Reunião Agendada" value={b(lead, "reuniao_agendada")} emoji="📅" />
            <TrackingRow label="1º Contato" value={fmtDateTime(s(lead, "data_primeiro_contato"))} emoji="🤝" />
          </Section>
          <Separator />

          {/* ===== ORIGEM & META ===== */}
          <Section title="Origem & Meta" emoji="🔗">
            <DetailRow label="Origem" value={lead.source === "piperun_sync" ? "PipeRun" : lead.source} emoji="📡" />
            <DetailRow label="Form" value={s(lead, "form_name")} />
            <DetailRow label="UTM Source" value={lead.utm_source} />
            <DetailRow label="UTM Medium" value={s(lead, "utm_medium")} />
            <DetailRow label="UTM Campaign" value={s(lead, "utm_campaign")} />
            <DetailRow label="UTM Term" value={s(lead, "utm_term")} />
            <DetailRow label="Campanha" value={lead.piperun_origin_name || (lead.origem_campanha && !/^\d+$/.test(lead.origem_campanha) ? lead.origem_campanha : null)} emoji="📣" />
            <DetailRow label="IP" value={s(lead, "ip_origem")} />
            <DetailRow label="País" value={s(lead, "pais_origem")} emoji="🌍" />
            <DetailRow label="Mensagens" value={lead.total_messages?.toString()} />
            <DetailRow label="Sessões" value={lead.total_sessions?.toString()} />
            <DetailRow label="Última Sessão" value={fmtDateTime(s(lead, "ultima_sessao_at"))} />
            <DetailRow label="Proactive Sent" value={fmtDateTime(s(lead, "proactive_sent_at"))} />
            <DetailRow label="Proactive Count" value={s(lead, "proactive_count")} />
            <DetailRow label="Lead Timing (dias)" value={s(lead, "lead_timing_dias")} />
            <DetailRow label="Fechamento CRM" value={fmtDate(s(lead, "data_fechamento_crm"))} />
          </Section>
          <Separator />

          {/* ===== TAGS & RASTREAMENTO ===== */}
          <Section title="Tags & Rastreamento" emoji="🏷️" defaultOpen>
            {lead.tags_crm && lead.tags_crm.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 mb-2">
                {lead.tags_crm.map((t, i) => <Badge key={i} variant="secondary" className="text-[10px]">🏷️ {t}</Badge>)}
              </div>
            )}
            <TrackingRow label="Motivo Perda" value={s(lead, "motivo_perda")} emoji="❌" />
            <TrackingRow label="Comentário Perda" value={s(lead, "comentario_perda")} emoji="💬" />
            <TrackingRow label="ID Cliente Smart" value={s(lead, "id_cliente_smart")} emoji="🔑" />
            <TrackingRow label="Entrada no Sistema" value={fmtDateTime(s(lead, "entrada_sistema"))} emoji="🚪" />
            <TrackingRow label="Criado (banco)" value={fmtDateTime(lead.created_at)} emoji="📅" />
            <TrackingRow label="Atualizado" value={fmtDateTime(lead.updated_at)} emoji="🔄" />
          </Section>
          <Separator />

          {/* ===== CONVERSAS LIA (Web) ===== */}
          <Section title={`Conversas LIA (${liaInteractions.length})`} emoji="💬" defaultOpen>
            {loadingMsgs ? (
              <p className="text-xs text-muted-foreground">Carregando...</p>
            ) : liaInteractions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma conversa com a LIA</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {liaInteractions.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <span className="text-[10px] text-muted-foreground block">
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                      {item.feedback && item.feedback !== "none" && (
                        <span className="ml-1">{item.feedback === "positive" ? "👍" : item.feedback === "negative" ? "👎" : ""}</span>
                      )}
                    </span>
                    {/* Client message - left */}
                    <div className="bg-muted rounded-lg px-2.5 py-1.5 text-xs mr-8 whitespace-pre-wrap">
                      {item.user_message}
                    </div>
                    {/* LIA response - right */}
                    {item.agent_response && (
                      <div className="bg-primary/10 text-foreground rounded-lg px-2.5 py-1.5 text-xs ml-8 whitespace-pre-wrap">
                        {item.agent_response.length > 300 ? item.agent_response.slice(0, 300) + "…" : item.agent_response}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
          <Separator />

          {/* ===== WHATSAPP INBOX ===== */}
          <Section title={`WhatsApp Inbox (${whatsappMsgs.length})`} emoji="📱">
            {loadingMsgs ? (
              <p className="text-xs text-muted-foreground">Carregando...</p>
            ) : whatsappMsgs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma mensagem WhatsApp</p>
            ) : (
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {whatsappMsgs.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg px-2.5 py-1.5 text-xs ${
                      msg.direction === "inbound"
                        ? "bg-muted mr-8"
                        : "bg-primary/10 ml-8"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.created_at).toLocaleString("pt-BR")}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {msg.direction === "inbound" ? "⬅️ entrada" : "➡️ saída"}
                      </Badge>
                      {msg.intent_detected && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">
                          {msg.intent_detected}
                        </Badge>
                      )}
                    </div>
                    {msg.media_url && (
                      <a href={msg.media_url} target="_blank" rel="noreferrer" className="text-primary underline text-[10px] block">
                        📎 {msg.media_type || "arquivo"}
                      </a>
                    )}
                    <p className="whitespace-pre-wrap">{msg.message_text || "[sem texto]"}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
          <Separator />

          {/* ===== MENSAGENS (Sistema/Vendedor) ===== */}
          <Section title="Mensagens Sistema" emoji="📨">
            {loadingMsgs ? (
              <p className="text-xs text-muted-foreground">Carregando...</p>
            ) : (
              <div className="space-y-3">
                <MessageSection title="Sistema → Vendedor" emoji="📨" messages={systemMsgs} />
                <MessageSection title="Vendedor → Lead" emoji="💬" messages={sellerMsgs} />
              </div>
            )}
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
