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
