// Identifica publicações geradas pelo pipeline de depoimentos de treinamento
// (training-testimonial-social-publish) para que o envio automático aos grupos
// de WhatsApp as ignore. O post sincronizado do Zernio (social_posts) não guarda
// o ID do agendamento, então a ligação é feita pela legenda: cada depoimento tem
// legenda própria gerada por IA, e comparamos o início normalizado dela.
// Funções puras, sem imports de runtime.

/** Quantos caracteres normalizados formam a chave da legenda. */
export const TESTIMONIAL_KEY_LEN = 80;
/** Abaixo disso a legenda é curta demais para identificar com segurança. */
export const TESTIMONIAL_MIN_KEY = 30;

/** Minúsculas, sem acentos, só letras e números (emojis, espaços e ** saem). */
export function captionKey(caption: unknown): string {
  return String(caption ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, TESTIMONIAL_KEY_LEN);
}

/** Chaves das legendas de um agendamento: legenda padrão + legenda/título por canal. */
export function testimonialKeys(rows: Array<{ caption?: unknown; channels?: unknown }>): Set<string> {
  const keys = new Set<string>();
  const add = (v: unknown) => {
    const k = captionKey(v);
    if (k.length >= TESTIMONIAL_MIN_KEY) keys.add(k);
  };
  for (const r of rows ?? []) {
    add(r?.caption);
    if (Array.isArray(r?.channels)) {
      for (const c of r.channels as any[]) {
        add(c?.caption);
        add(c?.title);
        add(c?.platformSpecificData?.title);
      }
    }
  }
  return keys;
}

/** A legenda do post começa com a legenda de algum depoimento (ou vice-versa)? */
export function isTestimonialCaption(caption: unknown, keys: Set<string>): boolean {
  const k = captionKey(caption);
  if (k.length < TESTIMONIAL_MIN_KEY || keys.size === 0) return false;
  if (keys.has(k)) return true;
  for (const t of keys) {
    if (k.startsWith(t) || t.startsWith(k)) return true;
  }
  return false;
}

/**
 * Separa os posts sincronizados que não devem ir para os grupos:
 * depoimentos do pipeline e posts agendados com "Enviar para os grupos" desligado.
 */
export function splitGroupBlastExclusions(
  posts: Array<{ id: string; caption?: unknown }>,
  testimonialRows: Array<{ caption?: unknown; channels?: unknown }>,
  optOutRows: Array<{ caption?: unknown; channels?: unknown }>,
): { testimonialIds: string[]; optOutIds: string[] } {
  const tKeys = testimonialKeys(testimonialRows);
  const oKeys = testimonialKeys(optOutRows);
  const testimonialIds: string[] = [];
  const optOutIds: string[] = [];
  for (const p of posts ?? []) {
    if (isTestimonialCaption(p.caption, tKeys)) testimonialIds.push(p.id);
    else if (isTestimonialCaption(p.caption, oKeys)) optOutIds.push(p.id);
  }
  return { testimonialIds, optOutIds };
}

/**
 * Link escolhido no agendamento ("Link para os grupos") para o post sincronizado.
 * A ligação também é pela legenda; o agendamento mais recente vence.
 */
export function findGroupLink(
  caption: unknown,
  scheduledRows: Array<{ caption?: unknown; channels?: unknown; group_link_url?: unknown; created_at?: unknown }>,
): string | null {
  const sorted = [...(scheduledRows ?? [])].sort((a, b) =>
    String(b?.created_at ?? '').localeCompare(String(a?.created_at ?? '')));
  for (const r of sorted) {
    const link = String(r?.group_link_url ?? '').trim();
    if (!/^https?:\/\/\S+$/i.test(link)) continue;
    if (isTestimonialCaption(caption, testimonialKeys([r]))) return link;
  }
  return null;
}

/**
 * Texto que vai abaixo da imagem nos grupos: resumo, link escolhido em destaque
 * e, quando houver, o link da publicação (para quem quer comentar no post).
 */
export function buildGroupBlastText(summary: string, postLink: string | null | undefined, groupLink?: string | null): string {
  const s = String(summary ?? '').trim();
  const post = String(postLink ?? '').trim();
  const group = String(groupLink ?? '').trim();
  if (!group) return [s, post].filter(Boolean).join('\n\n');
  const parts = [s, `👉 ${group}`];
  if (post && post !== group) parts.push(`📲 Ver a publicação: ${post}`);
  return parts.filter(Boolean).join('\n\n');
}
