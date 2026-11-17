/**
 * Origem do clique em links da landing/formulário (e-mail, SMS, WhatsApp, grupos, Bio).
 * O link curto recebe `?o=<origem>`; o redirecionamento repassa a origem à página
 * (utm_source na landing, utm_term no simulador) e cada evento de atendimento a registra.
 */
export const CLICK_ORIGINS = ["email", "sms", "whatsapp", "grupos", "bio"] as const;
export type ClickOrigin = (typeof CLICK_ORIGINS)[number];

/** Origens deduzidas sem `?o=` (utm ou site de onde a pessoa veio). */
export const INFERRED_ORIGINS = ["instagram", "facebook", "google", "site", "outros_sites"] as const;
export type InferredOrigin = (typeof INFERRED_ORIGINS)[number];
export type AnyClickOrigin = ClickOrigin | InferredOrigin;

export const CLICK_ORIGIN_LABEL: Record<AnyClickOrigin | "direto" | "pre_tracking", string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  site: "Site Smart Dent",
  outros_sites: "Outros sites",
  pre_tracking: "Antes da marcação",
  email: "E-mail",
  sms: "SMS",
  whatsapp: "WhatsApp",
  grupos: "Grupos de WhatsApp",
  bio: "Link da Bio",
  direto: "Acesso direto (sem marcação)",
};

export function normalizeClickOrigin(v: unknown): ClickOrigin | null {
  const s = String(v ?? "").trim().toLowerCase();
  return (CLICK_ORIGINS as readonly string[]).includes(s) ? (s as ClickOrigin) : null;
}

/** Lê a origem da URL: `o`, depois `utm_term` (simulador), depois `utm_source` (landing). */
export function clickOriginFromSearch(search: string): ClickOrigin | null {
  const q = new URLSearchParams(search);
  return normalizeClickOrigin(q.get("o")) ?? normalizeClickOrigin(q.get("utm_term")) ?? normalizeClickOrigin(q.get("utm_source"));
}

const SHORT_HOST = "s.smartdent.com.br";

/** Marca a origem só nos links curtos oficiais; outros links ficam como estão. */
export function withClickOrigin(url: string, origin: ClickOrigin): string {
  try {
    const u = new URL(url);
    if (u.hostname !== SHORT_HOST) return url;
    u.searchParams.set("o", origin);
    return u.toString();
  } catch {
    return url;
  }
}

/** Canal do seletor de links das campanhas → origem do clique. */
export function originForCampaignChannel(channel: "sms" | "whatsapp" | "whatsapp_groups"): ClickOrigin {
  return channel === "whatsapp_groups" ? "grupos" : channel;
}

const ALL: readonly string[] = [...CLICK_ORIGINS, ...INFERRED_ORIGINS];
const STORE_KEY = "sd_click_origin";

function normalizeAny(v: unknown): AnyClickOrigin | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (ALL.includes(s)) return s as AnyClickOrigin;
  if (/^(ig|insta)/.test(s)) return "instagram";
  if (/^(fb|face|meta)/.test(s)) return "facebook";
  if (/google|gads|adwords/.test(s)) return "google";
  if (/^(e-?mail|newsletter)/.test(s)) return "email";
  if (/^wa$|whats/.test(s)) return "whatsapp";
  return null;
}

/** Deduz a origem pelo site de onde a pessoa veio. */
export function originFromReferrer(referrer: string, ownHost = ""): AnyClickOrigin | null {
  if (!referrer) return null;
  let h = "";
  try { h = new URL(referrer).hostname.toLowerCase(); } catch { return null; }
  if (!h || (ownHost && h === ownHost.toLowerCase())) return null;
  if (h.includes("instagram")) return "instagram";
  if (h.includes("facebook") || h === "fb.com" || h.endsWith(".fb.com") || h === "m.me") return "facebook";
  if (h.includes("whatsapp") || h === "wa.me") return "whatsapp";
  if (/(^|\.)google\./.test(h)) return "google";
  if (/mail\.|outlook|gmail/.test(h)) return "email";
  if (h.endsWith("smartdent.com.br") || h.endsWith("lovable.app")) return "site";
  return "outros_sites";
}

/**
 * Cascata: `?o=` > utm_term > utm_source > origem já guardada na sessão > site de onde veio.
 * A origem encontrada fica guardada na sessão, assim o simulador aberto pela landing mantém a origem.
 */
export function resolveClickOrigin(
  search: string,
  referrer: string,
  ownHost: string,
  store?: Pick<Storage, "getItem" | "setItem"> | null,
): AnyClickOrigin | null {
  const q = new URLSearchParams(search);
  const fromUrl = normalizeClickOrigin(q.get("o")) ?? normalizeClickOrigin(q.get("utm_term"))
    ?? normalizeAny(q.get("utm_source")) ?? normalizeAny(q.get("utm_term"));
  let stored: AnyClickOrigin | null = null;
  try { stored = normalizeAny(store?.getItem(STORE_KEY)); } catch { stored = null; }
  const found = fromUrl ?? stored ?? originFromReferrer(referrer, ownHost);
  if (found && found !== stored) { try { store?.setItem(STORE_KEY, found); } catch { /* sem sessão */ } }
  return found;
}

/** Origem da página atual no navegador. */
export function currentClickOrigin(): AnyClickOrigin | null {
  try {
    let ref = document.referrer;
    // Dentro da landing (iframe), o "referrer" é a própria página: vale a sessão.
    return resolveClickOrigin(window.location.search, ref, window.location.hostname, window.sessionStorage);
  } catch { return null; }
}
