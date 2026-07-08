export interface EmailSection {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  html: string;
  removable: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero / Abertura",
  intro: "Introdução",
  benefits: "Benefícios",
  features: "Recursos",
  product: "Produto",
  cta: "Chamada para ação",
  "social-proof": "Prova social",
  testimonials: "Depoimentos",
  faq: "FAQ",
  footer: "Rodapé",
  header: "Cabeçalho",
  content: "Conteúdo",
};

function humanize(key: string): string {
  if (SECTION_LABELS[key]) return SECTION_LABELS[key];
  return key
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractBody(html: string): { head: string; bodyOpen: string; body: string; bodyClose: string } {
  const bodyMatch = html.match(/(<body[^>]*>)([\s\S]*?)(<\/body>)/i);
  if (bodyMatch) {
    const headMatch = html.match(/([\s\S]*?)<body[^>]*>/i);
    const closeMatch = html.match(/<\/body>([\s\S]*)$/i);
    return {
      head: headMatch ? headMatch[1] : "",
      bodyOpen: bodyMatch[1],
      body: bodyMatch[2],
      bodyClose: bodyMatch[3] + (closeMatch ? closeMatch[1] : ""),
    };
  }
  return { head: "", bodyOpen: "", body: html, bodyClose: "" };
}

/**
 * Parses <section data-section="key" data-section-label="..."> blocks in the email HTML.
 * If none are found, returns a single non-removable "content" section containing the entire body.
 */
export function parseSections(html: string): EmailSection[] {
  if (!html) return [];
  const { body } = extractBody(html);
  const regex = /<section\b[^>]*\bdata-section=["']([^"']+)["'][^>]*>([\s\S]*?)<\/section>/gi;
  const sections: EmailSection[] = [];
  let idx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    const key = match[1].trim();
    const full = match[0];
    const labelMatch = full.match(/data-section-label=["']([^"']+)["']/i);
    sections.push({
      id: `${key}-${idx++}`,
      key,
      label: labelMatch ? labelMatch[1] : humanize(key),
      enabled: true,
      html: full,
      removable: true,
    });
  }
  if (sections.length === 0) {
    return [
      {
        id: "content-0",
        key: "content",
        label: "Conteúdo",
        enabled: true,
        html: body,
        removable: false,
      },
    ];
  }
  return sections;
}

/**
 * Rebuilds the full HTML with only enabled sections, preserving <head>, <body> wrapper and non-section content.
 */
export function serializeSections(originalHtml: string, sections: EmailSection[]): string {
  const { head, bodyOpen, body, bodyClose } = extractBody(originalHtml);
  if (sections.length === 1 && !sections[0].removable) {
    // Single content section — the visual/HTML editor already owns the body.
    return sections[0].enabled ? originalHtml : `${head}${bodyOpen}${bodyClose}`;
  }
  const regex = /<section\b[^>]*\bdata-section=["'][^"']+["'][^>]*>[\s\S]*?<\/section>/gi;
  let i = 0;
  const newBody = body.replace(regex, (m) => {
    const s = sections[i++];
    if (!s) return m;
    return s.enabled === false ? "" : m;
  });
  return `${head}${bodyOpen}${newBody}${bodyClose}`;
}

/**
 * Toggles a section by id, returning a new sections array.
 */
export function toggleSection(sections: EmailSection[], id: string): EmailSection[] {
  return sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
}