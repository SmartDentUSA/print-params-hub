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
  if (/r\$\s*\d/.test(txt) || /(bundle|assinatura|mensalidade|parcel|desconto|oferta exclusiva)/.test(txt)) return "Preço / Oferta";
  if (/revendedor oficial|oportunidade|exclusivo|lan[çc]amento|novidade/.test(txt) && i <= 1) return "Hero / Abertura";
  const anchors = el.querySelectorAll("a[href]");
  if (anchors.length >= 1 && txt.length < 240 && txt.length > 0) return "Chamada para ação";
  if (/benef[ií]cio|vantagem|✓|✔|inclui|recurso/.test(txt) || el.querySelector("ul,ol")) return "Benefícios";
  if (i === 0 && (el.querySelector("h1,h2") || el.querySelector("img"))) return "Hero / Abertura";
  return `Bloco ${i + 1}`;
}

// Conta filhos "de conteúdo" (com heading, imagem, âncora, texto significativo).
function contentChildren(el: Element): Element[] {
  return Array.from(el.children).filter((c) => {
    const txt = (c.textContent || "").trim();
    if (txt.length >= 20) return true;
    if (c.querySelector("h1,h2,h3,img,a[href],button")) return true;
    return false;
  });
}

function parseAuto(bodyHtml: string): EmailSection[] | null {
  if (typeof DOMParser === "undefined") return null;
  try {
    const doc = new DOMParser().parseFromString(
      `<!doctype html><html><body><div id="__sd_root">${bodyHtml}</div></body></html>`,
      "text/html",
    );
    const root = doc.getElementById("__sd_root") as HTMLElement | null;
    if (!root) return null;

    // BFS até profundidade 10 procurando o descendente com MAIS filhos "de conteúdo".
    // Preferimos ≥3; se nada satisfaz, aceitamos o melhor com ≥2.
    const drillable = new Set(["DIV", "TABLE", "TBODY", "TR", "TD", "CENTER", "MAIN", "ARTICLE", "SECTION"]);
    let best: { el: HTMLElement; children: Element[]; depth: number } | null = null;
    const queue: Array<{ el: HTMLElement; depth: number }> = [{ el: root, depth: 0 }];
    while (queue.length) {
      const { el, depth } = queue.shift()!;
      const kids = contentChildren(el);
      if (kids.length >= 2) {
        if (
          !best ||
          kids.length > best.children.length ||
          (kids.length === best.children.length && depth > best.depth)
        ) {
          best = { el, children: kids, depth };
        }
      }
      if (depth < 10) {
        for (const c of Array.from(el.children)) {
          if (drillable.has(c.tagName)) queue.push({ el: c as HTMLElement, depth: depth + 1 });
        }
      }
    }
    if (!best) return null;
    const container = best.el;
    const children = best.children;

    // Build shell (everything wrapping the container up to __sd_root) via a marker swap.
    const marker = "__SD_SECTIONS_MARKER__";
    const originalInner = container.innerHTML;
    container.innerHTML = marker;
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
    const enabled = sections.filter((s) => s.enabled);
    if (enabled.length === 0) {
      return `${head}${bodyOpen}<!-- todas as seções foram desativadas -->${bodyClose}`;
    }
    const inner = enabled.map((s) => s.html).join("\n");
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