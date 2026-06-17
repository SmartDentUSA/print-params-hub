/**
 * Returns the canonical public origin for share links.
 * In preview/dev (lovableproject.com / localhost) we force the production domain
 * so shared URLs are always public and stable.
 */
export function getPublicOrigin(): string {
  const PROD = 'https://admin.smartdent.com.br';
  if (typeof window === 'undefined') return PROD;
  const host = window.location.hostname;
  if (
    host.endsWith('lovableproject.com') ||
    host.endsWith('lovable.app') ||
    host === 'localhost' ||
    host === '127.0.0.1'
  ) {
    return PROD;
  }
  return window.location.origin;
}