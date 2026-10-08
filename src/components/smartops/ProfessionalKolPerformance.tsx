import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Loader2, Ticket } from "lucide-react";
import { useKolPerformance, type KolCouponRule, type KolProductRule } from "@/hooks/useKolPerformance";

const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

const br = (d?: string | null) => (d ? d.split("-").reverse().join("/") : "—");

interface Props {
  formIds: { id: string; name: string }[];
  coupons: KolCouponRule[];
  commissions?: KolProductRule[];
}

/** Performance do KOL: formulários de indicação (leads, conversão, receita) e cupons ativos. */
export default function ProfessionalKolPerformance({ formIds, coupons, commissions = [] }: Props) {
  const perf = useKolPerformance(formIds, coupons, commissions);
  const commissionOf = (code: string) => {
    const r = (coupons ?? []).find((c) => (c.code || "").trim().toUpperCase() === code.toUpperCase());
    return r?.commission_percent ?? null;
  };
  const totalCommission = perf.coupons.reduce((s, c) => {
    const p = commissionOf(c.cupom);
    return s + (p ? (c.receita * p) / 100 : 0);
  }, 0);
  const hasCoupons = (coupons ?? []).some((c) => (c.code || "").trim());


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" /> Performance do KOL
          {perf.loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Formulários ativos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Formulários ativos
            </span>
            <Badge variant="secondary">{formIds.length}</Badge>
          </div>

          {formIds.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum formulário de indicação associado a este KOL.
            </p>
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
                  {perf.forms.map((f) => (
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
                    <td className="px-2 py-2 text-right font-bold">{perf.totals.views}</td>
                    <td className="px-2 py-2 text-right font-bold">{perf.totals.leads}</td>
                    <td className="px-2 py-2 text-right font-bold">
                      {perf.totals.leads > 0
                        ? ((perf.totals.deals / perf.totals.leads) * 100).toFixed(1)
                        : "0.0"}
                      %
                    </td>
                    <td className="px-2 py-2 text-right font-bold">{money(perf.totals.receita)}</td>
                    <td className="px-2 py-2 text-right font-bold">
                      {perf.forms.some((f) => f.comissao != null)
                        ? money(perf.forms.reduce((s, f) => s + (f.comissao ?? 0), 0))
                        : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Visitas = acessos à página do formulário (visitantes únicos entre parênteses). Conversão = leads que
            chegaram pelos formulários de indicação e fecharam negócio ganho no CRM. Receita = soma dos negócios
            ganhos desses leads. Comissionamento = cada produto vendido × % da regra de comissionamento do produto (a partir da data de ativação); produtos sem regra usam a % do cupom.
          </p>
        </div>

        {/* Cupons ativos */}
        <div className="space-y-2">
          <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-medium">
            <Ticket className="w-3.5 h-3.5" /> Cupons ativos do KOL
          </span>

          {!hasCoupons ? (
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
                  {perf.coupons.map((c) => (
                    <tr key={`${c.cupom}-${c.active_from ?? ""}-${c.active_to ?? ""}`} className="border-t">
                      <td className="px-2 py-2 font-medium">{c.cupom}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {br(c.active_from)} → {br(c.active_to)}
                      </td>
                      <td className="px-2 py-2 text-right font-medium">{c.vendas}</td>
                      <td className="px-2 py-2 text-right font-medium">{money(c.receita)}</td>
                      <td className="px-2 py-2 text-right">{commissionOf(c.cupom) != null ? `${commissionOf(c.cupom)}%` : "—"}</td>
                      <td className="px-2 py-2 text-right font-medium">
                        {commissionOf(c.cupom) != null ? money((c.receita * (commissionOf(c.cupom) as number)) / 100) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {perf.coupons.length > 1 && (
                  <tfoot className="border-t bg-muted/30 text-sm font-semibold">
                    <tr>
                      <td className="px-2 py-2" colSpan={2}>Total</td>
                      <td className="px-2 py-2 text-right">{perf.totals.vendasCupons}</td>
                      <td className="px-2 py-2 text-right">{money(perf.totals.receitaCupons)}</td>
                      <td className="px-2 py-2" />
                      <td className="px-2 py-2 text-right">{money(totalCommission)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Vendas e receita apuradas nos pedidos da Loja Integrada com este cupom. Comissão = receita × % de comissão do KOL definida no cupom.
          </p>
        </div>

        {/* Indicadores consolidados */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            { t: "Formulários ativos", a: `${perf.totals.leads} leads → ${perf.totals.deals} ganhos`, v: perf.totals.receita },
            { t: "Cupons do e-commerce", a: `${perf.totals.vendasCupons} pedidos · ${perf.totals.clientesCupons} clientes`, v: perf.totals.receitaCupons },
            {
              t: "Produtos do portfólio vendidos",
              a: `${perf.products.reduce((s, p) => s + p.quantidade, 0)} itens · comissão ${money(perf.products.reduce((s, p) => s + (p.comissao ?? 0), 0))}`,
              v: perf.products.reduce((s, p) => s + p.valor, 0),
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
          {perf.products.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum produto vendido pelos formulários ou cupons até agora.</p>
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
                  {perf.products.map((p) => (
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
          <p className="text-[11px] text-muted-foreground">
            Formulário = itens das propostas dos negócios ganhos dos leads indicados. Cupom = itens dos pedidos da loja com o cupom do KOL.
            Comissão usa a regra do produto, depois subcategoria, depois categoria (a partir da data de ativação).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
