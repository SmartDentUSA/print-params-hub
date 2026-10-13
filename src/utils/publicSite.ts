import { isInstitutionalHost } from './institutionalHost';
export const PUBLIC_SITE_ORIGIN = 'https://www.smartdent.com.br';
/** Public pages share one origin; operational domains retain their current routes. */
export function getPublicSiteOrigin(): string {
  return typeof window !== 'undefined' && isInstitutionalHost(window.location.hostname)
    ? PUBLIC_SITE_ORIGIN : 'https://parametros.smartdent.com.br';
}
