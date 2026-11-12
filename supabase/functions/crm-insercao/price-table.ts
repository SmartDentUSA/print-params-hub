// Tabela vigente para o comercial (Agenda). Regra única: tabelas "Ativa para
// comercial", com status ativo e período completo, valem do início (00:00) ao
// fim (23:59:59) no horário de São Paulo e trocam sozinhas à meia-noite.
// Em sobreposição vence a que começou por último (ex.: Black Friday sobre a
// tabela do mês); empate → a editada mais recentemente.

export type CommercialTableRow = {
  id: string;
  name: string;
  status: string | null;
  commercial_active: boolean | null;
  valid_from: string | null;
  valid_until: string | null;
  updated_at?: string | null;
};

const SP_OFFSET = "-03:00"; // São Paulo sem horário de verão desde 2019
const DAY = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function tableWindow(t: CommercialTableRow): { startsAt: number; endsAt: number } | null {
  if (t.status !== "active" || t.commercial_active !== true) return null;
  const from = String(t.valid_from ?? "").slice(0, 10);
  const until = String(t.valid_until ?? "").slice(0, 10);
  if (!DATE_RE.test(from) || !DATE_RE.test(until)) return null;
  const startsAt = Date.parse(`${from}T00:00:00${SP_OFFSET}`);
  const endsAt = Date.parse(`${until}T00:00:00${SP_OFFSET}`) + DAY;
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) return null;
  return { startsAt, endsAt };
}

export function pickCommercialTables<T extends CommercialTableRow>(rows: T[], now: number) {
  const eligible = rows
    .map((row) => ({ row, win: tableWindow(row) }))
    .filter((x): x is { row: T; win: { startsAt: number; endsAt: number } } => x.win !== null);

  const current = eligible
    .filter((x) => x.win.startsAt <= now && now < x.win.endsAt)
    .sort((a, b) => b.win.startsAt - a.win.startsAt || String(b.row.updated_at ?? "").localeCompare(String(a.row.updated_at ?? "")))[0] ?? null;

  const next = eligible
    .filter((x) => x.win.startsAt > now)
    .sort((a, b) => a.win.startsAt - b.win.startsAt)[0] ?? null;

  return {
    current: current ? { row: current.row, starts_at: new Date(current.win.startsAt).toISOString(), ends_at: new Date(current.win.endsAt).toISOString() } : null,
    next: next ? { row: next.row, starts_at: new Date(next.win.startsAt).toISOString(), ends_at: new Date(next.win.endsAt).toISOString() } : null,
  };
}
