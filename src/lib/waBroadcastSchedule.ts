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

export interface PlannedBatch { at: Date; count: number }

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
  /** Lotes previstos (mesma divisão do servidor). */
  batches: PlannedBatch[];
  /** Quantos períodos de 24 h o disparo ocupa por causa do máximo por dia. */
  days: number;
}

/**
 * Mesma divisão de zernio-wa-broadcast/plan.ts (planSlots): no máximo perHour por hora e perDay a cada
 * 24 h corridas (o limite da Meta), sempre dentro da janela 07:30–19:00.
 */
export function planBroadcast(opts: { leads: number; perHour: number | null; perDay?: number | null; scheduledAtIso: string | null; now: Date }): BroadcastPlan {
  const per = opts.perHour && opts.perHour > 0 ? Math.floor(opts.perHour) : null;
  const day = opts.perDay && opts.perDay > 0 ? Math.floor(opts.perDay) : null;
  const total = Math.max(0, Math.floor(opts.leads));
  const splitByDay = !!day && total > day;
  const scheduled = !!per || !!opts.scheduledAtIso || splitByDay;
  const rawStart = opts.scheduledAtIso ? new Date(opts.scheduledAtIso) : new Date(opts.now.getTime() + (scheduled ? 2 * 60_000 : 0));
  const startAt = scheduled ? pushIntoWindow(rawStart) : rawStart;
  let movedByWindow = startAt.getTime() !== rawStart.getTime();
  const batches: PlannedBatch[] = [];
  let days = 1;
  if (!per && !splitByDay) {
    batches.push({ at: startAt, count: total });
  } else {
    let at = startAt, periodStart = startAt, used = 0;
    for (let i = 0; i < total;) {
      if (day && used >= day) {
        const raw = new Date(Math.max(at.getTime(), periodStart.getTime() + 86_400_000));
        at = pushIntoWindow(raw);
        if (at.getTime() !== raw.getTime()) movedByWindow = true;
        periodStart = at; used = 0; days++;
      } else if (day && at.getTime() >= periodStart.getTime() + 86_400_000) {
        periodStart = at; used = 0; days++;
      }
      const size = Math.min(per ?? Infinity, day ? day - used : Infinity, total - i);
      batches.push({ at, count: size });
      i += size; used += size;
      if (i < total && per) {
        const next = new Date(at.getTime() + 3_600_000);
        at = pushIntoWindow(next);
        if (at.getTime() !== next.getTime()) movedByWindow = true;
      }
    }
    if (!batches.length) batches.push({ at: startAt, count: 0 });
  }
  const lastAt = batches[batches.length - 1].at;
  const durationHours = per || splitByDay ? Math.round((lastAt.getTime() - startAt.getTime()) / 3_600_000) + 1 : 0;
  return { scheduled, slots: batches.length, startAt, lastAt, durationHours, movedByWindow, batches, days };
}

/** Campos do sistema no meio do texto livre, igual ao servidor (fillTokens). */
export const TOKEN_DEFAULTS: Record<string, string> = { primeiro_nome: "colega" };
export function fillTokens(text: string, valueOf: (key: string) => string | null): string {
  const out = String(text ?? "").replace(/\{([a-z_]+)\}/g, (m, key: string) => {
    const v = valueOf(key);
    if (v == null) return m;
    return v || TOKEN_DEFAULTS[key] || "";
  });
  return out.replace(/ {2,}/g, " ").replace(/ +([,.!?;:])/g, "$1").trim();
}

/** Custo estimado da campanha (mensagens × custo por mensagem), em reais. */
export function estimateCost(messages: number, costPerMessage: number): number {
  return Math.round(Math.max(0, messages) * Math.max(0, costPerMessage) * 100) / 100;
}

/** Número novo na Meta entrega só 250 contatos únicos por dia. */
export const META_NEW_NUMBER_DAILY_LIMIT = 250;
