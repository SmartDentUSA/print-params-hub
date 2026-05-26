import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Kpis {
  total_deals: number | null;
  receita_total: number | null;
  ticket_medio: number | null;
  vendedores_ativos: number | null;
  leads_criados_mes: number | null;
  mes_ref: string | null;
  gerado_em: string | null;
}
interface VendedorRow {
  vendedor: string | null;
  deals_ganhos: number | null;
  receita: number | null;
  ticket_medio: number | null;
  perdidos: number | null;
  leads_mes: number | null;
}
interface FunilRow {
  vendedor: string | null;
  funil: string | null;
  etapa: string | null;
  qtd: number | null;
}
interface OrigemRow {
  origem: string | null;
  total_leads: number | null;
  deals_ganhos: number | null;
  receita: number | null;
  taxa_pct: number | null;
}

const fmtBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(v ?? 0));

const fmtMes = (ym: string | null | undefined) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  const meses = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const idx = Number(m);
  if (!idx || !meses[idx]) return ym;
  return `${meses[idx]}/${y}`;
};

const fmtTime = (d: Date | null) =>
  d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

const convBadgeClass = (pct: number) => {
  if (pct >= 30) return "bg-green-600/20 text-green-400 border-green-600/40";
  if (pct >= 15) return "bg-blue-600/20 text-blue-400 border-blue-600/40";
  if (pct >= 5) return "bg-amber-600/20 text-amber-400 border-amber-600/40";
  return "bg-red-600/20 text-red-400 border-red-600/40";
};

const barColor = (pct: number) => {
  if (pct > 70) return "bg-red-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-green-500";
};

