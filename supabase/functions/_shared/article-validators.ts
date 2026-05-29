/**
 * Guardrails para artigos gerados por IA.
 * - Bloqueia preços (`content-generation-policy-no-prices-v2`)
 * - Garante slugs canônicos
 * - Garante categoria A-F (`knowledge-base-taxonomy`)
 */

const PRICE_REGEX =
  /(R\$\s*\d|US\$\s*\d|€\s*\d|\bpreço[s]?\b|\bvalor(?:es)?\s+de\b|\bcusta(?:m)?\b|\bvendido por\b|\$\s?\d{1,4})/i;

export function hasForbiddenPrice(text: string): { ok: boolean; matches: string[] } {
  const t = String(text || "");
  const matches: string[] = [];
  const re = new RegExp(PRICE_REGEX.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    matches.push(m[0]);
    if (matches.length >= 5) break;
  }
  return { ok: matches.length === 0, matches };
}

const ALLOWED_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
export function isValidCategoryLetter(letter: string): boolean {
  return (ALLOWED_LETTERS as readonly string[]).includes(String(letter || "").toUpperCase());
}

export function cleanSlug(input: string): string {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export interface ArticleDraft {
  title: string;
  slug: string;
  meta_description: string;
  category_letter: string;
  keywords: string[];
  body_md: string;
  excerpt: string;
  faqs: Array<{ question: string; answer: string }>;
  cta_whatsapp?: string;
}

export function validateDraft(draft: Partial<ArticleDraft>): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!draft.title || draft.title.length < 8) errors.push("title curto ou ausente");
  if (draft.title && draft.title.length > 70) errors.push("title > 70 chars (SEO)");
  if (!draft.slug) errors.push("slug ausente");
  if (!draft.meta_description || draft.meta_description.length < 60) errors.push("meta_description curta");
  if (draft.meta_description && draft.meta_description.length > 170) errors.push("meta_description > 170 chars");
  if (!draft.category_letter || !isValidCategoryLetter(draft.category_letter))
    errors.push("category_letter inválida (A-F)");
  if (!draft.body_md || draft.body_md.length < 800) errors.push("body_md muito curto (< 800 chars)");

  for (const field of ["title", "meta_description", "body_md", "excerpt"] as const) {
    const v = (draft as any)[field];
    if (typeof v === "string") {
      const price = hasForbiddenPrice(v);
      if (!price.ok) errors.push(`preço proibido em ${field}: ${price.matches.join(", ")}`);
    }
  }
  if (Array.isArray(draft.faqs)) {
    for (const f of draft.faqs) {
      const a = hasForbiddenPrice(f?.answer || "");
      const q = hasForbiddenPrice(f?.question || "");
      if (!a.ok || !q.ok)
        errors.push(`preço proibido em FAQ: ${[...a.matches, ...q.matches].join(", ")}`);
    }
  }

  return { ok: errors.length === 0, errors };
}