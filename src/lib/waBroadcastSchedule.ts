// Resumo do disparo WhatsApp Oficial (mesma divisão por hora e janela do servidor, zernio-wa-broadcast/plan.ts).

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

/** Janela padrão das campanhas (horário de São Paulo), igual ao servidor. */
export const SEND_WINDOW: [string, string] = ["07:30", "19:00"];
const SP_OFFSET_MS = 3 * 3_600_000;
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/** Fora da janela, vai para o início da próxima janela. */
export function pushIntoWindow(d: Date, window: [string, string] = SEND_WINDOW): Date {
  const start = toMin(window[0]), end = toMin(window[1]);
  const local = new Date(d.getTime() - SP_OFFSET_MS);
  const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
  if (mins >= start && mins < end) return d;
  const dayStartUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + SP_OFFSET_MS;
  return new Date(dayStartUtc + (mins >= end ? 86_400_000 : 0) + start * 60_000);
}

export interface BroadcastPlan {
  scheduled: boolean;
  slots: number;
  startAt: Date;
  /** Horário do último lote. */
  lastAt: Date;
  /** Horas entre o primeiro lote e o fim previsto (último lote + 1 h). */
  durationHours: number;
  /** Algum lote foi empurrado para a próxima janela de envio. */
  movedByWindow: boolean;
}

export function planBroadcast(opts: { leads: number; perHour: number | null; scheduledAtIso: string | null; now: Date }): BroadcastPlan {
  const per = opts.perHour && opts.perHour > 0 ? Math.floor(opts.perHour) : null;
  const scheduled = !!per || !!opts.scheduledAtIso;
  const rawStart = opts.scheduledAtIso ? new Date(opts.scheduledAtIso) : new Date(opts.now.getTime() + (per ? 2 * 60_000 : 0));
  const startAt = scheduled ? pushIntoWindow(rawStart) : rawStart;
  let movedByWindow = startAt.getTime() !== rawStart.getTime();
  const slots = per ? Math.max(1, Math.ceil(opts.leads / per)) : 1;
  let lastAt = startAt;
  for (let k = 1; k < slots; k++) {
    const next = new Date(lastAt.getTime() + 3_600_000);
    lastAt = pushIntoWindow(next);
    if (lastAt.getTime() !== next.getTime()) movedByWindow = true;
  }
  const durationHours = per ? Math.round((lastAt.getTime() - startAt.getTime()) / 3_600_000) + 1 : 0;
  return { scheduled, slots, startAt, lastAt, durationHours, movedByWindow };
}

/** Número novo na Meta entrega só 250 contatos únicos por dia. */
export const META_NEW_NUMBER_DAILY_LIMIT = 250;
