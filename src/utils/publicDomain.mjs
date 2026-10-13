export const PUBLIC_ORIGIN = 'https://www.smartdent.com.br';
const SOURCE_HOSTS = new Set(['parametros.smartdent.com.br','www.parametros.smartdent.com.br']);
export function publicUrl(input) {
  if (typeof input !== 'string') return input;
  try {
    const url=new URL(input);
    if (!['https:','http:'].includes(url.protocol) || !SOURCE_HOSTS.has(url.hostname)) return input;
    if (/^\/(?:admin|smartops|social|painel-comercial|suporte-tecnico|entrar|reset-password)(?:\/|$)/.test(url.pathname)) return input;
    return PUBLIC_ORIGIN+url.pathname+url.search+url.hash;
  } catch { return input; }
}
export function publicText(text) {
  return text.replace(/https?:\/\/(?:www\.)?parametros\.smartdent\.com\.br[^\s"'<>)]*/g,publicUrl);
}
