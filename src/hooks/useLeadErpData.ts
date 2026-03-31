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
}

export function useLeadErpData(leadId: string | null) {
  return useQuery<LeadErpSummary>({
    queryKey:  ["lead-erp-data", leadId],
    enabled:   !!leadId,
    staleTime: 1000 * 60 * 5,
    queryFn:   async () => {
      if (!leadId) throw new Error("leadId obrigatório")

      const [itemsRes, leadRes, historyRes] = await Promise.all([
        supabase.from("deal_items").select("*")
          .eq("lead_id", leadId).eq("source", "omie")
          .order("synced_at", { ascending: false }),
        supabase.from("lia_attendances").select(`
          omie_nf_count, omie_last_sync, ltv_total,
          erp_status, real_status, status_oportunidade,
          frete_status, frete_transportadora, frete_codigo_rastreio,
          frete_link_rastreio, frete_valor, frete_tipo,
          frete_previsao_entrega, frete_updated_at
        `).eq("id", leadId).single(),
        supabase.from("deal_status_history").select("id,source,status,event_name,created_at")
          .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20)
      ])

      if (itemsRes.error) throw itemsRes.error
      if (leadRes.error)  throw leadRes.error

      const items = (itemsRes.data ?? []) as any[]
      const lead  = leadRes.data as any
      const totalLtv = items.reduce((s: number, i: any) => s + (i.total_value ?? 0), 0)

      return {
        items,
        totalLtv,
        totalOrders:         items.length,
        lastOrderDate:       items[0]?.synced_at ?? null,
        nfCount:             lead?.omie_nf_count             ?? 0,
        omieLastSync:        lead?.omie_last_sync             ?? null,
        crmStatus:           lead?.status_oportunidade        ?? null,
        erpStatus:           lead?.erp_status                 ?? "NONE",
        realStatus:          (lead?.real_status as LeadErpSummary["realStatus"]) ?? null,
        statusHistory:       (historyRes.data ?? []) as StatusHistoryEntry[],
        freteStatus:         lead?.frete_status               ?? "NONE",
        freteTipo:           lead?.frete_tipo                 ?? null,
        freteTransportadora: lead?.frete_transportadora        ?? null,
        freteCodigoRastreio: lead?.frete_codigo_rastreio       ?? null,
        freteLink:           lead?.frete_link_rastreio         ?? null,
        freteValor:          lead?.frete_valor                 ?? null,
        fretePrevisaoEntrega:lead?.frete_previsao_entrega      ?? null,
        freteUpdatedAt:      lead?.frete_updated_at            ?? null,
      }
    }
  })
}