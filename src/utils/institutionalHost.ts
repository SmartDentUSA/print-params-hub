declare global { interface Window { __SMARTDENT_PUBLIC_PAGE__?: boolean } }
/** Public delivery does not change the root route of operational custom domains. */
export function isInstitutionalHost(hostname: string): boolean {
  const host=hostname.toLowerCase();
  return ['www.smartdent.com.br','smartdent.com.br'].includes(host)
    || (typeof window !== 'undefined' && window.__SMARTDENT_PUBLIC_PAGE__ === true
      && /^[a-z0-9-]+\.vercel\.app$/.test(host));
}
