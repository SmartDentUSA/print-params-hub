import type { ClickOrigin } from "../_shared/click-origin.ts";

/** Caminho do simulador de WhatsApp (conversa da LIA) para um formulário. */
export function whatsappSimulatorPath(formId: string, code: string, origin?: ClickOrigin | null): string {
  const q = new URLSearchParams({
    form: formId,
    utm_source: "short_link",
    utm_medium: "whatsapp_lia",
    utm_campaign: code,
  });
  if (origin) q.set("utm_term", origin);
  return `/embed/dra-lia?${q.toString()}`;
}

/** Caminho da landing ou do formulário; com origem marcada, ela segue como utm_source. */
export function pagePath(target: "landing_page" | "form", slug: string, code: string, origin?: ClickOrigin | null): string {
  const base = target === "landing_page" ? `/lp/${slug}` : `/f/${slug}`;
  if (!origin) return base;
  const q = new URLSearchParams({ utm_source: origin, utm_medium: "shortlink", utm_campaign: code });
  return `${base}?${q.toString()}`;
}
