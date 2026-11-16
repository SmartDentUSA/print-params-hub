// Destino único do botão nas campanhas de marketing: URL encurtada oficial
// (s.smartdent.com.br) do formulário do produto ou de um simulador de WhatsApp.
const OFFICIAL_SHORT_RE = /^https:\/\/s\.smartdent\.com\.br\/[A-Za-z0-9_-]+$/i;
const ALLOWED_TIPOS = new Set(["form", "whatsapp"]);

export function officialCtaUrl(ctaConfig: any): string | null {
  const principal = ctaConfig?.cta_principal;
  if (!principal || !ALLOWED_TIPOS.has(principal.tipo)) return null;
  const url = String(principal.url || "");
  return OFFICIAL_SHORT_RE.test(url) ? url : null;
}

export function forceCtaDestination(html: string, ctaConfig: any): string {
  const url = officialCtaUrl(ctaConfig);
  if (!url) {
    throw new Error("CTA do e-mail deve usar a URL encurtada oficial do formulário ou do simulador de WhatsApp");
  }
  return html.replace(/href\s*=\s*(["'])https?:\/\/[^"']+\1/gi, (_match, quote) => `href=${quote}${url}${quote}`);
}