export default function RelatorioMensalComercial() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [vendedores, setVendedores] = useState<VendedorRow[]>([]);
  const [funil, setFunil] = useState<FunilRow[]>([]);
  const [origens, setOrigens] = useState<OrigemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kRes, vRes, fRes, oRes] = await Promise.all([
        supabase.from("v_relatorio_mes_kpis" as any).select("*").maybeSingle(),
        supabase.from("v_relatorio_mes_vendedor" as any).select("*"),
        supabase.from("v_relatorio_mes_funil" as any).select("*"),
        supabase.from("v_relatorio_mes_origem" as any).select("*"),
      ]);
      if (kRes.error) throw kRes.error;
      if (vRes.error) throw vRes.error;
      if (fRes.error) throw fRes.error;
      if (oRes.error) throw oRes.error;
      setKpis((kRes.data as any) ?? null);
      setVendedores(((vRes.data as any[]) ?? []) as VendedorRow[]);
      setFunil(((fRes.data as any[]) ?? []) as FunilRow[]);
      setOrigens(((oRes.data as any[]) ?? []) as OrigemRow[]);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar o relatório.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const vendedoresSorted = useMemo(
    () => [...vendedores].sort((a, b) => Number(b.receita ?? 0) - Number(a.receita ?? 0)),
    [vendedores]
  );

  const totals = useMemo(() => {
    return vendedoresSorted.reduce(
      (acc, v) => {
        acc.deals += Number(v.deals_ganhos ?? 0);
        acc.receita += Number(v.receita ?? 0);
        acc.perdidos += Number(v.perdidos ?? 0);
        acc.leads += Number(v.leads_mes ?? 0);
        return acc;
      },
      { deals: 0, receita: 0, perdidos: 0, leads: 0 }
    );
  }, [vendedoresSorted]);

  // Estagnados por vendedor: soma qtd onde funil contém "Estagnados"
  const estagnadosPorVendedor = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of funil) {
      if (!f.funil || !/Estagnados/i.test(f.funil)) continue;
      const v = f.vendedor || "—";
      map.set(v, (map.get(v) ?? 0) + Number(f.qtd ?? 0));
    }
    // total de deals do vendedor no mês (abertos+ganhos+perdidos como proxy via funil total ou via vendedores)
    const totalPorVendedor = new Map<string, number>();
    for (const f of funil) {
      const v = f.vendedor || "—";
      totalPorVendedor.set(v, (totalPorVendedor.get(v) ?? 0) + Number(f.qtd ?? 0));
    }
    // soma ganhos+perdidos do mês também conta como deals do vendedor
    for (const v of vendedores) {
      const name = v.vendedor || "—";
      const extra = Number(v.deals_ganhos ?? 0) + Number(v.perdidos ?? 0);
      totalPorVendedor.set(name, (totalPorVendedor.get(name) ?? 0) + extra);
    }
    const rows = Array.from(map.entries()).map(([vendedor, qtd]) => {
      const total = totalPorVendedor.get(vendedor) ?? qtd;
      const pct = total > 0 ? (qtd / total) * 100 : 0;
      return { vendedor, qtd, pct };
    });
    rows.sort((a, b) => b.qtd - a.qtd);
    return rows;
  }, [funil, vendedores]);

  const origensFiltradas = useMemo(
    () =>
      origens
        .filter((o) => Number(o.total_leads ?? 0) >= 3)
        .sort((a, b) => Number(b.receita ?? 0) - Number(a.receita ?? 0)),
    [origens]
  );
  const origensAlta = origensFiltradas.filter((o) => Number(o.taxa_pct ?? 0) >= 50);
  const origensBaixa = origensFiltradas.filter((o) => Number(o.taxa_pct ?? 0) < 50);

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-foreground">Não foi possível carregar o relatório</div>
            <div className="text-sm text-muted-foreground mt-1">{error}</div>
            <Button size="sm" variant="outline" className="mt-3" onClick={fetchAll}>
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">
            Relatório Comercial · {fmtMes(kpis?.mes_ref)}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Atualizado às {fmtTime(lastUpdated)}
            </Badge>
            <Button size="icon" variant="outline" onClick={fetchAll} disabled={loading} title="Atualizar agora">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading && !kpis ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-7 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <KpiCard label="Receita CRM" value={fmtBRL(kpis?.receita_total ?? 0)} />
            <KpiCard label="Deals ganhos" value={String(kpis?.total_deals ?? 0)} />
            <KpiCard label="Ticket médio" value={fmtBRL(kpis?.ticket_medio ?? 0)} />
            <KpiCard label="Leads criados" value={String(kpis?.leads_criados_mes ?? 0)} />
          </>
        )}
      </div>

      {/* Vendas por Vendedor */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base">Vendas por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && vendedoresSorted.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Deals ganhos</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Ticket médio</TableHead>
                    <TableHead className="text-right">Perdidos</TableHead>
                    <TableHead className="text-right">Leads mês</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendedoresSorted.map((v) => {
                    const leads = Number(v.leads_mes ?? 0);
                    const ganhos = Number(v.deals_ganhos ?? 0);
                    const pct = leads > 0 ? (ganhos / leads) * 100 : 0;
                    return (
                      <TableRow key={v.vendedor ?? "—"}>
                        <TableCell className="font-medium text-foreground">{v.vendedor ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono">{ganhos}</TableCell>
                        <TableCell className="text-right font-mono">{fmtBRL(v.receita ?? 0)}</TableCell>
                        <TableCell className="text-right font-mono">{fmtBRL(v.ticket_medio ?? 0)}</TableCell>
                        <TableCell className="text-right font-mono">{Number(v.perdidos ?? 0)}</TableCell>
                        <TableCell className="text-right font-mono">{leads}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={convBadgeClass(pct)}>
                            {pct.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {vendedoresSorted.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum vendedor com atividade no mês
                      </TableCell>
                    </TableRow>
                  )}
                  {vendedoresSorted.length > 0 && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell className="text-foreground">Total</TableCell>
                      <TableCell className="text-right font-mono">{totals.deals}</TableCell>
                      <TableCell className="text-right font-mono">{fmtBRL(totals.receita)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtBRL(totals.deals > 0 ? totals.receita / totals.deals : 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{totals.perdidos}</TableCell>
                      <TableCell className="text-right font-mono">{totals.leads}</TableCell>
                      <TableCell className="text-right font-mono">
                        {totals.leads > 0 ? ((totals.deals / totals.leads) * 100).toFixed(1) : "0.0"}%
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estagnados */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base">
            Deals Enviados para Estagnados por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && estagnadosPorVendedor.length === 0 ? (
            <Skeleton className="h-32 w-full" />
          ) : estagnadosPorVendedor.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum deal estagnado no mês.</div>
          ) : (
            <div className="space-y-3">
              {estagnadosPorVendedor.map((r) => (
                <div key={r.vendedor} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{r.vendedor}</span>
                    <span className="text-muted-foreground font-mono">
                      {r.qtd} <span className="opacity-60">·</span> {r.pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${barColor(r.pct)} transition-all`}
                      style={{ width: `${Math.min(100, Math.max(0, r.pct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversão por Origem */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base">Conversão por Origem</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && origensFiltradas.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : origensFiltradas.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem origens com 3+ leads no mês.</div>
          ) : (
            <div className="overflow-x-auto space-y-4">
              <OrigemTable
                title="Alta conversão (≥ 50%)"
                rows={origensAlta}
                emptyLabel="Nenhuma origem com alta conversão"
              />
              <Separator />
              <OrigemTable
                title="Baixa conversão (< 50%)"
                rows={origensBaixa}
                emptyLabel="Nenhuma origem nesta faixa"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold font-mono text-foreground mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function OrigemTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: OrigemRow[];
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Origem</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Ganhos</TableHead>
            <TableHead className="text-right">Taxa</TableHead>
            <TableHead className="text-right">Receita</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-4 text-sm">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((o) => {
              const pct = Number(o.taxa_pct ?? 0);
              return (
                <TableRow key={o.origem ?? "—"}>
                  <TableCell className="text-foreground">{o.origem ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{Number(o.total_leads ?? 0)}</TableCell>
                  <TableCell className="text-right font-mono">{Number(o.deals_ganhos ?? 0)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={convBadgeClass(pct)}>
                      {pct.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmtBRL(o.receita ?? 0)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}