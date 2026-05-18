/**
 * Cleans cta_1_url / system_a_product_url values stored with trailing dashes,
 * stray HTML tags, or whitespace. Returns null if the result is not a usable URL.
 *
 * Used by lia-rag.ts (and any other surface that forwards shop URLs to LIA)
 * to prevent broken links like `https://loja.smartdent.com.br/resina-foo-`.
 */
export function sanitizeShopUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.replace(/<[^>]*>/g, "").replace(/\s+/g, "").trim();
  while (s.length > 0 && /[\-.,;:/!?)]$/.test(s) && !s.endsWith("://")) {
    s = s.slice(0, -1);
  }
  if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(s)) return null;
  return s;
}