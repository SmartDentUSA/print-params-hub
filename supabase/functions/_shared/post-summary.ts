// Resumo de publicações para grupos de WhatsApp + escolha da imagem e limite da
// legenda de mídia. Compartilhado por social-post-auto-blast (envio automático),
// wa-post-teaser (resumo no editor de campanha) e wa-dispatcher (envio dos nós
// post_ig/post_yt/link_ig/link_yt). Sem imports de runtime: funções puras + fetch.

/** Prompt calibrado para o tom dos grupos (origem: social-post-auto-blast). */
export const POST_SUMMARY_SYSTEM =
  'Você resume posts da Smart Dent para grupos de WhatsApp de dentistas e laboratórios. Responda em português, 2 a 3 linhas, tom direto e convidativo, sem preços, sem hashtags, sem emojis em excesso (no máximo 2). Termine convidando a ver o post.';

/** Quando o post tem link escolhido para os grupos, a chamada final aponta para ele. */
export const POST_SUMMARY_LINK_CTA =
  'Abaixo do texto haverá um link de atendimento no WhatsApp. Termine convidando a tocar no link abaixo (não diga "confira o post"). Não peça para comentar, não fale em "link da bio" nem "aqui embaixo", e não escreva links.';

/**
 * Limpa o resumo para o WhatsApp: **negrito** vira *negrito*, sem links,
 * hashtags, menções nem linhas vazias repetidas.
 */
export function cleanSummaryText(text: string): string {
  return String(text ?? '')
    .replace(/\*\*([^*\n]+)\*\*/g, '*$1*')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '$1')
    .replace(/(^|\s)@[\w.]+/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const POST_SUMMARY_MODEL = 'google/gemini-3-flash-preview';

/** Legenda de mídia no WhatsApp é limitada (~1.024 caracteres). */
export const WA_MEDIA_CAPTION_MAX = 1024;

/** Fallback quando a IA não responde: legenda truncada em 320 caracteres. */
export function summaryFallback(caption: string): string {
  const clean = String(caption ?? '').trim();
  return clean.length > 320 ? clean.slice(0, 317).trimEnd() + '…' : clean;
}

/** Gera o resumo por IA. Nunca lança: em falha devolve o fallback com ai=false. */
export async function generatePostSummary(
  caption: string,
  platform: string,
  apiKey: string | undefined | null,
  logTag = '[post-summary]',
  opts: { linkCta?: boolean } = {},
): Promise<{ text: string; ai: boolean }> {
  const clean = String(caption ?? '').trim();
  const fallback = cleanSummaryText(summaryFallback(clean));
  const system = opts.linkCta ? `${POST_SUMMARY_SYSTEM} ${POST_SUMMARY_LINK_CTA}` : POST_SUMMARY_SYSTEM;
  if (!apiKey || !clean) return { text: fallback, ai: false };
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: POST_SUMMARY_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Rede: ${platform}\n\nPost:\n${clean.slice(0, 1500)}` },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(logTag, 'summary fail', res.status, await res.text());
      return { text: fallback, ai: false };
    }
    const j = await res.json();
    const txt = cleanSummaryText(String(j?.choices?.[0]?.message?.content ?? ''));
    return txt ? { text: txt, ai: true } : { text: fallback, ai: false };
  } catch (e) {
    console.warn(logTag, 'summary error', e);
    return { text: fallback, ai: false };
  }
}

/**
 * Escolhe a primeira mídia utilizável (http/https), nesta ordem:
 * media_urls[] (string ou {url|public_url}) → media_url → thumbnail_url.
 * O tipo é decidido pela EXTENSÃO da URL: miniatura .jpg vai como imagem mesmo
 * que o post esteja marcado como vídeo.
 */
export function pickPostMedia(v: any): { url: string; kind: 'image' | 'video' } | null {
  const candidates: any[] = [];
  if (Array.isArray(v?.media_urls)) candidates.push(...v.media_urls);
  if (v?.media_url) candidates.push({ url: v.media_url, type: v.media_type });
  // Miniatura por último: é sempre imagem, então não herda media_type.
  if (v?.thumbnail_url) candidates.push({ url: v.thumbnail_url, type: 'image' });
  for (const c of candidates) {
    let url = typeof c === 'string' ? c : (c?.url ?? c?.public_url ?? null);
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) continue;
    // Miniaturas do YouTube vêm em 120px — sobe para hqdefault.
    url = url.replace(/\/default\.jpg/, '/hqdefault.jpg');
    const t = String((typeof c === 'object' && c?.type) || v?.media_type || '').toLowerCase();
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
    const imageExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
    const videoExt = ['mp4', 'mov', 'webm', 'm4v'].includes(ext);
    const isVideo = videoExt || (!imageExt && t.includes('video'));
    return { url, kind: isVideo ? 'video' : 'image' };
  }
  return null;
}

/**
 * Texto do envio: resumo (ou legenda, nos nós antigos) + link no fim.
 * Com `max`, corta só o texto com reticências e mantém o link inteiro.
 */
export function composePostText(body: string, link: string, max?: number): string {
  const text = String(body ?? '').trim();
  const url = String(link ?? '').trim();
  const suffix = url ? (text ? `\n\n${url}` : url) : '';
  if (!max || text.length + suffix.length <= max) return text + suffix;
  const room = Math.max(0, max - suffix.length - 1);
  return text.slice(0, room).trimEnd() + '…' + suffix;
}

/** Resumo salvo no nó quando existir; senão a legenda original. */
export function postBodyText(c: { resumo?: unknown; caption?: unknown }): string {
  const r = typeof c?.resumo === 'string' ? c.resumo.trim() : '';
  return r || String(c?.caption ?? '');
}
