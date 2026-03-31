import { cn } from "@/lib/utils"

const CRM_CONFIG: Record<string, { label: string; className: string }> = {
  lead:        { label: "Lead",        className: "bg-gray-100 text-gray-700 border-gray-200" },
  qualificado: { label: "Qualificado", className: "bg-blue-50 text-blue-700 border-blue-200" },
  proposta:    { label: "Proposta",    className: "bg-purple-50 text-purple-700 border-purple-200" },
  negociacao:  { label: "Negociação",  className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  ganha:       { label: "Ganho",       className: "bg-green-50 text-green-700 border-green-200" },
  perdida:     { label: "Perdido",     className: "bg-red-50 text-red-700 border-red-200" },
}

const ERP_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  NONE:              { label: "Não faturado",  className: "bg-gray-50 text-gray-500 border-gray-200",        dot: "bg-gray-400" },
  ORCADO:            { label: "Orçado",        className: "bg-yellow-50 text-yellow-700 border-yellow-200",  dot: "bg-yellow-500" },
  FATURADO:          { label: "Faturado",      className: "bg-teal-50 text-teal-700 border-teal-200",        dot: "bg-teal-500" },
  PAGO:              { label: "Pago",          className: "bg-green-50 text-green-700 border-green-200",     dot: "bg-green-500" },
  PARCIALMENTE_PAGO: { label: "Pago parcial",  className: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  CANCELADO:         { label: "Cancelado",     className: "bg-red-50 text-red-700 border-red-200",           dot: "bg-red-500" },
  INADIMPLENTE:      { label: "Inadimplente",  className: "bg-red-100 text-red-800 border-red-300",          dot: "bg-red-600" },
  DEVOLVIDO:         { label: "Devolvido",     className: "bg-orange-50 text-orange-700 border-orange-200",  dot: "bg-orange-500" },
}

const REAL_STATUS_ALERT: Record<string, { message: string; className: string } | undefined> = {
  RISCO_OPERACIONAL:   { message: "⚠ Ganho no CRM mas não faturado no ERP",              className: "text-orange-600 bg-orange-50 border border-orange-200" },
  DEAL_PERDIDO:        { message: "✕ Venda cancelada ou devolvida",                       className: "text-red-600 bg-red-50 border border-red-200" },
  INADIMPLENTE:        { message: "! Inadimplente — acionar cobrança",                   className: "text-red-700 bg-red-50 border border-red-200" },
  AGUARDANDO_ENTREGA:  { message: "📦 Pagamento recebido — equipamento não entregue",    className: "text-blue-700 bg-blue-50 border border-blue-200" },
  EM_TRANSITO:         { message: "🚚 Pedido em trânsito — acompanhar entrega",          className: "text-purple-700 bg-purple-50 border border-purple-200" },
  AGUARDANDO_PAGAMENTO:{ message: "⏳ NF emitida — aguardando confirmação de pagamento", className: "text-yellow-700 bg-yellow-50 border border-yellow-200" },
}

interface DualStatusBadgeProps {
  crmStatus:        string | null
  erpStatus:        string | null
  realStatus:       string | null
  compact?:         boolean
  omieInadimplente?: boolean
}

export function DualStatusBadge({ crmStatus, erpStatus, realStatus, compact = false, omieInadimplente }: DualStatusBadgeProps) {
  const crm   = CRM_CONFIG[crmStatus ?? ""] ?? { label: crmStatus ?? "—", className: "bg-gray-50 text-gray-500 border-gray-200" }
  const erp   = ERP_CONFIG[erpStatus ?? "NONE"] ?? ERP_CONFIG["NONE"]
  const alert = realStatus ? REAL_STATUS_ALERT[realStatus] : undefined

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", crm.className)}>
          {crm.label}
        </span>
        <span className="text-gray-300 text-xs">|</span>
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border", erp.className)}>
          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", erp.dot)} />
          {erp.label}
        </span>
        {omieInadimplente && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-300">
            !
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">CRM</p>
          <span className={cn("inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium border", crm.className)}>
            {crm.label}
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">ERP</p>
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium border", erp.className)}>
            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", erp.dot)} />
            {erp.label}
          </span>
        </div>
      </div>
      {/* Inadimplente: precedência máxima */}
      {omieInadimplente && (
        <div className="px-3 py-2 rounded-md bg-red-50 border border-red-300">
          <p className="text-xs text-red-700 font-semibold">
            ! INADIMPLENTE — parcelas vencidas no ERP
          </p>
          <p className="text-xs text-red-600 mt-0.5">
            Acionar cobrança antes de novas negociações
          </p>
        </div>
      )}
      {alert && !omieInadimplente && (
        <div className={cn("text-xs px-3 py-2 rounded-md font-medium", alert.className)}>
          {alert.message}
        </div>
      )}
    </div>
  )
}
