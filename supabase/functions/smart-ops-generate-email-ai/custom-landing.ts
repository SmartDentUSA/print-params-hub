// Landing pages enviadas como HTML próprio (custom_html) não usam o conteúdo
// estruturado do modelo padrão (que pode estar desatualizado). Para o e-mail,
// extraímos só o texto visível e a primeira imagem pública da própria página.
// Valores em R$ e percentuais são removidos: e-mails gerados nunca citam preços.

export interface CustomLandingContext {
  title: string;
  text: string;
  imageUrl: string | null;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
};

function decode(s: string): string {
  return s
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
}

export function stripCommercialValues(s: string): string {
  return s
    .replace(/R\$\s*[\d.,]+(\s*(mil|k))?/gi, "")
    .replace(/\b\d{1,3}(?:[.,]\d+)?\s*%/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function extractCustomLandingText(html: string, maxChars = 6000): CustomLandingContext {
  const src = String(html || "");
  const titleMatch = src.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const clean = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const title = stripCommercialValues(clean(h1Match?.[1] || titleMatch?.[1] || ""));

  let imageUrl: string | null = null;
  const imgRe = /<img\b[^>]*\bsrc\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(src))) {
    if (!/\.svg(\?|$)/i.test(m[2])) { imageUrl = m[2]; break; }
  }

  const body = src
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|noscript|template|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/div|\/section|\/article|\/button|\/a)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const seen = new Set<string>();
  const lines: string[] = [];
  let total = 0;
  for (const raw of decode(body).split(/\n+/)) {
    const line = stripCommercialValues(raw.replace(/\s+/g, " ").trim());
    if (line.length < 3 || seen.has(line.toLowerCase())) continue;
    seen.add(line.toLowerCase());
    if (total + line.length > maxChars) break;
    lines.push(line);
    total += line.length + 1;
  }
  return { title, text: lines.join("\n"), imageUrl };
}

// ── Cards de produto da landing (HTML próprio) ──
// Cada <article class="card" data-slug data-name> vira um card no e-mail. A arte da
// landing traz preços (e vem embutida como data:image, que o Gmail bloqueia), então a
// foto do e-mail é a imagem do produto no catálogo, ligada pelo custom_simulators.

export interface LandingCard { slug: string; name: string; category: string }
export interface EmailProductCard extends LandingCard { imageUrl: string | null }

export const PRODUCT_CARDS_MARKER = "<!--PRODUTOS_LANDING-->";

/** Nome do card sem valores comerciais ("com 15% OFF", R$, percentuais). */
export function cleanCardName(s: string): string {
  const noOff = String(s || "")
    .replace(/\s*(com\s+)?\d{1,3}(?:[.,]\d+)?\s*%\s*(de\s+)?(off|desconto)\b/gi, "")
    .replace(/\b(off|desconto)\b\s*$/i, "");
  return stripCommercialValues(noOff).replace(/\s+,/g, ",").replace(/[·,\s]+$/, "").trim();
}

