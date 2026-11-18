/**
 * Filtro "Respondeu SAIR (WhatsApp Oficial)" sobre uma consulta de lia_attendances.
 * Usa a lista wa_official_sair_leads (preenchida pelo registro da timeline) por
 * junção do PostgREST: "only" = junção interna; "exclude" = junção à esquerda
 * sem correspondência. Nunca altera o lead nem tira ninguém de listas.
 */
export type WaSairMode = "exclude" | "only";

const EMBED = "wa_official_sair_leads";

export function applyWaSairFilter<Q>(q: Q, mode: WaSairMode): Q {
  const anyQ = q as any;
  const url: URL | undefined = anyQ?.url;
  if (!url?.searchParams) return q;
  const current = url.searchParams.get("select") || "id";
  if (!current.includes(EMBED)) {
    const join = mode === "only" ? "!inner" : "!left";
    url.searchParams.set("select", `${current},${EMBED}${join}(lead_id)`);
  }
  return mode === "exclude" ? anyQ.is(EMBED, null) : q;
}
