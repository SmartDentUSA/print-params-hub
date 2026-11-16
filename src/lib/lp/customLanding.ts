/** Página personalizada (HTML enviado) de uma landing: preparo do documento e escolha do simulador de WhatsApp. */
export type LandingSimulator = {
  id: string;
  label: string;
  /** Produto do catálogo já escolhido (validado no servidor). */
  product_catalog_id?: string | null;
  /** Botão do formulário já escolhido quando o item não é um produto único. */
  button?: string | null;
};

export const GENERIC_SIMULATOR_ID = "geral";

export function parseSimulators(raw: unknown): LandingSimulator[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: any) => ({
      id: String(s?.id ?? "").trim().slice(0, 80),
      label: String(s?.label ?? "").trim(),
      product_catalog_id: typeof s?.product_catalog_id === "string" && s.product_catalog_id ? s.product_catalog_id : null,
      button: typeof s?.button === "string" && s.button.trim() ? s.button.trim() : null,
    }))
    .filter((s) => s.id && s.label);
}

/** Item clicado → simulador cadastrado; desconhecido cai no atendimento geral (produto escolhido nos botões). */
export function pickSimulator(list: LandingSimulator[], id: unknown): LandingSimulator {
  const key = String(id ?? "").trim();
  return list.find((s) => s.id === key)
    ?? list.find((s) => s.id === GENERIC_SIMULATOR_ID)
    ?? { id: GENERIC_SIMULATOR_ID, label: "Atendimento geral" };
}

/** A página roda num quadro sem endereço próprio: recebe as UTMs e a hora certa da página principal. */
export function prepareLandingDocument(html: string, opts: { search: string; skewMs?: number }) {
  const boot = `<script>window.__SD_LP__=${JSON.stringify({ search: opts.search, skew: opts.skewMs ?? 0 }).replace(/</g, "\\u003c")};</script>`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}${boot}`) : boot + html;
}

export function landingMeta(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]?.trim() ?? "";
  return { title, description };
}
