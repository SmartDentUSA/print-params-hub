// Regras puras do disparo WhatsApp Oficial: leitura do template, botões, mídia do cabeçalho,
// janela de envio e plano de lotes por hora. Sem rede nem banco, para poder testar.

export type HeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
export const MEDIA_HEADERS: HeaderType[] = ['IMAGE', 'VIDEO', 'DOCUMENT'];
export type TemplateButton = { type: string; text: string; url?: string; urlHasVariable?: boolean };

/** Lead fixo para o "Enviar teste" (Danilo Henrique). */
export const TEST_LEAD_ID = '366ea619-33c3-4fb1-b6ac-cf7c733aaac7';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
  const buttons: TemplateButton[] = (Array.isArray(find('BUTTONS')?.buttons) ? find('BUTTONS').buttons : [])
    .map((b: any) => {
      const type = String(b?.type ?? '').toUpperCase();
      const out: TemplateButton = { type, text: String(b?.text ?? '') };
      if (type === 'URL') { out.url = String(b?.url ?? ''); out.urlHasVariable = /\{\{\d+\}\}/.test(out.url); }
      return out;
    });
  const footer = String(find('FOOTER')?.text ?? '');
  return { name: t?.name, language: t?.language, category: t?.category, body: text, vars, headerType, buttons, footer };
}

export function isPublicHttpsUrl(v: unknown): v is string {
  try {
    const u = new URL(String(v ?? ''));
    return u.protocol === 'https:' && !!u.hostname && !['localhost', '127.0.0.1'].includes(u.hostname);
  } catch { return false; }
}

/** Confere a resposta do link da imagem do cabeçalho: JPG/PNG de até 5 MB. */
export function checkHeaderImage(status: number, contentType: string | null, contentLength: number | null): string | null {
  if (status < 200 || status >= 300) return `O link da imagem respondeu ${status}; use um link público que abra a imagem`;
  const ct = String(contentType ?? '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/jpg', 'image/png'].includes(ct)) return `A imagem precisa ser JPG ou PNG (o link devolveu "${ct || 'sem tipo'}")`;
  if (contentLength == null || !Number.isFinite(contentLength)) return 'Não foi possível conferir o tamanho da imagem; envie o arquivo pela tela';
  if (contentLength > MAX_IMAGE_BYTES) return 'A imagem precisa ter no máximo 5 MB';
  return null;
}

/**
 * Botões do template:
 * - URL com variável no fim: o link informado precisa começar pela parte fixa; vai só o sufixo como parâmetro.
 * - URL fixa: link informado é ignorado (aviso).
 * - Resposta rápida: não leva link; o valor é só guardado para a resposta automática futura.
 */
export function resolveButtons(buttons: TemplateButton[], links: Record<string, unknown> | null | undefined) {
  const stored: Record<string, string> = {};
  const components: any[] = [];
  const warnings: string[] = [];
  const params: { index: number; suffix: string }[] = [];
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    const link = String(links?.[String(i)] ?? '').trim();
    if (b.type === 'URL') {
      if (!b.urlHasVariable) { if (link) warnings.push(`Botão "${b.text}" tem link fixo aprovado; o link informado foi ignorado`); continue; }
      if (!link) return { error: `Informe o link do botão "${b.text}"` };
      if (!isPublicHttpsUrl(link)) return { error: `O link do botão "${b.text}" precisa ser https` };
      const prefix = String(b.url ?? '').split(/\{\{\d+\}\}/)[0];
      if (!link.startsWith(prefix) || link.length <= prefix.length)
        return { error: `O link do botão "${b.text}" precisa começar com ${prefix}` };
      const suffix = link.slice(prefix.length);
      stored[String(i)] = link;
      params.push({ index: i, suffix });
      components.push({ type: 'button', sub_type: 'url', index: String(i), parameters: [{ type: 'text', text: suffix }] });
    } else if (link) {
      if (!isPublicHttpsUrl(link)) return { error: `O link do botão "${b.text}" precisa ser https` };
      stored[String(i)] = link;
    }
  }
  return { stored, components, warnings, params };
}

