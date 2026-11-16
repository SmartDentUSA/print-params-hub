/**
 * Origem do clique em links da landing/formulário (e-mail, SMS, WhatsApp, grupos, Bio).
 * O link curto recebe `?o=<origem>`; o redirecionamento repassa a origem à página
 * (utm_source na landing, utm_term no simulador) e cada evento de atendimento a registra.
 */
export const CLICK_ORIGINS = ["email", "sms", "whatsapp", "grupos", "bio"] as const;
export type ClickOrigin = (typeof CLICK_ORIGINS)[number];

export const CLICK_ORIGIN_LABEL: Record<ClickOrigin | "direto", string> = {
  email: "E-mail",
  sms: "SMS",
  whatsapp: "WhatsApp",
  grupos: "Grupos de WhatsApp",
  bio: "Link da Bio",
  direto: "Sem origem marcada",
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
