// Resumo do disparo WhatsApp Oficial (mesma divisão por hora do servidor, zernio-wa-broadcast/plan.ts).

/** "2026-11-20T09:00" digitado no fuso de São Paulo (UTC-3, sem horário de verão) → ISO UTC. */
export function saoPauloLocalToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function fmtSaoPaulo(d: Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

export interface BroadcastPlan {
  scheduled: boolean;
  slots: number;
  startAt: Date;
  /** Horário do último lote. */
  lastAt: Date;
  durationHours: number;
}

export function planBroadcast(opts: { leads: number; perHour: number | null; scheduledAtIso: string | null; now: Date }): BroadcastPlan {
  const per = opts.perHour && opts.perHour > 0 ? Math.floor(opts.perHour) : null;
  const scheduled = !!per || !!opts.scheduledAtIso;
  const startAt = opts.scheduledAtIso ? new Date(opts.scheduledAtIso) : new Date(opts.now.getTime() + (per ? 2 * 60_000 : 0));
  const slots = per ? Math.max(1, Math.ceil(opts.leads / per)) : 1;
  const lastAt = new Date(startAt.getTime() + (slots - 1) * 3_600_000);
  return { scheduled, slots, startAt, lastAt, durationHours: per ? slots : 0 };
}

/** Número novo na Meta entrega só 250 contatos únicos por dia. */
export const META_NEW_NUMBER_DAILY_LIMIT = 250;