const toMin = (t: string | null | undefined, dflt: number) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : dflt;
};
const SP_OFFSET_MS = 3 * 3_600_000; // São Paulo, UTC-3 sem horário de verão

/** Empurra o horário para o início da próxima janela (horário de São Paulo) quando cai fora dela. */
export function pushIntoWindow(d: Date, windowStart?: string | null, windowEnd?: string | null): Date {
  const start = toMin(windowStart, 7 * 60 + 30), end = toMin(windowEnd, 19 * 60);
  if (end <= start) return d;
  const local = new Date(d.getTime() - SP_OFFSET_MS);
  const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
  if (mins >= start && mins < end) return d;
  const dayStartUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + SP_OFFSET_MS;
  return new Date(dayStartUtc + (mins >= end ? 86_400_000 : 0) + start * 60_000);
}

export type SlotPlan<T> = { at: string | null; leads: T[] };

/**
 * Divide os leads em lotes no TOTAL do disparo (nunca mais que perHour por hora nem mais que perDay
 * a cada 24 h, qualquer que seja a variação das variáveis).
 * - sem perHour, sem scheduledAt e público dentro do limite diário: um lote imediato (at = null);
 * - só scheduledAt: um lote agendado nesse horário;
 * - com perHour: lote k uma hora depois do anterior (início = scheduledAt ou agora + 2 min);
 * - com perDay: ao atingir o limite, o próximo lote só sai 24 h depois do início daquele período
 *   (o limite da Meta conta contatos únicos em 24 h corridas, não por dia do calendário).
 * Lotes agendados respeitam a janela de envio: fora dela, vão para o início da próxima.
 */
export function planSlots<T>(leads: T[], opts: { perHour?: number | null; perDay?: number | null; scheduledAt?: string | null; now: Date; windowStart?: string | null; windowEnd?: string | null }): SlotPlan<T>[] {
  const per = opts.perHour && opts.perHour > 0 ? Math.floor(opts.perHour) : null;
  const day = opts.perDay && opts.perDay > 0 ? Math.floor(opts.perDay) : null;
  const splitByDay = !!day && leads.length > day;
  if (!per && !opts.scheduledAt && !splitByDay) return [{ at: null, leads }];
  const win = (d: Date) => pushIntoWindow(d, opts.windowStart, opts.windowEnd);
  const start = win(opts.scheduledAt ? new Date(opts.scheduledAt) : new Date(opts.now.getTime() + 2 * 60_000));
  if (!per && !splitByDay) return [{ at: start.toISOString(), leads }];
  const slots: SlotPlan<T>[] = [];
  let at = start, periodStart = start, used = 0;
  for (let i = 0; i < leads.length;) {
    if (day && used >= day) {
      at = win(new Date(Math.max(at.getTime(), periodStart.getTime() + 86_400_000)));
      periodStart = at; used = 0;
    } else if (day && at.getTime() >= periodStart.getTime() + 86_400_000) {
      periodStart = at; used = 0;
    }
    const size = Math.min(per ?? Infinity, day ? day - used : Infinity, leads.length - i);
    slots.push({ at: at.toISOString(), leads: leads.slice(i, i + size) });
    i += size; used += size;
    if (i < leads.length && per) at = win(new Date(at.getTime() + 3_600_000));
  }
  return slots;
}

/** Campos do sistema que podem entrar no meio de um texto livre: "{primeiro_nome}". */
export const TOKEN_DEFAULTS: Record<string, string> = { primeiro_nome: 'colega' };

/** Troca {campo} pelo valor do lead (campo vazio → padrão do campo ou nada) e limpa espaços duplos. */
export function fillTokens(text: string, valueOf: (key: string) => string | null): string {
  const out = String(text ?? '').replace(/\{([a-z_]+)\}/g, (m, key: string) => {
    const v = valueOf(key);
    if (v == null) return m; // não é campo do sistema: fica como foi digitado
    return v || TOKEN_DEFAULTS[key] || '';
  });
  return out.replace(/ {2,}/g, ' ').replace(/ +([,.!?;:])/g, '$1').trim();
}

