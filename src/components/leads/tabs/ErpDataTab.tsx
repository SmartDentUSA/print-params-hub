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

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardContent className="pt-4 pb-4">
          <DualStatusBadge
            crmStatus={data?.crmStatus ?? null}
            erpStatus={data?.erpStatus ?? "NONE"}
            realStatus={data?.realStatus ?? null}
            compact={false}
          />
        </CardContent>
      </Card>

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