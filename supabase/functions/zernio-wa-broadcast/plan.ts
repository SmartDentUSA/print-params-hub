// Regras puras do disparo WhatsApp Oficial: leitura do template e plano de lotes por hora.
// Sem rede nem banco, para poder testar.

export type HeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
export const MEDIA_HEADERS: HeaderType[] = ['IMAGE', 'VIDEO', 'DOCUMENT'];

export function templateMeta(t: any) {
  const comps: any[] = Array.isArray(t?.components) ? t.components : [];
  const find = (type: string) => comps.find((c) => String(c?.type ?? '').toUpperCase() === type);
  const body = find('BODY');
  const text = String(body?.text ?? '');
  const vars = new Set(text.match(/\{\{(\d+)\}\}/g) ?? []).size;
  const header = find('HEADER');
  const fmt = String(header?.format ?? '').toUpperCase();
  const headerType: HeaderType = !header ? 'NONE'
    : (['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(fmt) ? fmt as HeaderType : 'TEXT');
  const buttons = (Array.isArray(find('BUTTONS')?.buttons) ? find('BUTTONS').buttons : [])
    .map((b: any) => ({ type: String(b?.type ?? ''), text: String(b?.text ?? '') }));
  return { name: t?.name, language: t?.language, category: t?.category, body: text, vars, headerType, buttons };
}

export function isPublicHttpsUrl(v: unknown): v is string {
  try {
    const u = new URL(String(v ?? ''));
    return u.protocol === 'https:' && !!u.hostname && !['localhost', '127.0.0.1'].includes(u.hostname);
  } catch { return false; }
}

export type SlotPlan<T> = { at: string | null; leads: T[] };

/**
 * Divide os leads em lotes por hora no TOTAL do disparo (nunca mais que perHour por hora,
 * qualquer que seja a variação das variáveis).
 * - sem perHour e sem scheduledAt: um lote imediato (at = null);
 * - só scheduledAt: um lote agendado nesse horário;
 * - com perHour: lote k em início + k horas (início = scheduledAt ou agora + 2 min).
 */
export function planSlots<T>(leads: T[], opts: { perHour?: number | null; scheduledAt?: string | null; now: Date }): SlotPlan<T>[] {
  const per = opts.perHour && opts.perHour > 0 ? Math.floor(opts.perHour) : null;
  if (!per && !opts.scheduledAt) return [{ at: null, leads }];
  const start = opts.scheduledAt ? new Date(opts.scheduledAt) : new Date(opts.now.getTime() + 2 * 60_000);
  if (!per) return [{ at: start.toISOString(), leads }];
  const slots: SlotPlan<T>[] = [];
  for (let i = 0, k = 0; i < leads.length; i += per, k++) {
    slots.push({ at: new Date(start.getTime() + k * 3_600_000).toISOString(), leads: leads.slice(i, i + per) });
  }
  return slots;
}

/** Valida perHour/scheduledAt vindos do navegador. Retorna mensagem de erro ou null. */
export function validateSchedule(perHour: unknown, scheduledAt: unknown, now: Date): string | null {
  if (perHour != null && perHour !== '') {
    const n = Number(perHour);
    if (!Number.isInteger(n) || n < 1 || n > 10000) return 'Enviar por hora deve ser um número inteiro entre 1 e 10.000';
  }
  if (scheduledAt != null && scheduledAt !== '') {
    const d = new Date(String(scheduledAt));
    if (Number.isNaN(d.getTime())) return 'Data de agendamento inválida';
    if (d.getTime() < now.getTime() + 60_000) return 'O agendamento precisa ser pelo menos 1 minuto no futuro';
    if (d.getTime() > now.getTime() + 60 * 86_400_000) return 'O agendamento pode ser no máximo 60 dias à frente';
  }
  return null;
}
