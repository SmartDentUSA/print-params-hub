// Use existing copy only; never invent product claims.
function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
  if (/R\$|\b(?:preço|preco|desconto|parcelas?|comiss[aã]o|juros|oferta|gr[aá]tis|gratuito)\b|\d\s*%|\b\d+[.,]\d{2}\b/i.test(text)) return "";
  return text.length <= max ? text : text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}
export function buildProductSummary(product: string, content: any, fallback: unknown = ""): string | null {
  const intro = clean(content?.hero?.sub, 220) || clean(fallback, 220);
  const benefits = content?.sectionsEnabled?.benefits === false ? [] : content?.benefits?.items;
  const candidates: unknown[] = [
    ...(Array.isArray(content?.hero?.bullets) ? content.hero.bullets : []),
    ...(Array.isArray(benefits) ? benefits.map((b: any) => typeof b === "string" ? b : [b?.title, b?.desc].filter(Boolean).join(": ")) : []),
  ];
  const points = [...new Set(candidates.map((v) => clean(v, 140)).filter(Boolean))].slice(0, 3);
  if (!intro && !points.length) return null;
  return [`Sobre o ${product}:`, intro, points.map((v) => `• ${v}`).join("\n")].filter(Boolean).join("\n\n");
}
