/** Public pages opened on the operational admin host move to the official www site, so search engines see one version. */
const PUBLIC_PREFIXES = [
  '/base-conhecimento', '/en/knowledge-base', '/es/base-conocimiento',
  '/produtos/', '/depoimentos/', '/categorias/', '/sobre', '/institucional',
  '/en/institutional', '/es/institucional', '/distribuidores', '/eventos',
];

export function publicRedirectTarget(hostname: string, pathname: string, search: string, hash: string): string | null {
  if (hostname.toLowerCase() !== 'admin.smartdent.com.br') return null;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p.endsWith('/') ? p : p + '/') || pathname === p);
  return isPublic ? `https://www.smartdent.com.br${pathname}${search}${hash}` : null;
}

export function redirectAdminPublicPages(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, pathname, search, hash } = window.location;
  const target = publicRedirectTarget(hostname, pathname, search, hash);
  if (target) window.location.replace(target);
  return !!target;
}
