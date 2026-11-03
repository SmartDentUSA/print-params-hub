/** Main Bio page gets the short public path /linkbio; other pages keep /bio/{slug}. */
export const MAIN_BIO_SLUG = "smart-dent-fluxo-digital";
export const MAIN_BIO_PATH = "/linkbio";

export function bioPublicPath(slug: string): string {
  return slug === MAIN_BIO_SLUG ? MAIN_BIO_PATH : `/bio/${slug}`;
}

/** Canonical share URL always on the official www site. */
export function bioPublicUrl(slug: string): string {
  return `https://www.smartdent.com.br${bioPublicPath(slug)}`;
}

/** One page identity across legacy hosts, query strings and trailing slashes. */
export function isBioPageVisit(path: string | null, slug: string): boolean {
  if (!path) return false;
  try {
    const pathname = decodeURIComponent(new URL(path, "https://www.smartdent.com.br").pathname).replace(/\/+$/, "");
    if (pathname === `/bio/${slug}`) return true;
    // Short path counts for the main page too (legacy /bio/... links still circulate).
    return slug === MAIN_BIO_SLUG && pathname === MAIN_BIO_PATH;
  } catch {
    return false;
  }
}