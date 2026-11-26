// Histórico do WhatsApp Oficial (Zernio): regras dos números exibidos por campanha.
// Situação dos envios vem da Zernio (results.summary); cliques, SAIR e "sem ação" vêm do banco
// (fn_wa_official_campaign_engagement), lead a lead.

export interface ZernioSummary { total?: number; pending?: number; sent?: number; delivered?: number; read?: number; failed?: number }
export interface WaEngagement {
  leads: number; delivered: number; read_count: number; failed: number;
  clicked: number; buttons: Record<string, number>; sair: number; no_action: number;
}
export interface TemplateButton { type?: string; text?: string }

/** Botões na ordem do template aprovado (Botão 1, Botão 2…); rótulos clicados fora do template vão ao fim. */
export function orderedButtons(template: TemplateButton[] | null | undefined, counts: Record<string, number> | null | undefined) {
  const c = counts ?? {};
  const fromTemplate = (template ?? [])
    .filter((b) => (b.type ?? "QUICK_REPLY").toUpperCase() === "QUICK_REPLY" && (b.text ?? "").trim())
    .map((b) => b.text!.trim());
  const extra = Object.keys(c).filter((k) => !fromTemplate.includes(k)).sort((a, b) => (c[b] ?? 0) - (c[a] ?? 0));
  return [...fromTemplate, ...extra].map((label) => ({ label, count: c[label] ?? 0 }));
}

