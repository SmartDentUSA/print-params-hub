import { Fragment } from 'react';

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** cells[dayIndex 0=segunda][hour] */
export function MetricHeatmap({ cells, unit = '' }: { cells: number[][]; unit?: string }) {
  const max = Math.max(1, ...cells.flat());
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: 'auto repeat(24, minmax(16px, 1fr))' }}>
        <div />
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} className="text-[9px] text-muted-foreground text-center">{h}</div>
        ))}
        {cells.map((row, di) => (
          <Fragment key={`r-${di}`}>
            <div className="text-[10px] text-muted-foreground pr-2 flex items-center">{DAYS[di]}</div>
            {row.map((v, hi) => (
              <div
                key={`c-${di}-${hi}`}
                className="aspect-square rounded-sm"
                style={{ backgroundColor: `hsl(var(--primary) / ${v === 0 ? 0.06 : 0.15 + 0.85 * (v / max)})` }}
                title={`${DAYS[di]} ${hi}h: ${Math.round(v).toLocaleString('pt-BR')}${unit}`}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function emptyGrid(): number[][] {
  return Array.from({ length: 7 }, () => Array(24).fill(0));
}