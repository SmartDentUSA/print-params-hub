import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface OmieDealItem {
  id: string
  product_name: string
  product_code: string
  quantity: number
  unit_value: number
  total_value: number
  serial_number: string | null
  nfe_number: string | null
  synced_at: string
}

export interface StatusHistoryEntry {
  id: string
  source: string
  status: string
  event_name: string | null
  created_at: string
}

export type OmieScoreLabel = "PREMIUM" | "ATIVO" | "OPORTUNIDADE" | "RISCO" | null
export type OmieClassificacao = "PRIORIDADE" | "RECUPERACAO" | "REATIVACAO" | "ATIVO" | "MONITORAR" | null

export interface LeadErpSummary {
  items: OmieDealItem[]
  totalLtv: number
  totalOrders: number
  lastOrderDate: string | null
  nfCount: number
  omieLastSync: string | null
  crmStatus: string | null
  erpStatus: string
  realStatus:
    | "CLIENTE_ATIVO" | "AGUARDANDO_ENTREGA" | "AGUARDANDO_PAGAMENTO"
    | "EM_TRANSITO"   | "RISCO_OPERACIONAL"  | "DEAL_PERDIDO"
    | "INADIMPLENTE"  | "NEGOCIO_PERDIDO"    | "EM_NEGOCIACAO" | null
  statusHistory: StatusHistoryEntry[]
  freteStatus: string
  freteTipo: string | null
  freteTransportadora: string | null
  freteCodigoRastreio: string | null
  freteLink: string | null
  freteValor: number | null
  fretePrevisaoEntrega: string | null
  freteUpdatedAt: string | null
  // Score — calculado APENAS em SQL
  omieScore: number
  omieScoreLabel: OmieScoreLabel
  omieClassificacao: OmieClassificacao
  // Financeiro
  omieFaturamentoTotal: number
  omieValorPago: number
  omieValorEmAberto: number
  omieValorVencido: number
  omiePercentualPago: number
  omieTicketMedio: number
  omieFrequenciaCompra: number
  omieUltimaCompra: string | null
  omieDiasSemComprar: number | null
  omieInadimplente: boolean
  omieDiasAtrasoMax: number
  omieTotalPedidos: number
  omieUltimaNfEmitida: string | null
  // Identidade
  omieTipoPessoa: string | null
  omieSegmento: string | null
  omieRazaoSocial: string | null
}

export function useLeadErpData(leadId: string | null) {
  return useQuery<LeadErpSummary>({
    queryKey:  ["lead-erp-data", leadId],
    enabled:   !!leadId,
    staleTime: 1000 * 60 * 5,
    queryFn:   async () => {
      if (!leadId) throw new Error("leadId obrigatório")

      const [itemsRes, leadRes, historyRes] = await Promise.all([
        (supabase as any).from("deal_items").select("*")
          .eq("lead_id", leadId).eq("source", "omie")
          .order("synced_at", { ascending: false }),
        (supabase as any).from("lia_attendances").select(`
          omie_nf_count, omie_last_sync, ltv_total,
          erp_status, real_status, status_oportunidade,
          frete_status, frete_transportadora, frete_codigo_rastreio,
          frete_link_rastreio, frete_valor, frete_tipo,
          frete_previsao_entrega, frete_updated_at,
          omie_faturamento_total, omie_valor_pago, omie_valor_em_aberto,
          omie_valor_vencido, omie_percentual_pago, omie_ticket_medio,
          omie_frequencia_compra, omie_ultima_compra, omie_dias_sem_comprar,
          omie_inadimplente, omie_dias_atraso_max, omie_score,
          omie_total_pedidos, omie_ultima_nf_emitida,
          omie_tipo_pessoa, omie_segmento, omie_razao_social,
          omie_classificacao
        `).eq("id", leadId).single(),
        (supabase as any).from("deal_status_history").select("id,source,status,event_name,created_at")
          .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20)
      ])

      if (itemsRes.error) throw itemsRes.error
      if (leadRes.error)  throw leadRes.error

      const items = (itemsRes.data ?? []) as any[]
      const lead  = leadRes.data as any
      const totalLtv = items.reduce((s: number, i: any) => s + (i.total_value ?? 0), 0)

      const score = lead?.omie_score ?? 0

      return {
        items,
        totalLtv,
        totalOrders:          items.length,
        lastOrderDate:        items[0]?.synced_at ?? null,
        nfCount:              lead?.omie_nf_count             ?? 0,
        omieLastSync:         lead?.omie_last_sync             ?? null,
        crmStatus:            lead?.status_oportunidade        ?? null,
        erpStatus:            lead?.erp_status                 ?? "NONE",
        realStatus:           (lead?.real_status as LeadErpSummary["realStatus"]) ?? null,
        statusHistory:        (historyRes.data ?? []) as StatusHistoryEntry[],
        freteStatus:          lead?.frete_status               ?? "NONE",
        freteTipo:            lead?.frete_tipo                 ?? null,
        freteTransportadora:  lead?.frete_transportadora        ?? null,
        freteCodigoRastreio:  lead?.frete_codigo_rastreio       ?? null,
        freteLink:            lead?.frete_link_rastreio         ?? null,
        freteValor:           lead?.frete_valor                 ?? null,
        fretePrevisaoEntrega: lead?.frete_previsao_entrega      ?? null,
        freteUpdatedAt:       lead?.frete_updated_at            ?? null,
        // Score label derivado do valor salvo no banco
        omieScore:            score,
        omieScoreLabel:       (
          score >= 80 ? "PREMIUM"      :
          score >= 50 ? "ATIVO"        :
          score >= 20 ? "OPORTUNIDADE" :
          score >  0  ? "RISCO"        : null
        ) as OmieScoreLabel,
        omieClassificacao:    (lead?.omie_classificacao ?? null) as OmieClassificacao,
        omieFaturamentoTotal: lead?.omie_faturamento_total  ?? 0,
        omieValorPago:        lead?.omie_valor_pago          ?? 0,
        omieValorEmAberto:    lead?.omie_valor_em_aberto     ?? 0,
        omieValorVencido:     lead?.omie_valor_vencido       ?? 0,
        omiePercentualPago:   lead?.omie_percentual_pago     ?? 0,
        omieTicketMedio:      lead?.omie_ticket_medio        ?? 0,
        omieFrequenciaCompra: lead?.omie_frequencia_compra   ?? 0,
        omieUltimaCompra:     lead?.omie_ultima_compra       ?? null,
        omieDiasSemComprar:   lead?.omie_dias_sem_comprar    ?? null,
        omieInadimplente:     lead?.omie_inadimplente        ?? false,
        omieDiasAtrasoMax:    lead?.omie_dias_atraso_max     ?? 0,
        omieTotalPedidos:     lead?.omie_total_pedidos       ?? 0,
        omieUltimaNfEmitida:  lead?.omie_ultima_nf_emitida   ?? null,
        omieTipoPessoa:       lead?.omie_tipo_pessoa         ?? null,
        omieSegmento:         lead?.omie_segmento            ?? null,
        omieRazaoSocial:      lead?.omie_razao_social        ?? null,
      }
    }
  })
}
