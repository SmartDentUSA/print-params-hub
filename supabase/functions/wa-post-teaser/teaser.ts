// Helpers puros do resumo isca de publicações para grupos de WhatsApp.

/** Remove hashtags, menções e linhas vazias repetidas da legenda. */
export function cleanCaption(caption: string): string {
  return String(caption ?? '')
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '$1')
    .replace(/(^|\s)@[\w.]+/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Resumo curto quando a IA não responde: primeiras frases, no máximo `max` caracteres. */
export function fallbackTeaser(caption: string, max = 220): string {
  const clean = cleanCaption(caption).replace(/\s+/g, ' ').trim();
  if (!clean) return 'Veja esta publicação da Smart Dent 👇';
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + '…');
}

/** Monta o texto final: resumo isca + chamada + link clicável. */
export function buildTeaserMessage(teaser: string, link: string): string {
  return [teaser.trim(), link ? `👉 ${link}` : ''].filter(Boolean).join('\n\n');
}

/** Escolhe a imagem de capa: sempre uma imagem (nunca .mp4), priorizando a miniatura. */
export function pickCoverUrl(post: {
  thumbnail_url?: string | null;
  media_url?: string | null;
  media_urls?: unknown;
}): string | null {
  const candidates: string[] = [];
  if (post.thumbnail_url) candidates.push(post.thumbnail_url);
  if (Array.isArray(post.media_urls)) {
    for (const m of post.media_urls as any[]) {
      const u = typeof m === 'string' ? m : (m?.url ?? m?.public_url);
      if (u) candidates.push(u);
    }
  }
  if (post.media_url) candidates.push(post.media_url);
  for (const raw of candidates) {
    if (!/^https?:\/\//i.test(raw)) continue;
    const ext = (raw.split('?')[0].split('.').pop() || '').toLowerCase();
    if (['mp4', 'mov', 'webm', 'm4v', 'm3u8'].includes(ext)) continue;
    return raw.replace(/\/default\.jpg/, '/hqdefault.jpg');
  }
  return null;
}