export function extractLandingCards(html: string, max = 40): LandingCard[] {
  const src = String(html || "");
  const re = /<article\b([^>]*\bclass\s*=\s*["'][^"']*\bcard\b[^"']*["'][^>]*)>([\s\S]*?)<\/article>/gi;
  const out: LandingCard[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) && out.length < max) {
    const attrs = m[1];
    const slug = attrs.match(/\bdata-slug\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().toLowerCase() || "";
    const rawName = attrs.match(/\bdata-name\s*=\s*["']([^"']+)["']/i)?.[1]
      || m[2].match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "";
    const rawCat = m[2].match(/<div[^>]*class\s*=\s*["'][^"']*\bcat\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
    const name = cleanCardName(decode(rawName.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " "));
    const category = cleanCardName(decode(rawCat.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " "));
    if (!/^[a-z0-9-]{1,80}$/.test(slug) || !name || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, name, category });
  }
  return out;
}

/** Link do card: o mesmo link do botão principal, abrindo o simulador daquele produto. */
export function withSimulatorParam(url: string, slug: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("sim", slug);
    return u.toString();
  } catch {
    return url;
  }
}

const escHtml = (s: string) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderProductCardsHtml(
  cards: EmailProductCard[],
  ctaUrl: string,
  opts: { title?: string; buttonLabel?: string } = {},
): string {
  if (!cards.length || !ctaUrl) return "";
  const navy = "#363E56", orange = "#E56838", soft = "#F4F5F8", textSoft = "#5B6275";
  const btn = opts.buttonLabel || "Quero esse produto";
  const cell = (c: EmailProductCard) => {
    const href = escHtml(withSimulatorParam(ctaUrl, c.slug));
    const img = c.imageUrl
      ? `<a href="${href}" style="text-decoration:none;"><img src="${escHtml(c.imageUrl)}" alt="${escHtml(c.name)}" width="248" style="display:block;width:100%;max-width:248px;height:auto;margin:0 auto 12px;border:0;border-radius:10px;background:#ffffff;"></a>`
      : "";
    return `<td class="pc" width="50%" valign="top" style="padding:6px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${soft};border-radius:14px;">
    <tr><td style="padding:14px;text-align:center;">
      ${img}
      ${c.category ? `<div style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${orange};font-weight:700;margin-bottom:6px;">${escHtml(c.category)}</div>` : ""}
      <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.3;color:${navy};font-weight:700;margin-bottom:12px;">${escHtml(c.name)}</div>
      <a href="${href}" style="display:inline-block;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;background:${orange};text-decoration:none;border-radius:999px;padding:10px 18px;">${escHtml(btn)}</a>
    </td></tr>
  </table>
</td>`;
  };
  const rows: string[] = [];
  for (let i = 0; i < cards.length; i += 2) {
    rows.push(`<tr>${cell(cards[i])}${cards[i + 1] ? cell(cards[i + 1]) : '<td class="pc" width="50%" style="padding:6px;"></td>'}</tr>`);
  }
  return `<section data-section="products" data-section-label="Produtos da landing">
<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">
  <tr><td style="padding:18px 10px 6px;font-family:Arial,sans-serif;font-size:20px;font-weight:800;color:${navy};text-align:center;">${escHtml(opts.title || "Escolha o seu produto")}</td></tr>
  <tr><td style="padding:0 4px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("\n")}</table>
  </td></tr>
</table>
</section>`;
}

/** Coloca os cards no lugar marcado pela IA; sem marcador, antes do bloco do botão (ou do rodapé). */
export function insertProductCards(html: string, cardsHtml: string): string {
  if (!cardsHtml) return html.replaceAll(PRODUCT_CARDS_MARKER, "");
  if (html.includes(PRODUCT_CARDS_MARKER)) {
    const [first, ...rest] = html.split(PRODUCT_CARDS_MARKER);
    return first + cardsHtml + rest.join("");
  }
  const anchor = html.search(/<section\b[^>]*\bdata-section\s*=\s*["'](cta|footer)["']/i);
  if (anchor >= 0) return html.slice(0, anchor) + cardsHtml + html.slice(anchor);
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${cardsHtml}</body>`) : html + cardsHtml;
}

const GENERIC_SLUG_TOKENS = new Set(["kit", "combo", "itens", "avulsos", "cores", "resinas", "resina", "rms", "smart", "de", "e"]);

/** Card sem produto único (itens avulsos, combos) usa a foto do card da mesma linha (ex.: kit-smartmake). */
export function fillMissingImages(cards: EmailProductCard[]): EmailProductCard[] {
  const tokens = (slug: string) => slug.split("-").filter((t) => t.length > 2 && !GENERIC_SLUG_TOKENS.has(t));
  return cards.map((c) => {
    if (c.imageUrl) return c;
    const mine = tokens(c.slug);
    let best: EmailProductCard | null = null;
    let bestScore = 0;
    for (const o of cards) {
      if (!o.imageUrl || o.slug === c.slug) continue;
      const score = tokens(o.slug).filter((t) => mine.includes(t)).length;
      if (score > bestScore) { best = o; bestScore = score; }
    }
    return best ? { ...c, imageUrl: best.imageUrl } : c;
  });
}