export function waOfficialRow(opts: {
  leadCount: number | null | undefined;
  summary: ZernioSummary | null | undefined;
  engagement: WaEngagement | null | undefined;
  costPerMessage: number | null | undefined;
  estimatedCost: number | null | undefined;
}) {
  const s = opts.summary;
  const n = (v: unknown) => Number(v ?? 0) || 0;
  const leads = s ? n(s.total) || n(opts.leadCount) : n(opts.engagement?.leads) || n(opts.leadCount);
  const delivered = s ? n(s.delivered) + n(s.read) : n(opts.engagement?.delivered);
  const failed = s ? n(s.failed) : n(opts.engagement?.failed);
  // Em andamento: na fila (lotes futuros) + aceitos pela Meta ainda sem confirmação de entrega.
  const inProgress = s ? n(s.pending) + n(s.sent) : 0;
  const dispatched = s ? n(s.sent) + n(s.delivered) + n(s.read) + n(s.failed) : failed;
  const cpm = opts.costPerMessage == null || opts.costPerMessage === ("" as any) ? null : Number(opts.costPerMessage);
  const estimated = opts.estimatedCost != null ? Number(opts.estimatedCost) : cpm != null ? round2(leads * cpm) : null;
  // A Meta cobra a mensagem de marketing entregue: custo real = entregues × valor por mensagem.
  const real = cpm != null ? round2(delivered * cpm) : null;
  return { leads, dispatched, delivered, failed, inProgress, read: s ? n(s.read) : n(opts.engagement?.read_count), estimated, real };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

const AUDIENCE_FILTER_LABELS: Record<string, string> = {
  produto_interesse: "Produto",
  temperatura_lead: "Temperatura",
  piperun_stage_name: "Etapa CRM",
  especialidade: "Especialidade",
  area_atuacao: "Área de atuação",
  uf: "UF",
  proprietario_lead_crm: "Responsável",
  real_status: "Status real",
  tem_scanner: "Tem scanner",
  tem_printer: "Tem impressora",
  recencia_dias: "Atualizado nos últimos dias",
  cliente_filter: "Tipo de lead",
  piperun_pipeline_name: "Funil",
  origem_primeiro_contato: "Origem",
  piperun_status: "Status PipeRun",
  prazo_compra: "Prazo de compra",
  tipo_local: "Tipo de local",
  cidade: "Cidade",
  form_name: "Formulário",
  utm_campaign: "Campanha UTM",
  marca_scanner: "Marca do scanner",
  marca_impressora: "Marca da impressora",
  tem_fresadora: "Tem fresadora",
  tem_cad: "Tem CAD",
  imprime_modelos: "Imprime modelos",
  imprime_placas: "Imprime placas",
  imprime_guias: "Imprime guias",
  imprime_resinas_ld: "Imprime resinas LD",
  reuniao_agendada: "Reunião agendada",
  omie_inadimplente: "Inadimplente",
  recompra_alert: "Alerta de recompra",
  sdr_completo: "SDR completo",
  tem_email: "Tem e-mail",
  tem_telefone: "Tem telefone",
  aceita_contato: "Aceita contato",
  wa_sair: "Pediu SAIR",
  eng_campanha: "Histórico de campanha",
  eng_acao: "Interação",
  conv_form: "Converteu no formulário",
  ltv_min: "LTV mínimo",
  score_min: "Score mínimo",
  ecom_cliente: "Cliente da loja",
  ecom_produtos: "Produtos comprados",
  ecom_pedidos_min: "Pedidos mínimos",
  ecom_gasto_min: "Gasto mínimo",
  ecom_gasto_max: "Gasto máximo",
  ecom_ultima_compra: "Última compra",
  ecom_primeira_compra: "Primeira compra",
  ecom_status: "Status do pedido",
  ecom_pagamento: "Pagamento",
  ecom_cupom: "Cupom",
  ecom_tipo_pessoa: "Tipo de pessoa",
};

const audienceValue = (key: string, value: unknown): string => {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (value === "yes") return "Sim";
  if (value === "no") return "Não";
  if (key === "cliente_filter") return value === "clientes" ? "Clientes" : "Somente leads";
  if (key === "wa_sair") return value === "exclude" ? "Excluir" : "Somente estes";
  if (key === "eng_campanha" && value === "any_email") return "Qualquer e-mail";
  if (key === "eng_campanha" && value === "any_wa") return "Qualquer WhatsApp";
  if (key === "ecom_cupom" && value === "any") return "Com cupom";
  if (key === "ecom_cupom" && value === "none") return "Sem cupom";
  return String(value ?? "—");
};

/** Público congelado no disparo; campanhas antigas sem esse marco não têm seu filtro presumido. */
export function waOfficialAudience(opts: {
  filters: Record<string, unknown> | null | undefined;
  segmentName: string | null | undefined;
  snapshotRecorded: boolean;
}) {
  if (!opts.snapshotRecorded) return { label: "Não registrada", details: "" };
  const details = Object.entries(opts.filters ?? {})
    .filter(([, value]) => value != null && value !== "" && (!Array.isArray(value) || value.length > 0))
    .map(([key, value]) => `${AUDIENCE_FILTER_LABELS[key] ?? key}: ${audienceValue(key, value)}`)
    .join(" · ");
  const savedName = opts.segmentName?.trim() || "";
  return {
    label: savedName || details || "Todos os leads com telefone válido",
    details: savedName && details ? details : "",
  };
}

export type RecipientSegment = "button" | "sair" | "no_action" | "failed" | "in_progress" | "delivered" | "all";

export interface WaRecipient {
  lead_id: string; nome: string | null; telefone: string | null; status: string | null; provider_status: string | null;
  sent_at: string | null; delivered_at: string | null; read_at: string | null; error_message: string | null;
  buttons: string[] | null; first_click_at: string | null; sair_at: string | null;
}

export const isDelivered = (r: WaRecipient) => !!(r.delivered_at || r.read_at || ["delivered", "read"].includes(r.provider_status ?? ""));

export function filterRecipients(rows: WaRecipient[], seg: RecipientSegment, button?: string) {
  switch (seg) {
    case "button": return rows.filter((r) => (r.buttons ?? []).includes(button ?? ""));
    case "sair": return rows.filter((r) => !!r.sair_at);
    case "no_action": return rows.filter((r) => isDelivered(r) && !(r.buttons?.length) && !r.sair_at);
    case "failed": return rows.filter((r) => r.status === "failed");
    case "delivered": return rows.filter(isDelivered);
    case "in_progress": return rows.filter((r) => r.status !== "failed" && !isDelivered(r));
    default: return rows;
  }
}
