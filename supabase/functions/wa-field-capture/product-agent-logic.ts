// Atendente de produto (teste) — regras puras, sem rede.
export const PRODUCT_AGENT_TEST_PHONES = ["19992612348"];
export const PRODUCT_AGENT_ORIGIN = "[SDRWHTAS] - Qualificação Automática";
export const FOLLOWUP_WINDOW_MS = 24 * 3600 * 1000;

const digits = (s: unknown) => String(s ?? "").replace(/\D+/g, "");
/** DDD + últimos 8 dígitos (com ou sem 55 e 9º dígito). */
export function isProductAgentTestPhone(phone: unknown): boolean {
  let d = digits(phone);
  while (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10) return false;
  return PRODUCT_AGENT_TEST_PHONES.some((t) => t.slice(0, 2) === d.slice(0, 2) && t.slice(-8) === d.slice(-8));
}

export const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9+]+/g, " ").trim();

// Palavras genéricas não identificam produto sozinhas.
const GENERIC = new Set(("resina resinas 3d smart print dent impressora impressoras software softwares equipamento kit de da do das dos " +
  "e para com a o em sistema bio modelo cad lab plus pro ai i a scanner intraoral pos cura chairside chair side 4 0 4.0 ativacao " +
  "cimento adesivo the of digital fluxo").split(" "));

export function distinctiveTokens(name: string): string[] {
  return [...new Set(norm(name).split(" ").filter((t) => t.length >= 3 && !GENERIC.has(t)))];
}

export type CatalogProduct = { id: string; name: string };

/** Produto citado no início da mensagem: mais palavras distintivas casadas, depois nome mais curto (mais específico). */
export function matchProduct(text: string, products: CatalogProduct[]): CatalogProduct | null {
  const head = ` ${norm(text).split(" ").slice(0, 8).join(" ")} `;
  let best: { p: CatalogProduct; score: number } | null = null;
  for (const p of products) {
    const toks = distinctiveTokens(p.name);
    if (!toks.length) continue;
    const hit = toks.filter((t) => head.includes(` ${t} `)).length;
    if (!hit) continue;
    const score = hit * 1000 - p.name.length;
    if (!best || score > best.score) best = { p, score };
  }
  return best?.p ?? null;
}

export function whatsappGroupUrl(u: unknown): string | null {
  const s = String(u ?? "").trim();
  return /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/.test(s) ? s : null;
}

export function sellerMessage(seller: { nome: string } | null, group: string | null, product: string): string {
  const parts = [seller
    ? `✅ Pronto! Seu atendimento sobre *${product}* foi encaminhado para *${seller.nome}*, especialista Smart Dent. Salve o contato abaixo.`
    : `✅ Seu atendimento sobre *${product}* foi encaminhado ao time comercial Smart Dent; um especialista falará com você em breve.`];
  if (group) parts.push(`👥 Grupo de especialistas em ${product}: ${group}`);
  return parts.join("\n\n");
}
