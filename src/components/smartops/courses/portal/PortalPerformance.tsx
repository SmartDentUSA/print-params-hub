import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Loader2, Ticket } from "lucide-react";

const FN_URL = "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/professional-course-portal";

const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
const br = (d?: string | null) => (d ? d.split("-").reverse().join("/") : "—");

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface PerfData {
  forms: any[];
  coupons: any[];
  products: any[];
  totals: any;
}

/** Performance do KOL no portal: mesmo layout da ficha do profissional, com seletor de mês/ano. */
export default function PortalPerformance({ token }: { token: string }) {
  const now = new Date();
  const [month, setMonth] = useState<string>("all");
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) ys.push(y);
    return ys;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let from: string | null = null;
      let to: string | null = null;
      if (month !== "all") {
        const m = Number(month);
        const y = Number(year);
        from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const last = new Date(y, m + 1, 0).getDate();
        to = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
      }
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "performance", token, from, to }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setData(json);
    } catch {
      /* mantém último dado */
    } finally {
      setLoading(false);
    }
  }, [token, month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = data?.totals;
  const forms = data?.forms ?? [];
  const coupons = data?.coupons ?? [];
  const products = data?.products ?? [];
  const totalCommission = coupons.reduce(
    (s, c) => s + (c.commission_percent != null ? (c.receita * c.commission_percent) / 100 : 0),
    0,
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="w-5 h-5" /> Performance da parceria
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o período</SelectItem>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear} disabled={month === "all"}>
            <SelectTrigger className="w-[96px] h-8 text-xs">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Formulários ativos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Formulários de indicação
            </span>
            <Badge variant="secondary">{forms.length}</Badge>
          </div>
          {forms.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum formulário de indicação associado.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Formulário</th>
                    <th className="px-2 py-2 text-right">Visitas</th>
                    <th className="px-2 py-2 text-right">Leads gerados</th>
                    <th className="px-2 py-2 text-right">Conversão</th>
                    <th className="px-2 py-2 text-right">Receita gerada</th>
                    <th className="px-2 py-2 text-right">Comissionamento</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map((f) => (
                    <tr key={f.form_id} className="border-t">
                      <td className="px-2 py-2">{f.form_name}</td>
                      <td className="px-2 py-2 text-right">
                        <span className="font-medium">{f.views}</span>
                        {f.visitors > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">({f.visitors} únicos)</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-medium">{f.leads}</td>
                      <td className="px-2 py-2 text-right">
                        <span className="font-medium">{(f.conversao * 100).toFixed(1)}%</span>
                        <span className="ml-1 text-xs text-muted-foreground">({f.deals_ganhos} ganhos)</span>
                      </td>
                      <td className="px-2 py-2 text-right font-medium">{money(f.receita)}</td>
                      <td className="px-2 py-2 text-right font-medium">
                        {f.comissao != null ? money(f.comissao) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/20 text-xs">
                  <tr>
                    <td className="px-2 py-2 uppercase text-muted-foreground">Total</td>
                    <td className="px-2 py-2 text-right font-bold">{totals?.views ?? 0}</td>
                    <td className="px-2 py-2 text-right font-bold">{totals?.leads ?? 0}</td>
                    <td className="px-2 py-2 text-right font-bold">
                      {totals?.leads > 0 ? ((totals.deals / totals.leads) * 100).toFixed(1) : "0.0"}%
                    </td>
                    <td className="px-2 py-2 text-right font-bold">{money(totals?.receita ?? 0)}</td>
                    <td className="px-2 py-2 text-right font-bold">
                      {forms.some((f) => f.comissao != null)
                        ? money(forms.reduce((s, f) => s + (f.comissao ?? 0), 0))
                        : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Conversão = leads que chegaram pelos formulários de indicação e fecharam negócio ganho no CRM.
            Comissionamento = cada produto vendido × % da regra de comissionamento.
          </p>
        </div>

        {/* Cupons ativos */}
        <div className="space-y-2">
          <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">
            <Ticket className="w-3.5 h-3.5" /> Cupons do KOL
          </span>
          {coupons.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum cupom da Loja Integrada cadastrado.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Cupom</th>
                    <th className="px-2 py-2 text-left">Vigência</th>
                    <th className="px-2 py-2 text-right">Vendas geradas</th>
                    <th className="px-2 py-2 text-right">Receita gerada</th>
                    <th className="px-2 py-2 text-right">% comissão</th>
                    <th className="px-2 py-2 text-right">Comissão KOL</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={`${c.cupom}-${c.active_from ?? ""}`} className="border-t">
                      <td className="px-2 py-2 font-medium">{c.cupom}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {br(c.active_from)} → {br(c.active_to)}
                      </td>
                      <td className="px-2 py-2 text-right font-medium">{c.vendas}</td>
                      <td className="px-2 py-2 text-right font-medium">{money(c.receita)}</td>
                      <td className="px-2 py-2 text-right">
                        {c.commission_percent != null ? `${c.commission_percent}%` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-medium">
                        {c.commission_percent != null ? money((c.receita * c.commission_percent) / 100) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {coupons.length > 1 && (
                  <tfoot className="border-t bg-muted/30 text-sm font-semibold">
                    <tr>
                      <td className="px-2 py-2" colSpan={2}>Total</td>
                      <td className="px-2 py-2 text-right">{totals?.vendasCupons ?? 0}</td>
                      <td className="px-2 py-2 text-right">{money(totals?.receitaCupons ?? 0)}</td>
                      <td className="px-2 py-2" />
                      <td className="px-2 py-2 text-right">{money(totalCommission)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Indicadores consolidados */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            { t: "Formulários de indicação", a: `${totals?.leads ?? 0} leads → ${totals?.deals ?? 0} ganhos`, v: totals?.receita ?? 0 },
            { t: "Cupons do e-commerce", a: `${totals?.vendasCupons ?? 0} pedidos · ${totals?.clientesCupons ?? 0} clientes`, v: totals?.receitaCupons ?? 0 },
            {
              t: "Produtos do portfólio vendidos",
              a: `${products.reduce((s, p) => s + p.quantidade, 0)} itens · comissão ${money(products.reduce((s, p) => s + (p.comissao ?? 0), 0))}`,
              v: products.reduce((s, p) => s + p.valor, 0),
            },
          ].map((k) => (
            <div key={k.t} className="rounded-md border p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.t}</div>
              <div className="text-lg font-semibold text-primary">{money(k.v)}</div>
              <div className="text-xs text-muted-foreground">{k.a}</div>
            </div>
          ))}
        </div>

        {/* Produtos vendidos */}
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Produtos do portfólio vendidos pelas indicações
          </span>
          {products.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum produto vendido pelos formulários ou cupons no período.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">Produto</th>
                    <th className="px-2 py-2 text-left">Categoria / subcategoria</th>
                    <th className="px-2 py-2 text-left">Origem</th>
                    <th className="px-2 py-2 text-right">Qtd</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                    <th className="px-2 py-2 text-right">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={`${p.origem}-${p.produto}`} className="border-t">
                      <td className="px-2 py-2">{p.produto}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {[p.categoria, p.subcategoria].filter(Boolean).join(" › ") || "—"}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className="text-[10px]">{p.origem === "cupom" ? "Cupom" : "Formulário"}</Badge>
                      </td>
                      <td className="px-2 py-2 text-right">{p.quantidade}</td>
                      <td className="px-2 py-2 text-right font-medium">{money(p.valor)}</td>
                      <td className="px-2 py-2 text-right">{p.comissao != null ? money(p.comissao) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
