import { PainelFunilRow, fmtDias, fmtNum, fmtPct } from "@/hooks/painel/usePainelComercial";
import { StatusBadge, statusFromData } from "./StatusBadge";

export function FunnelPanel({ rows }: { rows: PainelFunilRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.atual));
  const hasTempo = rows.some((r) => r.media_dias !== null);

  return (
    <div className="pc-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Funil de conversão — etapa por etapa</h2>
        <StatusBadge status={statusFromData(rows.length > 0, hasTempo)} />
      </div>
      <div className="flex gap-2 items-stretch overflow-x-auto">
        {rows.map((r) => (
          <div key={r.etapa} className="pc-funnel-step">
            <div className="pc-label truncate" title={r.etapa}>{r.etapa}</div>
            <div className="pc-num-sm mt-1">{fmtNum(r.atual)}</div>
            <div className="pc-bar mt-2">
              <span style={{ width: `${Math.round((r.atual / max) * 100)}%` }} />
            </div>
            <div className="mt-2 text-[0.66rem] pc-dim flex flex-col gap-0.5">
              <span>Tempo médio {fmtDias(r.media_dias)}</span>
              <span>Perda {fmtPct(r.pct_perda)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}