import { cn } from "@/lib/utils"
import { useLeadFinanceiro } from "@/hooks/useLeadFinanceiro"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface FinanceiroTabProps { leadId: string }

const fmt = {
  brl:  (v: number)        => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v),
  date: (s: string | null) => s ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR") : "—",
  pct:  (v: number | null) => v !== null ? `${v.toFixed(1)}%` : "—",
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDENTE:          { label: "Pendente",  className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  PAGO:              { label: "Pago",      className: "bg-green-50 text-green-700 border-green-200" },
  VENCIDO:           { label: "Vencido",   className: "bg-red-50 text-red-700 border-red-200" },
  CANCELADO:         { label: "Cancelado", className: "bg-gray-100 text-gray-500 border-gray-200" },
  PARCIALMENTE_PAGO: { label: "Parcial",   className: "bg-orange-50 text-orange-700 border-orange-200" },
}

const DOC_CONFIG: Record<string, { label: string; className: string }> = {
  BOL: { label: "Boleto", className: "bg-blue-50 text-blue-700" },
  PIX: { label: "PIX",    className: "bg-teal-50 text-teal-700" },
  CRT: { label: "Cartão", className: "bg-purple-50 text-purple-700" },
  CHQ: { label: "Cheque", className: "bg-gray-50 text-gray-600" },
  NFE: { label: "NF-e",   className: "bg-orange-50 text-orange-700" },
  DOC: { label: "TED/DOC",className: "bg-indigo-50 text-indigo-700" },
}

export function FinanceiroTab({ leadId }: FinanceiroTabProps) {
  const { parcelas, resumo } = useLeadFinanceiro(leadId)
  const isLoading = parcelas.isLoading || resumo.isLoading
  const r    = resumo.data
  const list = parcelas.data ?? []

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_,i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (!list.length) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Nenhuma parcela encontrada para este lead.
      </div>
    )
  }

  const temVencidas = (r?.parcelas_vencidas ?? 0) > 0

  const porPedido = list.reduce((acc, p) => {
    const key = p.numero_pedido ?? p.omie_pedido_id?.toString() ?? "sem-pedido"
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {} as Record<string, typeof list>)

  return (
    <div className="space-y-4 p-4">
      {temVencidas && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border bg-red-50 border-red-200">
          <span className="text-red-600 text-sm font-medium">
            ! {r?.parcelas_vencidas} parcela{(r?.parcelas_vencidas ?? 0) > 1 ? "s" : ""} vencida{(r?.parcelas_vencidas ?? 0) > 1 ? "s" : ""}
            {r?.max_dias_vencido ? ` — maior atraso: ${r.max_dias_vencido} dias` : ""}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground mb-1">Total a receber</p>
          <p className="text-xl font-semibold">{fmt.brl(r?.valor_total ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">{r?.total_parcelas ?? 0} parcela{(r?.total_parcelas ?? 0) !== 1 ? "s" : ""}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground mb-1">Recebido</p>
          <p className="text-xl font-semibold text-green-700">{fmt.brl(r?.valor_pago ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">{fmt.pct(r?.percentual_pago ?? null)} quitado</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground mb-1">Pendente</p>
          <p className={cn("text-xl font-semibold", temVencidas ? "text-red-700" : "text-yellow-700")}>
            {fmt.brl(r?.valor_pendente ?? 0)}
          </p>
          {r?.proximo_vencimento && (
            <p className="text-xs text-muted-foreground mt-1">Próx: {fmt.date(r.proximo_vencimento)}</p>
          )}
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground mb-1">Saúde financeira</p>
          <p className="text-xl font-semibold">{fmt.pct(r?.percentual_pago ?? null)}</p>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full", temVencidas ? "bg-red-400" : "bg-green-500")}
                 style={{ width: `${Math.min(r?.percentual_pago ?? 0, 100)}%` }} />
          </div>
        </CardContent></Card>
      </div>

      {Object.entries(porPedido).map(([pedidoKey, parcs]) => {
        const totalPed = parcs.reduce((s, p) => s + p.valor, 0)
        const temAlgo  = parcs.some(p => p.status === "VENCIDO")
        return (
          <Card key={pedidoKey} className={cn(temAlgo && "border-red-200")}>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>
                  Pedido {pedidoKey !== "sem-pedido" ? `#${pedidoKey}` : "s/número"}
                  <span className="text-muted-foreground font-normal ml-2 text-xs">
                    {parcs.length} parcela{parcs.length !== 1 ? "s" : ""} · {fmt.brl(totalPed)}
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {parcs.map(p => {
                  const sc       = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.PENDENTE
                  const dc       = DOC_CONFIG[p.tipo_documento as keyof typeof DOC_CONFIG] ?? DOC_CONFIG.BOL
                  const isVenc   = p.status === "VENCIDO"
                  const diasAtr  = isVenc
                    ? Math.floor((Date.now() - new Date(p.data_vencimento + "T12:00:00").getTime()) / 86_400_000)
                    : 0
                  return (
                    <div key={p.id} className={cn("flex items-center justify-between px-4 py-3", isVenc && "bg-red-50/40")}>
                      <div className="flex items-center gap-3">
                        <div className="text-center min-w-[32px]">
                          <p className="text-sm font-semibold">{p.numero_parcela}</p>
                          <p className="text-xs text-muted-foreground">/{p.total_parcelas}</p>
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">
                              {p.status === "PAGO" && p.data_pagamento
                                ? `Pago em ${fmt.date(p.data_pagamento)}`
                                : `Vence ${fmt.date(p.data_vencimento)}`}
                            </span>
                            <span className={cn("text-xs px-1 py-0.5 rounded font-medium", dc.className)}>
                              {dc.label}
                            </span>
                          </div>
                          {isVenc && diasAtr > 0 && (
                            <p className="text-xs text-red-600 font-medium">
                              {diasAtr} dia{diasAtr !== 1 ? "s" : ""} em atraso
                            </p>
                          )}
                          {p.cobranca_count > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {p.cobranca_count} cobrança{p.cobranca_count !== 1 ? "s" : ""} enviada{p.cobranca_count !== 1 ? "s" : ""}
                              {p.cobranca_enviada_em && ` · última: ${fmt.date(p.cobranca_enviada_em.split("T")[0])}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <div>
                          <p className="text-sm font-semibold">{fmt.brl(p.valor)}</p>
                          {p.valor_pago && p.valor_pago > 0 && p.valor_pago !== p.valor && (
                            <p className="text-xs text-muted-foreground">Pago: {fmt.brl(p.valor_pago)}</p>
                          )}
                        </div>
                        <Badge variant="outline" className={cn("text-xs whitespace-nowrap", sc.className)}>
                          {sc.label}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}

      <p className="text-xs text-muted-foreground text-right px-1">
        {r?.ultima_atualizacao
          ? `Atualizado: ${new Date(r.ultima_atualizacao).toLocaleString("pt-BR")}`
          : ""}
      </p>
    </div>
  )
}