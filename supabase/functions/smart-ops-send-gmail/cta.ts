// Destino único do botão nas campanhas de marketing: URL encurtada oficial
// (s.smartdent.com.br) do formulário do produto, de uma landing page publicada
// ou de um simulador de WhatsApp. O link sempre sai marcado com a origem e-mail (?o=email).
const OFFICIAL_SHORT_RE = /^https:\/\/s\.smartdent\.com\.br\/([A-Za-z0-9_-]+)(\?o=[a-z]+)?$/i;
const ALLOWED_TIPOS = new Set(["form", "whatsapp", "landing"]);

export function officialCtaUrl(ctaConfig: any): string | null {
  const principal = ctaConfig?.cta_principal;
  if (!principal || !ALLOWED_TIPOS.has(principal.tipo)) return null;
  const m = String(principal.url || "").match(OFFICIAL_SHORT_RE);
  return m ? `https://s.smartdent.com.br/${m[1]}?o=email` : null;
}

export function forceCtaDestination(html: string, ctaConfig: any): string {
  const url = officialCtaUrl(ctaConfig);
  if (!url) {
    throw new Error("CTA do e-mail deve usar a URL encurtada oficial do formulário, da landing page ou do simulador de WhatsApp");
  }
  return html.replace(/href\s*=\s*(["'])https?:\/\/[^"']+\1/gi, (_match, quote) => `href=${quote}${url}${quote}`);
}
