import type { ProfessionalCourseLeads } from "@/lib/professionalCourseLeads";

const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

interface Props {
  data?: ProfessionalCourseLeads;
  compact?: boolean;
}

/** Leads das inscrições públicas dos cursos do profissional (instrutor ou recomendado). Sem comissão. */
export default function ProfessionalCourseLeadStats({ data, compact }: Props) {
  if (!data || data.courses.length === 0) return null;
  const { totals } = data;
  const conv = totals.leads > 0 ? (totals.wonLeads / totals.leads) * 100 : 0;

  if (compact) {
    return (
      <span className="text-xs tabular-nums whitespace-nowrap" title="Inscrições públicas e lista de espera dos cursos do profissional (sem comissão)">
        <span className="text-muted-foreground">Cursos:</span> <b className="text-foreground">{totals.leads}</b>
        <span className="text-muted-foreground"> leads · Vendas:</span> <b className="text-foreground">{totals.wonDeals}</b>
        <span className="text-muted-foreground"> · </span><b className="text-primary">{money(totals.wonValue)}</b>
      </span>
    );
  }

  return (
    <div className="space-y-1 text-xs border-t pt-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        Leads de cursos
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="rounded bg-muted/40 py-1">
          <div className="font-semibold">{totals.leads}</div>
          <div className="text-[10px] text-muted-foreground">Leads</div>
        </div>
        <div className="rounded bg-muted/40 py-1">
          <div className="font-semibold">{conv.toFixed(0)}%</div>
          <div className="text-[10px] text-muted-foreground">Conversão</div>
        </div>
        <div className="rounded bg-muted/40 py-1">
          <div className="font-semibold text-primary">{money(totals.wonValue)}</div>
          <div className="text-[10px] text-muted-foreground">Vendas</div>
        </div>
      </div>
      {data.courses.map((c) => (
        <div key={c.course_id} className="flex justify-between gap-2">
          <span className="text-muted-foreground truncate" title={c.course_title}>{c.course_title}</span>
          <span className="font-medium text-right shrink-0 tabular-nums">
            {c.leads} → {c.won_leads} · {money(c.won_value)}
          </span>
        </div>
      ))}
      <div className="text-[10px] text-muted-foreground">
        Inscrições pelo link público e lista de espera. Vendas ganhas após a inscrição; não entram na comissão.
      </div>
    </div>
  );
}
