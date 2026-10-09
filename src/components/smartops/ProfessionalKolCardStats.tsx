import { Loader2 } from "lucide-react";
import { activeKolCouponCodes, kolCardChannels } from "@/lib/kolCardMetrics";
import { useKolPerformance, type KolCouponRule, type KolProductRule } from "@/hooks/useKolPerformance";

const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

interface Props {
  formIds: { id: string; name: string }[];
  coupons: KolCouponRule[];
  /** Regras de comissionamento do KOL (produto, subcategoria ou categoria). */
  commissions?: KolProductRule[];
  compact?: boolean;
}

function VisitorsSparkline({ series }: { series: Array<{ d: string; v: number }> }) {
  if (series.length < 2) return <div className="h-7 w-20" />;
  const width = 80;
  const height = 24;
  const max = Math.max(...series.map((point) => point.v), 1);
  const step = width / (series.length - 1);
  const points = series
    .map((point, index) => `${(index * step).toFixed(1)},${(height - (point.v / max) * height).toFixed(1)}`)
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`-1 -1 ${width + 2} ${height + 2}`} aria-label="Visitas nos últimos 30 dias" className="shrink-0 overflow-hidden">
      <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
    </svg>
  );
}

/** Resumo compacto da performance do KOL exibido no card da listagem. */
export default function ProfessionalKolCardStats({ formIds, coupons, commissions, compact }: Props) {
  const forms = (formIds ?? []).filter((f) => f?.id);
  const rules = (coupons ?? []).filter((c) => (c?.code || "").trim());
  const perf = useKolPerformance(forms, rules, commissions ?? []);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const activeCodes = activeKolCouponCodes(rules, today);
  const channels = kolCardChannels(perf.totals);
  const financialSummary = (
    <div className="min-w-0 w-full space-y-1 overflow-hidden">
      <div className="text-[10px] text-muted-foreground break-words">
        <span className="font-medium">{activeCodes.length > 1 ? "Cupons ativos:" : "Cupom ativo:"}</span>{" "}
        <span className="font-semibold text-foreground">{activeCodes.join(" · ") || "Nenhum"}</span>
      </div>
      <table className="w-full text-[10px] tabular-nums">
        <thead><tr className="text-muted-foreground">
          <th className="text-left font-normal pr-3">Origem</th>
          <th className="text-right font-normal px-2">Conversão R$</th>
          <th className="text-right font-normal pl-2">Comissão R$</th>
        </tr></thead>
        <tbody>{channels.map((channel) => (
          <tr key={channel.label} className={channel.label === "Total" ? "border-t border-border font-semibold" : ""}>
            <td className="text-left pr-3 py-0.5">{channel.label}</td>
            <td className="text-right px-2 py-0.5 text-primary whitespace-nowrap">{money(channel.revenue)}</td>
            <td className="text-right pl-2 py-0.5 text-success whitespace-nowrap">{channel.commission == null ? "—" : money(channel.commission)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );

  if (forms.length === 0 && rules.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-xs min-w-0">
        {perf.loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        <div className="flex shrink-0 items-center gap-2 overflow-hidden rounded-md bg-muted/50 px-2 py-1 leading-tight">
          <div>
            <div className="font-semibold tabular-nums">{perf.totals.views.toLocaleString("pt-BR")}</div>
            <div className="text-[9px] text-muted-foreground">{perf.totals.visitors.toLocaleString("pt-BR")} únicos</div>
          </div>
          <VisitorsSparkline series={perf.totals.daily_series} />
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1 text-center leading-tight">
          <div className="font-semibold">{perf.totals.leads}</div>
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Leads</div>
        </div>
        {financialSummary}
      </div>
    );
  }

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
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground shrink-0">Visualizações dos formulários:</span>
        <span className="font-medium text-right">{perf.totals.views} ({perf.totals.visitors} pessoas)</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground shrink-0">Leads gerados → ganhos:</span>
        <span className="font-medium text-right">{perf.totals.leads} → {perf.totals.deals}</span>
      </div>
      {financialSummary}
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground shrink-0">Cupons gerados:</span>
        <span className="font-medium text-right">{perf.totals.cuponsGerados}</span>
      </div>
      {rules.length > 0 && (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground shrink-0">
            Cupons ({rules.map((c) => c.code).join(", ")}):
          </span>
          <span className="font-medium text-right">
            {perf.totals.vendasCupons} usos · {perf.totals.clientesCupons} clientes · {money(perf.totals.receitaCupons)}
          </span>
        </div>
      )}
    </div>
  );
}