/** Valida o limite diário e o custo por mensagem vindos do navegador. */
export function validateDailyAndCost(perDay: unknown, cost: unknown): string | null {
  if (perDay != null && perDay !== '') {
    const n = Number(perDay);
    if (!Number.isInteger(n) || n < 1 || n > 100000) return 'Máximo por dia deve ser um número inteiro entre 1 e 100.000';
  }
  if (cost != null && cost !== '') {
    const c = Number(cost);
    if (!Number.isFinite(c) || c < 0 || c > 100) return 'Custo por mensagem inválido';
  }
  return null;
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

/** Confere se a Zernio guardou a imagem da campanha no broadcast (senão mandaria a amostra aprovada). */
export function broadcastKeepsHeaderMedia(broadcast: any, link: string): boolean {
  const t = broadcast?.template ?? broadcast?.broadcast?.template ?? {};
  if (t?.headerMedia?.link === link) return true;
  const comps: any[] = Array.isArray(t?.components) ? t.components : [];
  return comps.some((c) => String(c?.type ?? '').toLowerCase() === 'header'
    && (c.parameters ?? []).some((p: any) => p?.image?.link === link || p?.video?.link === link || p?.document?.link === link));
}

/** Máximo de números digitados num envio de teste (o teste nunca vira campanha). */
export const MAX_TEST_PHONES = 5;

/** Mesmo celular com e sem o 9º dígito (55 + DDD + número), para achar o lead pelo telefone. */
export function phoneVariants(e164Digits: string): string[] {
  const d = String(e164Digits ?? '').replace(/\D/g, '');
  if (!d.startsWith('55')) return d ? [d] : [];
  const ddd = d.slice(2, 4), rest = d.slice(4);
  if (rest.length === 9 && rest.startsWith('9')) return [d, `55${ddd}${rest.slice(1)}`];
  if (rest.length === 8 && /^[6-9]/.test(rest)) return [d, `55${ddd}9${rest}`];
  return [d];
}

/** Campos de nome que a Zernio preenche por destinatário (variableMapping field "name"). */
export const CONTACT_NAME_FIELDS = ['primeiro_nome', 'nome'];

/** Posição da variável preenchida pelo nome do contato na Zernio (a primeira de nome), ou -1. */
export function pickNameVarIndex(vmap: { source?: string; value?: string }[]): number {
  return vmap.findIndex((v) => v?.source === 'field' && CONTACT_NAME_FIELDS.includes(String(v.value)));
}

/** Nome gravado no contato da Zernio: valor do lead ou o padrão de primeiro nome. */
export function contactNameFor(value: string): string {
  const v = String(value ?? '').trim();
  return !v || v === '-' ? TOKEN_DEFAULTS.primeiro_nome : v.slice(0, 120);
}

/** Valores que separam envios: a posição do nome fica fixa porque a Zernio resolve por destinatário. */
export function groupKeyValues(values: string[], nameIdx: number): string[] {
  return values.map((v, i) => (i === nameIdx ? '' : v));
}

/** Contatos da Zernio cujo nome difere do nome que a mensagem precisa mostrar. */
export function namesToPatch(
  recipients: { contactId?: string | null; platformIdentifier?: string | null; contactName?: string | null }[],
  wanted: Map<string, string>,
): { contactId: string; name: string }[] {
  const out: { contactId: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const r of recipients) {
    const phone = String(r.platformIdentifier ?? '').replace(/\D/g, '');
    const name = wanted.get(phone);
    if (!r.contactId || !name || seen.has(r.contactId)) continue;
    seen.add(r.contactId);
    if (String(r.contactName ?? '').trim() !== name) out.push({ contactId: r.contactId, name });
  }
  return out;
}
