export interface EmailSection {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  html: string;
  removable: boolean;
  auto?: boolean;
  _shell?: { before: string; after: string };
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

// ── Heurística: quando o HTML não tem <section data-section>, tentamos
// detectar blocos automaticamente varrendo o container principal do body.
function labelFor(el: Element, i: number): string {
  const txt = (el.textContent || "").toLowerCase();
  if (/©|cancelar inscri|descadastr|unsubscribe|todos os direitos|rodap[eé]/.test(txt)) return "Rodapé";
  if (/depoimento|clientes? diz|⭐|★|estrelas?/.test(txt)) return "Prova social";
  if (/r\$\s*\d/.test(txt) && /(por|apenas|só|mensa|parcel|desconto|oferta)/.test(txt)) return "Preço / Oferta";
  const anchors = el.querySelectorAll("a[href]");
  if (anchors.length >= 1 && txt.length < 240 && txt.length > 0) return "Chamada para ação";
  if (/benef[ií]cio|vantagem|✓|✔|inclui|recurso/.test(txt) || el.querySelector("ul,ol")) return "Benefícios";
  if (i === 0 && (el.querySelector("h1,h2") || el.querySelector("img"))) return "Hero / Abertura";
  return `Bloco ${i + 1}`;
}

function parseAuto(bodyHtml: string): EmailSection[] | null {
  if (typeof DOMParser === "undefined") return null;
  try {
    const doc = new DOMParser().parseFromString(
      `<!doctype html><html><body><div id="__sd_root">${bodyHtml}</div></body></html>`,
      "text/html",
    );
    let container = doc.getElementById("__sd_root") as HTMLElement | null;
    if (!container) return null;

    // Drill into single-element wrappers (div/table/center/tbody/tr/td...) to find the real content container.
    const drillable = new Set(["DIV", "TABLE", "TBODY", "TR", "TD", "CENTER", "MAIN", "ARTICLE"]);
    for (let depth = 0; depth < 6; depth++) {
      const elChildren = Array.from(container.children);
      if (elChildren.length === 1 && drillable.has(elChildren[0].tagName)) {
        container = elChildren[0] as HTMLElement;
      } else {
        break;
      }
    }

    const children = Array.from(container.children).filter((el) => {
      const txt = (el.textContent || "").trim();
      return txt.length > 0 || !!el.querySelector("img,button,a");
    });
    if (children.length < 2) return null;

    // Build shell (everything wrapping the container up to __sd_root) via a marker swap.
    const marker = "__SD_SECTIONS_MARKER__";
    const originalInner = container.innerHTML;
    container.innerHTML = marker;
    const root = doc.getElementById("__sd_root")!;
    const wrapped = root.innerHTML;
    const [before, after] = wrapped.split(marker);
    container.innerHTML = originalInner;

    return children.map((el, i) => ({
      id: `auto-${i}`,
      key: `auto-${i}`,
      label: labelFor(el, i),
      enabled: true,
      html: el.outerHTML,
      removable: true,
      auto: true,
      _shell: i === 0 ? { before, after } : undefined,
    }));
  } catch {
    return null;
  }
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
    // Sem markup explícito → tenta detectar blocos automaticamente.
    const auto = parseAuto(body);
    if (auto && auto.length > 0) return auto;
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
  // Heurística: sections auto → reconstroi o container preservando o shell.
  if (sections.some((s) => s.auto)) {
    const shell = sections.find((s) => s._shell)?._shell ?? { before: "", after: "" };
    const inner = sections.filter((s) => s.enabled).map((s) => s.html).join("\n");
    return `${head}${bodyOpen}${shell.before}${inner}${shell.after}${bodyClose}`;
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