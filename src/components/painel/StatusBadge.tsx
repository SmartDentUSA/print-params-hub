export type PainelStatus = "ok" | "parcial" | "gap";

const LABEL: Record<PainelStatus, string> = { ok: "ok", parcial: "parcial", gap: "gap" };

export function StatusBadge({ status }: { status: PainelStatus }) {
  return <span className={`pc-badge pc-badge-${status}`}>{LABEL[status]}</span>;
}

export function statusFromData(hasData: boolean, complete = true): PainelStatus {
  if (!hasData) return "gap";
  return complete ? "ok" : "parcial";
}