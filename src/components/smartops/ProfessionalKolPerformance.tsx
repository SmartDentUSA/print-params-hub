import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Loader2, Ticket } from "lucide-react";
import { useKolPerformance, type KolCouponRule } from "@/hooks/useKolPerformance";

const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

const br = (d?: string | null) => (d ? d.split("-").reverse().join("/") : "—");

interface Props {
  formIds: { id: string; name: string }[];
  coupons: KolCouponRule[];
}

/** Performance do KOL: formulários de indicação (leads, conversão, receita) e cupons ativos. */
export default function ProfessionalKolPerformance({ formIds, coupons }: Props) {
  const perf = useKolPerformance(formIds, coupons);
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
                    <th className="px-2 py-2 text-right">Leads gerados</th>
                    <th className="px-2 py-2 text-right">Conversão</th>
                    <th className="px-2 py-2 text-right">Receita gerada</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.forms.map((f) => (
                    <tr key={f.form_id} className="border-t">
                      <td className="px-2 py-2">{f.form_name}</td>
                      <td className="px-2 py-2 text-right font-medium">{f.leads}</td>
                      <td className="px-2 py-2 text-right">
                        <span className="font-medium">{(f.conversao * 100).toFixed(1)}%</span>
                        <span className="ml-1 text-xs text-muted-foreground">({f.deals_ganhos} ganhos)</span>
                      </td>
                      <td className="px-2 py-2 text-right font-medium">{money(f.receita)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/20 text-xs">
                  <tr>
                    <td className="px-2 py-2 uppercase text-muted-foreground">Total</td>
                    <td className="px-2 py-2 text-right font-bold">{perf.totals.leads}</td>
                    <td className="px-2 py-2 text-right font-bold">
                      {perf.totals.leads > 0
                        ? ((perf.totals.deals / perf.totals.leads) * 100).toFixed(1)
                        : "0.0"}
                      %
                    </td>
                    <td className="px-2 py-2 text-right font-bold">{money(perf.totals.receita)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Conversão = leads que chegaram pelos formulários de indicação e fecharam negócio ganho no CRM.
            Receita = soma dos negócios ganhos desses leads.
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
                    </tr>
                  ))}
                </tbody>
                {perf.coupons.length > 1 && (
                  <tfoot className="border-t bg-muted/30 text-sm font-semibold">
                    <tr>
                      <td className="px-2 py-2" colSpan={2}>Total</td>
                      <td className="px-2 py-2 text-right">{perf.totals.vendasCupons}</td>
                      <td className="px-2 py-2 text-right">{money(perf.totals.receitaCupons)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Vendas e receita apuradas nos pedidos da Loja Integrada com este cupom.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
