/** Operational domains keep their existing root; __public only previews the public host. */
export function isInstitutionalHost(hostname: string): boolean {
  return hostname.toLowerCase() === 'www.smartdent.com.br'
    || (hostname.endsWith('.vercel.app') && typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('__public') === '1');
}
