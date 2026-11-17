// Resposta automática aos botões de resposta rápida das campanhas de WhatsApp oficial (Zernio).
// Regras puras (sem rede), espelhadas em src/lib/waButtonReplies.ts para a tela.

export type ButtonReply = {
  index: number;
  label: string;
  key: string;
  link: string;
  reply_text: string;
  form_id?: string | null;
};

/** Sem acento, minúsculo e com espaços únicos. */
export function normLabel(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Rótulos equivalentes (atuais e futuros) contam como o mesmo botão. */
const GROUPS: Record<string, string[]> = {
  ofertas: ['quero saber mais', 'quero ver as ofertas'],
  consultor: ['falar com consultor', 'falar com vendedor'],
};

export function buttonKey(label: unknown): string {
  const n = normLabel(label);
  for (const [k, list] of Object.entries(GROUPS)) if (list.includes(n)) return k;
  return n;
}

export const DEFAULT_REPLY: Record<string, string> = {
  ofertas: 'Que bom, {primeiro_nome}! Veja todas as ofertas da BLACK26 aqui: {link}',
  consultor: 'Perfeito, {primeiro_nome}! Fale agora com um consultor da Smart Dent pelo simulador: {link}',
};
export const GENERIC_REPLY = 'Obrigado, {primeiro_nome}! Aqui está o link: {link}';
export const MAX_REPLY_CHARS = 1000;

export function defaultReplyText(label: unknown): string {
  return DEFAULT_REPLY[buttonKey(label)] ?? GENERIC_REPLY;
}

const OPT_OUT = ['sair', 'parar', 'pare', 'stop', 'cancelar', 'descadastrar', 'remover', 'nao quero receber'];
export function isOptOutText(text: unknown): boolean {
  return OPT_OUT.includes(normLabel(text).replace(/[^a-z ]/g, '').trim());
}

/**
 * Monta as respostas dos botões de resposta rápida que têm link.
 * Texto vazio usa o padrão do botão; texto sem {link} recebe o link no fim.
 */
export function buildButtonReplies(
  buttons: { type: string; text: string }[],
  links: Record<string, unknown> | null | undefined,
  texts: Record<string, unknown> | null | undefined,
): { replies: ButtonReply[] } | { error: string } {
  const replies: ButtonReply[] = [];
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    if (String(b.type).toUpperCase() !== 'QUICK_REPLY') continue;
    const link = String(links?.[String(i)] ?? '').trim();
    if (!link) continue;
    let text = String(texts?.[String(i)] ?? '').trim() || defaultReplyText(b.text);
    if (!text.includes('{link}')) text = `${text} {link}`;
    if (text.length > MAX_REPLY_CHARS) return { error: `A resposta do botão "${b.text}" passa de ${MAX_REPLY_CHARS} caracteres` };
    if (isOptOutText(b.text)) return { error: `O botão "${b.text}" é de descadastro e não pode ter resposta automática` };
    replies.push({ index: i, label: b.text, key: buttonKey(b.text), link, reply_text: text });
  }
  return { replies };
}

/** Botão clicado → resposta: primeiro o rótulo exato, depois o rótulo equivalente. */
export function matchReply(replies: ButtonReply[] | null | undefined, pressed: unknown): ButtonReply | null {
  const list = Array.isArray(replies) ? replies : [];
  const n = normLabel(pressed);
  if (!n) return null;
  return list.find((r) => normLabel(r.label) === n) ?? list.find((r) => r.key === buttonKey(n)) ?? null;
}

/** Links curtos oficiais levam a origem WhatsApp, para contar no comparativo. */
export function withWhatsappOrigin(link: string): string {
  try {
    const u = new URL(link);
    if (u.hostname !== 's.smartdent.com.br') return link;
    u.searchParams.set('o', 'whatsapp');
    return u.toString();
  } catch { return link; }
}

export function firstNameOf(...names: unknown[]): string {
  for (const n of names) {
    const f = String(n ?? '').trim().split(/\s+/)[0] ?? '';
    if (f && !/\d/.test(f)) return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
  }
  return 'colega';
}

export function renderReply(text: string, v: { firstName: string; name?: string; link: string }): string {
  return String(text ?? '')
    .replace(/\{primeiro_nome\}/g, v.firstName || 'colega')
    .replace(/\{nome\}/g, v.name || v.firstName || '')
    .replace(/\{link\}/g, v.link)
    .replace(/ {2,}/g, ' ').trim();
}

/** Formulário do link (link curto, /lp/slug, /f/slug ou ?form=id), para contar o clique no comparativo. */
// deno-lint-ignore no-explicit-any
export async function resolveFormIdForLink(db: any, link: string): Promise<string | null> {
  let u: URL;
  try { u = new URL(link); } catch { return null; }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const qp = u.searchParams.get('form') ?? u.searchParams.get('form_id');
  if (qp && uuid.test(qp)) return qp;
  let slug: string | null = null;
  if (u.hostname === 's.smartdent.com.br') {
    const code = u.pathname.split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
    if (!/^[a-z0-9]{4,8}$/.test(code)) return null;
    const { data } = await db.from('smartops_short_links').select('form_slug').eq('short_code', code).maybeSingle();
    slug = data?.form_slug ?? null;
  } else {
    const m = /^\/(?:lp|f)\/([^/?#]+)/.exec(u.pathname);
    slug = m ? decodeURIComponent(m[1]) : null;
  }
  if (!slug) return null;
  const { data: f } = await db.from('smartops_forms').select('id').eq('slug', slug).maybeSingle();
  return f?.id ?? null;
}
