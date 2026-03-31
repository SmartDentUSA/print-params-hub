import { cn } from "@/lib/utils"
import { useLeadErpData } from "@/hooks/useLeadErpData"
import { DualStatusBadge } from "../DualStatusBadge"
import { FreteStatusBadge } from "../FreteStatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface ErpDataTabProps { leadId: string }

const fmt = {
  brl:      (v: number)        => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v),
  date:     (s: string | null) => s ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR") : "—",
  datetime: (s: string | null) => s ? new Date(s).toLocaleString("pt-BR", { day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit" }) : "Nunca sincronizado",
}

const CLASSIFICACAO_CONFIG: Record<string, { emoji: string; label: string; className: string; insight: string }> = {
  PRIORIDADE:  { emoji: "🔥", label: "Prioridade",  className: "bg-green-50 border-green-200 text-green-800",  insight: "Cliente premium e adimplente — priorizar atendimento" },
  RECUPERACAO: { emoji: "⚠",  label: "Recuperação", className: "bg-red-50 border-red-200 text-red-800",        insight: "Inadimplente — acionar cobrança antes de novas negociações" },
  REATIVACAO:  { emoji: "💤", label: "Reativação",  className: "bg-orange-50 border-orange-200 text-orange-800",insight: "Sem compras há mais de 6 meses — oportunidade de reativação" },
  ATIVO:       { emoji: "✓",  label: "Ativo",       className: "bg-blue-50 border-blue-200 text-blue-800",      insight: "Cliente regular com histórico ativo" },
  MONITORAR:   { emoji: "👁",  label: "Monitorar",   className: "bg-gray-50 border-gray-200 text-gray-700",      insight: "Poucos dados financeiros — monitorar evolução" },
}

export function ErpDataTab({ leadId }: ErpDataTabProps) {
  const { data, isLoading, isError } = useLeadErpData(leadId)

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_,i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }
  if (isError) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Erro ao carregar dados do ERP.</div>
  }

  const hasItems   = (data?.items?.length ?? 0) > 0
  const hasFrete   = data?.freteStatus && data.freteStatus !== "NONE"
  const hasHistory = (data?.statusHistory?.length ?? 0) > 0
  const classif    = CLASSIFICACAO_CONFIG[data?.omieClassificacao ?? ""]

  return (
    <div className="space-y-4 p-4">
      {/* Status CRM/ERP */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <DualStatusBadge
            crmStatus={data?.crmStatus ?? null}
            erpStatus={data?.erpStatus ?? "NONE"}
            realStatus={data?.realStatus ?? null}
            omieInadimplente={data?.omieInadimplente}
            compact={false}
          />
        </CardContent>
      </Card>

      {/* ── Classificação Operacional ── */}
      {classif && (
        <div className={cn("px-3 py-2.5 rounded-lg border", classif.className)}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{classif.emoji}</span>
            <span className="text-sm font-semibold">{classif.label}</span>
          </div>
          <p className="text-xs opacity-80">{classif.insight}</p>
        </div>
      )}

      {/* ── Score Omie ── */}
      {(data?.omieScore ?? 0) > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Score Omie ERP
              </p>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium border",
                data?.omieScoreLabel === "PREMIUM"     && "bg-green-50  text-green-800  border-green-200",
                data?.omieScoreLabel === "ATIVO"        && "bg-blue-50   text-blue-800   border-blue-200",
                data?.omieScoreLabel === "OPORTUNIDADE" && "bg-yellow-50 text-yellow-800 border-yellow-200",
                data?.omieScoreLabel === "RISCO"        && "bg-red-50    text-red-800    border-red-200",
                !data?.omieScoreLabel                   && "bg-gray-50   text-gray-600   border-gray-200"
              )}>
                {data?.omieScoreLabel ?? "Sem dados"}
              </span>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-semibold">{data?.omieScore}</span>
              <span className="text-sm text-muted-foreground mb-0.5">/100</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all",
                  (data?.omieScore ?? 0) >= 80 ? "bg-green-500"  :
                  (data?.omieScore ?? 0) >= 50 ? "bg-blue-500"   :
                  (data?.omieScore ?? 0) >= 20 ? "bg-yellow-500" : "bg-red-400"
                )}
                style={{ width: `${Math.min(data?.omieScore ?? 0, 100)}%` }}
              />
            </div>
            {data?.omieInadimplente && (
              <div className="mt-2 px-2 py-1.5 rounded bg-red-50 border border-red-200">
                <p className="text-xs text-red-700 font-medium">
                  ! Parcelas vencidas detectadas — score penalizado
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Resumo Financeiro ERP ── */}
      {(data?.omieFaturamentoTotal ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resumo financeiro ERP</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Faturamento total",  value: data?.omieFaturamentoTotal, color: "" },
                { label: "Recebido",           value: data?.omieValorPago,         color: "text-green-700" },
                { label: "Em aberto",          value: data?.omieValorEmAberto,
                  color: (data?.omieValorVencido ?? 0) > 0 ? "text-red-700" : "text-yellow-700" },
                { label: "% quitado",          value: null as number | null,
                  display: `${(data?.omiePercentualPago ?? 0).toFixed(1)}%`, color: "" },
              ].map(({ label, value, display, color }) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={cn("text-base font-semibold", color)}>
                    {display ?? fmt.brl(value ?? 0)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full",
                  data?.omieInadimplente ? "bg-red-400" : "bg-green-500")}
                style={{ width: `${Math.min(data?.omiePercentualPago ?? 0, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Comportamento de Compra ── */}
      {(data?.omieFrequenciaCompra ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Comportamento de compra</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Ticket médio</p>
                <p className="font-semibold">{fmt.brl(data?.omieTicketMedio ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pedidos</p>
                <p className="font-semibold">{data?.omieTotalPedidos ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">NFs emitidas</p>
                <p className="font-semibold">{data?.omieFrequenciaCompra ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Última compra</p>
                <p className="font-semibold">
                  {data?.omieUltimaCompra
                    ? new Date(data.omieUltimaCompra + "T12:00:00").toLocaleDateString("pt-BR")
                    : "—"}
                </p>
              </div>
              {(data?.omieDiasSemComprar ?? null) !== null && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Dias sem comprar</p>
                  <p className={cn("font-semibold",
                    (data?.omieDiasSemComprar ?? 0) > 180 ? "text-red-600"    :
                    (data?.omieDiasSemComprar ?? 0) > 90  ? "text-orange-600" : ""
                  )}>
                    {data?.omieDiasSemComprar} dias
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Identidade ERP ── */}
      {(data?.omieTipoPessoa || data?.omieRazaoSocial || data?.omieSegmento) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Identidade ERP</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {data?.omieTipoPessoa && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Tipo</p>
                <span className={cn("text-xs px-2 py-0.5 rounded font-medium",
                  data.omieTipoPessoa === "PJ"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-gray-50 text-gray-700"
                )}>
                  {data.omieTipoPessoa === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
                </span>
              </div>
            )}
            {data?.omieRazaoSocial && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground shrink-0">Razão social</p>
                <p className="text-xs font-medium text-right truncate max-w-[200px]">
                  {data.omieRazaoSocial}
                </p>
              </div>
            )}
            {data?.omieSegmento && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Segmento</p>
                <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">
                  {data.omieSegmento}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Frete */}
      {hasFrete && (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <FreteStatusBadge
              freteStatus={data?.freteStatus ?? null}
              rastreio={data?.freteCodigoRastreio}
              link={data?.freteLink}
              transportadora={data?.freteTransportadora}
              previsaoEntrega={data?.fretePrevisaoEntrega}
              compact={false}
            />
            {data?.freteValor && data.freteValor > 0 && (
              <p className="text-xs text-muted-foreground pl-1">
                <span className="font-medium">Valor do frete:</span> {fmt.brl(data.freteValor)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Métricas existentes */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground mb-1">LTV Omie</p>
          <p className="text-lg font-semibold">{fmt.brl(data?.totalLtv ?? 0)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground mb-1">Itens comprados</p>
          <p className="text-lg font-semibold">{data?.totalOrders ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground mb-1">NFs emitidas</p>
          <p className="text-lg font-semibold">{data?.nfCount ?? 0}</p>
        </CardContent></Card>
      </div>

      {/* Tabela de pedidos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Pedidos — Omie ERP</span>
            {hasItems && (
              <Badge variant="secondary" className="text-xs">
                Último: {fmt.date(data?.lastOrderDate ?? null)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!hasItems ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido encontrado no Omie para este lead.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>NF</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-[180px]">
                      <span className="truncate block text-sm font-medium" title={item.product_name}>
                        {item.product_name}
                      </span>
                      <span className="text-xs text-muted-foreground">{item.product_code}</span>
                    </TableCell>
                    <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                    <TableCell className="text-right text-sm">{fmt.brl(item.unit_value)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{fmt.brl(item.total_value)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.nfe_number ?? "—"}</TableCell>
                    <TableCell>
                      {item.serial_number
                        ? <Badge variant="outline" className="text-xs font-mono">{item.serial_number}</Badge>
                        : <span className="text-muted-foreground text-sm">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmt.date(item.synced_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Histórico de status */}
      {hasHistory && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Histórico de status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data?.statusHistory.map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                      entry.source === "erp" ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700")}>
                      {entry.source.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium">{entry.status}</span>
                    {entry.event_name && (
                      <span className="text-xs text-muted-foreground">via {entry.event_name}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {fmt.datetime(entry.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-right px-1">
        Última sync Omie: {fmt.datetime(data?.omieLastSync ?? null)}
      </p>
    </div>
  )
}
