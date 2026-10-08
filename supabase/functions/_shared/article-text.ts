/** Plain editorial text for server-generated Article JSON-LD. */
export function articleText(html: string | null | undefined): string {
  return (html || '')
    .replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39|apos);/gi, entity => ({
      '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
      '&quot;': '"', '&#39;': "'", '&apos;': "'",
    }[entity.toLowerCase()] || entity))
    .replace(/\s+/g, ' ')
    .trim();
}
