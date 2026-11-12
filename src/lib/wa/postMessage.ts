// Espelho de apresentação de supabase/functions/_shared/post-summary.ts:
// monta na prévia do editor exatamente o texto que o wa-dispatcher envia.

export const WA_MEDIA_CAPTION_MAX = 1024;

export function composePostText(body: string, link: string, max?: number): string {
  const text = String(body ?? "").trim();
  const url = String(link ?? "").trim();
  const suffix = url ? (text ? `\n\n${url}` : url) : "";
  if (!max || text.length + suffix.length <= max) return text + suffix;
  const room = Math.max(0, max - suffix.length - 1);
  return text.slice(0, room).trimEnd() + "…" + suffix;
}

export function postBodyText(n: { resumo?: string; caption?: string }): string {
  const r = (n.resumo ?? "").trim();
  return r || String(n.caption ?? "");
}

/** Mesma ordem do envio para os nós do editor: media_url → thumbnail_url (só http/https). */
export function postPreviewImage(n: { media_url?: string; thumbnail_url?: string }): string | null {
  for (const u of [n.media_url, n.thumbnail_url]) {
    if (u && /^https?:\/\//i.test(u)) return u.replace(/\/default\.jpg/, "/hqdefault.jpg");
  }
  return null;
}
