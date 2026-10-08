/** Only the requested public host changes its landing page. */
export function isInstitutionalHost(hostname: string): boolean {
  return hostname.toLowerCase() === 'www.smartdent.com.br';
}
