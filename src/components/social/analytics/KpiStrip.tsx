import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export interface Kpi {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
}

export function KpiStrip({ kpis, loading, cols = 4 }: { kpis: Kpi[]; loading?: boolean; cols?: number }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {kpis.map((k) => (
        <Card key={k.label}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">{k.icon} {k.label}</div>
            <div className="text-2xl font-bold mt-1 tabular-nums">
              {typeof k.value === 'number' ? k.value.toLocaleString('pt-BR') : k.value}
            </div>
            {k.hint ? <div className="text-[11px] text-muted-foreground mt-0.5">{k.hint}</div> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function EmptyChart({ label = 'Sem dados no período' }: { label?: string }) {
  return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">{label}</div>;
}