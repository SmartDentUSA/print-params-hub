/** One page identity across legacy hosts, query strings and trailing slashes. */
export function isBioPageVisit(path: string | null, slug: string): boolean {
  if (!path) return false;
  try {
    const pathname = decodeURIComponent(new URL(path, "https://www.smartdent.com.br").pathname).replace(/\/+$/, "");
    return pathname === `/bio/${slug}`;
  } catch {
    return false;
  }
}