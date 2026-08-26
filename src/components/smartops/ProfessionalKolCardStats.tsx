import { Loader2 } from "lucide-react";
import { useKolPerformance, type KolCouponRule } from "@/hooks/useKolPerformance";

const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

interface Props {
  formIds: { id: string; name: string }[];
  coupons: KolCouponRule[];
}

/** Resumo compacto da performance do KOL exibido no card da listagem. */
export default function ProfessionalKolCardStats({ formIds, coupons }: Props) {
  const forms = (formIds ?? []).filter((f) => f?.id);
  const rules = (coupons ?? []).filter((c) => (c?.code || "").trim());
  const perf = useKolPerformance(forms, rules);

  if (forms.length === 0 && rules.length === 0) return null;

  const conv = perf.totals.leads > 0 ? (perf.totals.deals / perf.totals.leads) * 100 : 0;

  return (
    <div className="space-y-1 text-xs border-t pt-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          Performance do KOL
        </span>
        {perf.loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="rounded bg-muted/40 py-1">
          <div className="font-semibold">{perf.totals.leads}</div>
          <div className="text-[10px] text-muted-foreground">Leads</div>
        </div>
        <div className="rounded bg-muted/40 py-1">
          <div className="font-semibold">{conv.toFixed(0)}%</div>
          <div className="text-[10px] text-muted-foreground">Conversão</div>
        </div>
        <div className="rounded bg-muted/40 py-1">
          <div className="font-semibold text-green-600">{money(perf.totals.receita)}</div>
          <div className="text-[10px] text-muted-foreground">Receita</div>
        </div>
      </div>

      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground shrink-0">Formulários:</span>
        <span className="font-medium text-right">{forms.length}</span>
      </div>
      {rules.length > 0 && (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground shrink-0">
            Cupons ({rules.map((c) => c.code).join(", ")}):
          </span>
          <span className="font-medium text-right">
            {perf.totals.vendasCupons} vendas · {money(perf.totals.receitaCupons)}
          </span>
        </div>
      )}
    </div>
  );
}
