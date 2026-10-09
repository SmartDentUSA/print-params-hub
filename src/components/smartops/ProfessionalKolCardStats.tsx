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
  const data = series && series.length > 0 ? series : [];
  if (data.length < 2) {
    return <div className="h-8 flex items-end text-xs text-muted-foreground">—</div>;
  }
  const w = 120;
  const h = 28;
  const max = Math.max(...data.map((p) => p.v), 1);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data
    .map((p, i) => `${(i * step).toFixed(1)},${(h - (p.v / max) * h).toFixed(1)}`)
    .join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-hidden">
      <polyline points={areaPoints} fill="hsl(var(--primary) / 0.12)" stroke="none" />
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
    <div className="min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs leading-relaxed">
      <div className="text-muted-foreground break-words">
        <span className="font-medium">{activeCodes.length > 1 ? "Cupons ativos:" : "Cupom ativo:"}</span>{" "}
        <span className="font-semibold text-foreground">{activeCodes.join(" · ") || "Nenhum"}</span>
      </div>
      <div className="contents tabular-nums">
        {channels.map((channel) => (
          <span key={channel.label} className="max-w-full" title={`${channel.label}: conversão ${money(channel.revenue)} · comissão ${channel.commission == null ? "não definida" : money(channel.commission)}`}>
            <span className={channel.label === "Total" ? "font-semibold text-foreground" : "text-muted-foreground"}>{channel.label}</span>{" "}
            <span className="font-semibold text-primary">{money(channel.revenue)}</span>
            <span className="text-muted-foreground"> · </span>
            <span className={channel.label === "Total" ? "font-semibold" : ""}>comissão </span>
            <span className={channel.commission == null ? "text-muted-foreground" : "font-semibold text-success"}>{channel.commission == null ? "—" : money(channel.commission)}</span>
          </span>
        ))}
      </div>
    </div>
  );

  if (forms.length === 0 && rules.length === 0) return null;

  if (compact) {
    const comissaoTxt = (v: number | null) => (v == null ? "—" : money(v));
    const sep = <span className="text-muted-foreground/60">–</span>;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs min-w-0 whitespace-nowrap">
        <VisitorsSparkline series={perf.totals.daily_series} />
        {perf.loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        <span className="tabular-nums">
          <span className="text-muted-foreground">Visitas:</span> <b className="text-foreground">{perf.totals.views.toLocaleString("pt-BR")}</b>
          <span className="text-muted-foreground"> · Únicos:</span> <b className="text-foreground">{perf.totals.visitors.toLocaleString("pt-BR")}</b>
          <span className="text-muted-foreground"> · Leads:</span> <b className="text-foreground">{perf.totals.leads}</b>
        </span>
        {sep}
        <span className="tabular-nums" title="Formulários: receita e comissão">
          <span className="text-muted-foreground">Formulários:</span> <b className="text-primary">{money(perf.totals.receita)}</b>
          <span className="text-muted-foreground"> · Comissão:</span> <b className="text-success">{comissaoTxt(perf.totals.comissao == null ? null : perf.totals.comissaoLeads)}</b>
        </span>
        {rules.length > 0 && (
          <>
            {sep}
            <span className="tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1">
              {perf.coupons.map((c) => {
                const pct = rules.find((r) => r.code === c.cupom)?.commission_percent ?? null;
                const com = pct != null ? (c.receita * pct) / 100 : null;
                return (
                  <span key={c.cupom} title={`Cupom ${c.cupom}: receita e comissão`}>
                    <span className="text-muted-foreground">Cupom</span> <b className="text-foreground">{c.cupom}</b>
                    <span className="text-muted-foreground">:</span> <b className="text-primary">{money(c.receita)}</b>
                    <span className="text-muted-foreground"> · Comissão:</span> <b className="text-success">{comissaoTxt(com)}</b>
                  </span>
                );
              })}
            </span>
          </>
        )}
        {sep}
        <span className="tabular-nums" title="Valor total de comissões (formulários + cupons)">
          <span className="text-muted-foreground">Valor total de comissões:</span> <b className="text-success">{comissaoTxt(perf.totals.comissao)}</b>
        </span>
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
