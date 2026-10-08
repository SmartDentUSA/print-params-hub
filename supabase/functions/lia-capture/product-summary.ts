// Use existing copy only; never invent product claims.
function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
  if (/R\$|\b(?:preço|preco|desconto|parcelas?|comiss[aã]o|juros|oferta|gr[aá]tis|gratuito)\b|\d\s*%|\b\d+[.,]\d{2}\b/i.test(text)) return "";
  return text.length <= max ? text : text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}
export function buildProductSummary(_product: string, content: any): string | null {
  if (content?.sectionsEnabled?.positioning === false) return null;
  const section = content?.positioning;
  const parts = [clean(section?.eyebrow, 120), clean(section?.headline?.replace(/\{(?:strike|highlight)\}/g, ""), 220), clean(section?.body, 400)].filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}

export function buildModulesSummary(content: any): string | null {
  if (content?.sectionsEnabled?.modules === false) return null;
  const section = content?.modules;
  if (!section) return null;
  const titles = Array.isArray(section.items) ? [...new Set(section.items.map((item: any) => clean(item?.name, 120)).filter(Boolean))] : [];
  const parts = [clean(section.eyebrow, 120), clean(section.title, 220), clean(section.subtitle, 400), titles.map((title) => `• ${title}`).join("\n")].filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}
