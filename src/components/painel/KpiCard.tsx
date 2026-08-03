import { StatusBadge, PainelStatus } from "./StatusBadge";

interface KpiCardProps {
  label: string;
  value: string;
  status: PainelStatus;
  delta?: number | null;
  deltaLabel?: string;
  sub?: string;
  tone?: "default" | "ok" | "warn" | "gap" | "info";
}

const toneClass: Record<string, string> = {
  default: "",
  ok: "pc-up",
  warn: "pc-badge-parcial",
  gap: "pc-down",
  info: "pc-info",
};

export function KpiCard({ label, value, status, delta, deltaLabel, sub, tone = "default" }: KpiCardProps) {
  return (
    <div className="pc-card p-3 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <span className="pc-label">{label}</span>
        <StatusBadge status={status} />
      </div>
      <span className={`pc-num ${toneClass[tone]}`}>{value}</span>
      <div className="flex items-center gap-2 text-[0.68rem]">
        {delta !== null && delta !== undefined && (
          <span className={delta >= 0 ? "pc-up" : "pc-down"}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </span>
        )}
        {deltaLabel && <span className="pc-dim">{deltaLabel}</span>}
        {sub && <span className="pc-dim">{sub}</span>}
      </div>
    </div>
  );
}