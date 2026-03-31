import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface OmieParcela {
  id: string
  omie_pedido_id: number | null
  omie_titulo_id: number | null
  numero_pedido: string | null
  numero_parcela: number
  total_parcelas: number
  valor: number
  valor_pago: number | null
  data_vencimento: string
  data_pagamento: string | null
  tipo_documento: string
  status: "PENDENTE" | "PAGO" | "VENCIDO" | "CANCELADO" | "PARCIALMENTE_PAGO"
  cobranca_enviada_em: string | null
  cobranca_count: number
  created_at: string
}

export interface LeadFinanceiroResumo {
  total_parcelas: number
  valor_total: number
  valor_pago: number
  valor_pendente: number
  valor_vencido: number
  parcelas_pagas: number
  parcelas_vencidas: number
  parcelas_pendentes: number
  parcelas_canceladas: number
  proximo_vencimento: string | null
  max_dias_vencido: number | null
  percentual_pago: number | null
  ultima_atualizacao: string | null
}

export function useLeadFinanceiro(leadId: string | null) {
  const parcelas = useQuery<OmieParcela[]>({
    queryKey:  ["lead-parcelas", leadId],
    enabled:   !!leadId,
    staleTime: 1000 * 60 * 2,
    queryFn:   async () => {
      if (!leadId) return []
      const { data, error } = await supabase
        .from("omie_parcelas" as any).select("*")
        .eq("lead_id", leadId)
        .order("data_vencimento", { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as OmieParcela[]
    }
  })

  const resumo = useQuery<LeadFinanceiroResumo | null>({
    queryKey:  ["lead-financeiro-resumo", leadId],
    enabled:   !!leadId,
    staleTime: 1000 * 60 * 2,
    queryFn:   async () => {
      if (!leadId) return null
      const { data, error } = await supabase
        .from("v_lead_financeiro" as any).select("*")
        .eq("lead_id", leadId).maybeSingle()
      if (error) throw error
      return data as unknown as LeadFinanceiroResumo | null
    }
  })

  return { parcelas, resumo }
}