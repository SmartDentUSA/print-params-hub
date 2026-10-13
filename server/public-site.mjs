export const PUBLIC_ORIGIN = 'https://www.smartdent.com.br';
export const DATA_ORIGIN = 'https://okeogjgqijbfkudfjadz.supabase.co';
export const TABS = ['institucional','parametros','catalogo','videos','artigos','ebooks','distribuidores','eventos','classificados','lives','cursos'];
export function publicLocation(input) {
  if (typeof input !== 'string' || input.length > 2048 || !input.startsWith('/') || input.startsWith('//') || /\/(?:\.{1,2}|%2e(?:%2e)?)(?:\/|\?|$)/i.test(input) || /[\\\u0000-\u001f]/.test(input)) return null;
  const url = new URL(input, PUBLIC_ORIGIN);
  if (url.origin !== PUBLIC_ORIGIN || /%2f|%5c|%2e/i.test(url.pathname)) return null;
  const allowed = /^(?:\/|\/institucional|\/en\/institutional|\/es\/institucional|\/sobre|\/support-resources|\/distribuidores(?:\/[\p{L}\p{N}_-]+){0,2}|\/eventos|\/produtos\/[\p{L}\p{N}_-]+|\/(?:base-conhecimento|en\/knowledge-base|es\/base-conocimiento)(?:\/[\p{L}\p{N}_-]+){0,2})\/?$/u;
  if (!allowed.test(url.pathname)) return null;
  const search = new URLSearchParams();
  for (const key of ['tab','cat','country','shell']) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    if (value.length > 80 || (key === 'tab' && !TABS.includes(value)) || (key === 'shell' && !['v1','v2'].includes(value))) return null;
    search.set(key, value);
  }
  const pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, '');
  return pathname + (search.size ? '?' + search.toString() : '');
}
export function isPublicDeliveryHost(host) {
  return /^(?:www\.smartdent\.com\.br|smartdent\.com\.br|[a-z0-9-]+\.vercel\.app)$/i.test(host || '');
}
export function publicUrl(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/^https?:\/\/(?:parametros|admin)\.smartdent\.com\.br(?=\/|$)/, PUBLIC_ORIGIN);
}
export function cleanSchema(value) {
  if (Array.isArray(value)) return value.map(cleanSchema).filter(v => v !== undefined);
  if (value && typeof value === 'object') {
    const out = Object.fromEntries(Object.entries(value).filter(([,v]) => v !== null && v !== undefined).map(([k,v]) => [k,cleanSchema(v)]));
    const types = Array.isArray(out['@type']) ? out['@type'] : [out['@type']];
    if (types.includes('Offer')) {
      const price = out.price ?? out.priceSpecification?.price;
      if (price === undefined || price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) return undefined;
      // These values were emitted unconditionally by the former proxy.
      delete out.availability; delete out.shippingDetails; delete out.hasMerchantReturnPolicy;
    }
    if (types.some(t => ['Article','TechArticle','ScholarlyArticle','MedicalWebPage'].includes(t))) delete out.offers;
    if (types.includes('Product') && out.offers && Number(out.offers.price ?? out.offers.priceSpecification?.price) === 0) delete out.offers;
    if (types.includes('Product') && out.brand?.name === 'Smart Dent') delete out.brand;
    if (types.includes('Product') && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(out.sku || ''))) delete out.sku;
    if (types.includes('Organization') && out.name === 'Nova Empresa') return undefined;
    if (String(out['@id'] || '').startsWith('null')) delete out['@id'];
    if (['Smart Dent','SmartDent'].includes(out.name)) {
      const sameAs = Array.isArray(out.sameAs) ? out.sameAs : out.sameAs ? [out.sameAs] : [];
      out.sameAs = [...new Set([...sameAs.filter(v => v !== 'https://www.wikidata.org/wiki/Q138636902'), 'https://www.wikidata.org/wiki/Q139535514'])];
    }
    return out;
  }
  return publicUrl(value);
}
export function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
export function cleanStructuredData(html) {
  return html.replace(/<script\b([^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi, (_, attrs, data) => {
    try {
      const schema = cleanSchema(JSON.parse(data));
      return schema ? '<script' + attrs + '>' + safeJson(schema) + '</script>' : '';
    } catch { return ''; }
  });
}
export function xmlEscape(value) { return String(value).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c])); }
export function publicText(value) {
  return value.replace(/https?:\/\/(?:parametros|admin)\.smartdent\.com\.br(?=[/\s)"<>]|$)/g, PUBLIC_ORIGIN);
}

export function publicCanonical(input) {
  const url = new URL(input, PUBLIC_ORIGIN);
  if (['/','/institucional'].includes(url.pathname) || (url.pathname === '/base-conhecimento' && url.searchParams.get('tab') === 'institucional')) return PUBLIC_ORIGIN + '/';
  const tab=url.searchParams.get('tab');
  url.search='';
  if (/^\/(?:base-conhecimento|en\/knowledge-base|es\/base-conocimiento)\/?$/.test(url.pathname) && tab && TABS.includes(tab)) url.searchParams.set('tab',tab);
  return url.toString();
}
