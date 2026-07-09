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
function clean(str: string): string {
  return str.replace(/\s+/g, " ").trim();
}

function truncate(str: string, max = 60): string {
  const s = clean(str);
  return s.length > max ? s.slice(0, max).trimEnd() + "…" : s;
}

function labelFor(el: Element, i: number): string {
  // 1) Primeiro heading real do bloco.
  const heading = el.querySelector("h1,h2,h3");
  const hText = heading ? clean(heading.textContent || "") : "";
  if (hText.length >= 3) return truncate(hText);

  // 2) Primeiro <strong>/<b> significativo.
  const strong = el.querySelector("strong,b");
  const sText = strong ? clean(strong.textContent || "") : "";
  if (sText.length >= 4) return truncate(sText);

  // 3) Primeira linha significativa de texto (ignorando rodapé boilerplate).
  const raw = clean(el.textContent || "");
  const lower = raw.toLowerCase();
  const isFooter = /©|cancelar inscri|descadastr|unsubscribe|todos os direitos|rodap[eé]/.test(lower);
  if (isFooter) return "Rodapé";
  if (raw.length >= 3) return truncate(raw);

  // 4) Fallbacks por categoria (quando não há texto legível — ex.: bloco só com imagem/CTA).
  if (/depoimento|clientes? diz|⭐|★|estrelas?/.test(lower)) return "Prova social";
  const anchors = el.querySelectorAll("a[href]");
  if (anchors.length >= 1) return "Chamada para ação";
  if (el.querySelector("img") && i === 0) return "Hero / Abertura";

  // 5) Último recurso.
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

    // BFS: escolher o container mais próximo do topo com uma faixa saudável
    // de blocos (2..12). Isso evita descer até listas de FAQ com 25 <li>.
    const MIN_KIDS = 2;
    const MAX_KIDS = 12;
    const drillable = new Set(["DIV", "TABLE", "TBODY", "TR", "TD", "CENTER", "MAIN", "ARTICLE", "SECTION"]);
    let best: { el: HTMLElement; children: Element[]; depth: number } | null = null;
    const queue: Array<{ el: HTMLElement; depth: number }> = [{ el: root, depth: 0 }];
    while (queue.length) {
      const { el, depth } = queue.shift()!;
      const kids = contentChildren(el);
      if (kids.length >= MIN_KIDS && kids.length <= MAX_KIDS) {
        if (
          !best ||
          depth < best.depth ||
          (depth === best.depth && kids.length > best.children.length)
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

  // 1) Preferred: HTML-comment markers emitted by renderEmail (LP-aligned).
  const marker = parseMarkerSections(body);
  if (marker.length > 0) return marker;

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

// Marker-based parser. Blocks look like:
//   <!--SD_SEC_START key="hero" label="Hero"-->…<!--SD_SEC_END-->
const MARKER_RE = /<!--\s*SD_SEC_START\s+key="([^"]+)"\s+label="([^"]+)"\s*-->([\s\S]*?)<!--\s*SD_SEC_END\s*-->/g;

function parseMarkerSections(body: string): EmailSection[] {
  const out: EmailSection[] = [];
  let m: RegExpExecArray | null;
  let i = 0;
  MARKER_RE.lastIndex = 0;
  while ((m = MARKER_RE.exec(body)) !== null) {
    const key = m[1];
    const label = m[2];
    out.push({
      id: `${key}-${i++}`,
      key,
      label,
      enabled: true,
      html: m[0],
      removable: true,
    });
  }
  return out;
}

function serializeMarkerSections(originalHtml: string, sections: EmailSection[]): string {
  const disabled = new Set(sections.filter((s) => s.enabled === false).map((s) => s.id));
  const enabledKeys = new Map<string, boolean[]>();
  for (const s of sections) {
    const arr = enabledKeys.get(s.key) ?? [];
    arr.push(s.enabled !== false);
    enabledKeys.set(s.key, arr);
  }
  const cursors = new Map<string, number>();
  return originalHtml.replace(MARKER_RE, (full, key: string) => {
    const idx = cursors.get(key) ?? 0;
    cursors.set(key, idx + 1);
    const flags = enabledKeys.get(key);
    const enabled = flags ? flags[idx] : true;
    return enabled === false ? "" : full;
  });
}

/**
 * Rebuilds the full HTML with only enabled sections, preserving <head>, <body> wrapper and non-section content.
 */
export function serializeSections(originalHtml: string, sections: EmailSection[]): string {
  if (/SD_SEC_START/.test(originalHtml)) {
    return serializeMarkerSections(originalHtml, sections);
  }
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