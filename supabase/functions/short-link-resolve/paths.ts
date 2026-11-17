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

/** Item da landing (card de produto) que deve abrir o simulador ao chegar; só ids simples. */
export function normalizeSimParam(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{1,80}$/.test(v) ? v : null;
}

/** Caminho da landing ou do formulário; com origem marcada, ela segue como utm_source. */
export function pagePath(target: "landing_page" | "form", slug: string, code: string, origin?: ClickOrigin | null, sim?: string | null): string {
  const base = target === "landing_page" ? `/lp/${slug}` : `/f/${slug}`;
  const simId = target === "landing_page" ? normalizeSimParam(sim) : null;
  if (!origin && !simId) return base;
  const q = new URLSearchParams();
  if (origin) {
    q.set("utm_source", origin);
    q.set("utm_medium", "shortlink");
    q.set("utm_campaign", code);
  }
  if (simId) q.set("sim", simId);
  return `${base}?${q.toString()}`;
}
