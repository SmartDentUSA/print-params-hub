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
// Cada <article class="card" data-slug data-name> vira um card no e-mail, com a arte da
// própria landing (copiada para um endereço público, porque o Gmail bloqueia data:image),
// os descontos/preços do card e o cronômetro da fase (imagem animada gerada na abertura).
// Os preços entram só nesses cards, montados pelo sistema; o texto da IA continua sem preços.

export interface LandingCard { slug: string; name: string; category: string }
export interface PriceTable { head: string[]; rows: { cells: { html: string; span: number }[]; total: boolean }[] }
export interface LandingOffer {
  badge: string;
  /** o selo muda com a fase (ex.: "Fase 1 · 25% OFF"); o cronômetro mostra a fase do dia */
  badgeByPhase: boolean;
  timer: "tier" | "fixed" | "end" | null;
  fixedPct: number;
  real: string;
  now: string;
  save: string;
  tables: PriceTable[];
  note: string;
}
export interface EmailProductCard extends LandingCard { imageUrl: string | null; offer?: LandingOffer | null }

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

// ── Ofertas (descontos, preços, cronômetro) e artes dos cards ──

/** Mantém só <b>, <s> e <br> (sem atributos); <small> vira quebra de linha. */
export function safeInline(html: string): string {
  return String(html || "")
    .replace(/<small\b[^>]*>/gi, "<br>")
    .replace(/<(\/?)(b|strong|s|del)\b[^>]*>/gi, (_m, close, tag) => {
      const t = /^(b|strong)$/i.test(tag) ? "b" : "s";
      return `<${close}${t}>`;
    })
    .replace(/<br\s*\/?>/gi, "\u0000")
    .replace(/<(?!\/?(b|s)>)[^>]*>/gi, "")
    .replace(/\u0000/g, "<br>")
    .replace(/(<br>\s*)+$/g, "")
    .replace(/^(\s*<br>)+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const plain = (html: string) => decode(String(html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const money = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function parseTable(tableHtml: string): PriceTable | null {
  const head: string[] = [];
  const thead = tableHtml.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || "";
  for (const m of thead.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)) head.push(safeInline(m[1]));
  const body = tableHtml.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || "";
  const rows: PriceTable["rows"] = [];
  for (const r of body.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...r[2].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)].map((c) => ({
      html: safeInline(c[2]),
      span: Math.max(1, Math.min(8, Number(c[1].match(/\bcolspan\s*=\s*["']?(\d+)/i)?.[1] || 1))),
    }));
    if (cells.length) rows.push({ cells, total: /\bclass\s*=\s*["'][^"']*\btot\b/i.test(r[1]) });
  }
  return rows.length ? { head, rows } : null;
}

/** Lê descontos, preços e o tipo de cronômetro de um card da landing. */
export function extractLandingOffer(cardHtml: string): LandingOffer | null {
  const src = String(cardHtml || "");
  const badgeM = src.match(/<span\b[^>]*class\s*=\s*["'][^"']*\bbadge\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  const badge = badgeM ? plain(badgeM[1]) : "";
  const badgeByPhase = !!badgeM && /data-badge\s*=\s*["']tier["']/i.test(badgeM[0]);
  const timerRaw = src.match(/<div\b[^>]*class\s*=\s*["'][^"']*\btimer\b[^"']*["'][^>]*data-timer\s*=\s*["'](tier|fixed|end)["']/i)?.[1]
    || src.match(/data-timer\s*=\s*["'](tier|fixed|end)["']/i)?.[1] || null;
  const timer = timerRaw as LandingOffer["timer"];
  const fixedPct = Number(badge.match(/(\d{1,2})\s*%\s*OFF\s*fixo/i)?.[1] || 0);

  const infoStart = src.search(/<\/h3>/i);
  const infoEndRel = src.slice(Math.max(0, infoStart)).search(/<div\b[^>]*class\s*=\s*["'][^"']*\b(timer|cta)\b/i);
  const info = infoStart >= 0 ? src.slice(infoStart, infoEndRel >= 0 ? infoStart + infoEndRel : undefined) : "";

  const tables: PriceTable[] = [];
  for (const t of info.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const pt = parseTable(t[0]);
    if (pt) tables.push(pt);
  }
  const saveM = info.match(/<div\b[^>]*class\s*=\s*["']save["'][^>]*>([\s\S]*?)<\/div>/i);
  const save = saveM && !/data-sv/i.test(saveM[0]) ? safeInline(saveM[1]) : "";
  const nowline = info.match(/<div\b([^>]*class\s*=\s*["'][^"']*\bnowline\b[^"']*["'][^>]*)>/i);
  const realHtml = info.match(/<div\b[^>]*class\s*=\s*["']real["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  const nowpHtml = info.match(/<div\b[^>]*class\s*=\s*["']nowp["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  let now = plain(nowpHtml.replace(/<\/small>/gi, " "));
  if (!now && nowline) {
    const prices = (nowline[1].match(/data-prices\s*=\s*["']([^"']+)["']/i)?.[1] || "").split("|").map(Number);
    const phases = prices.slice(1).filter((n) => Number.isFinite(n) && n > 0);
    if (phases.length && phases.every((n) => n === phases[0])) now = `Por ${money(phases[0])}`;
  }
  // Com tabela, o "valor de tabela" já aparece nela.
  const real = tables.length && !now ? "" : safeInline(realHtml);
  const note = safeInline(info.match(/<p\b[^>]*class\s*=\s*["']note["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
  if (!badge && !timer && !tables.length && !real && !now && !save && !note) return null;
  return { badge, badgeByPhase, timer, fixedPct, real, now, save, tables, note };
}

/** Ofertas de todos os cards, por slug. */
export function extractLandingOffers(html: string): Map<string, LandingOffer> {
  const out = new Map<string, LandingOffer>();
  const re = /<article\b([^>]*\bclass\s*=\s*["'][^"']*\bcard\b[^"']*["'][^>]*)>([\s\S]*?)<\/article>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(html || "")))) {
    const slug = m[1].match(/\bdata-slug\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().toLowerCase() || "";
    if (!slug || out.has(slug)) continue;
    const offer = extractLandingOffer(m[2]);
    if (offer) out.set(slug, offer);
  }
  return out;
}

export type LandingArt = { url: string } | { mime: string; base64: string };
const DATA_URI_RE = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/i;
const MAX_ART_BASE64 = 2_000_000;

/** Arte de cada card: <img> do card (https ou data:) ou mapa slug→data:image do script da landing. */
export function extractLandingArtworks(html: string): Map<string, LandingArt> {
  const src = String(html || "");
  const assets = new Map<string, string>();
  const assetRe = /["']([a-z0-9-]{1,80})["']\s*:\s*["'](data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+)["']/gi;
  for (const a of src.matchAll(assetRe)) if (!assets.has(a[1].toLowerCase())) assets.set(a[1].toLowerCase(), a[2]);
  const toArt = (value: string): LandingArt | null => {
    if (/^https:\/\//i.test(value)) return { url: value };
    const d = value.match(DATA_URI_RE);
    if (d && d[2].length <= MAX_ART_BASE64) return { mime: d[1].toLowerCase().replace("jpg", "jpeg"), base64: d[2] };
    return null;
  };
  const out = new Map<string, LandingArt>();
  const re = /<article\b([^>]*\bclass\s*=\s*["'][^"']*\bcard\b[^"']*["'][^>]*)>([\s\S]*?)<\/article>/gi;
  for (const m of src.matchAll(re)) {
    const slug = m[1].match(/\bdata-slug\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().toLowerCase() || "";
    if (!slug || out.has(slug)) continue;
    const img = m[2].match(/<img\b[^>]*>/i)?.[0] || "";
    const key = img.match(/\bdata-[a-z0-9-]*src\s*=\s*["']([a-z0-9-]{1,80})["']/i)?.[1]?.toLowerCase();
    const direct = img.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    const art = (key && assets.has(key) ? toArt(assets.get(key)!) : null) || (direct ? toArt(direct) : null);
    if (art) out.set(slug, art);
  }
  return out;
}

// ── Cards no e-mail (visual escuro da landing) ──

export interface OfferCardsOptions {
  title?: string;
  buttonLabel?: string;
  /** endereço da imagem do cronômetro para o tipo do card; null = sem cronômetro */
  countdownUrl?: (kind: "tier" | "fixed" | "end", fixedPct: number) => string | null;
  /** false = sem o cronômetro grande no topo da seção */
  heroTimer?: boolean;
  /** selo dos cards de desconto por fase (ex.: "25% → 15% → 10% OFF"), no lugar de "Fase 1 · 25% OFF" */
  phaseBadge?: string;
}

const C = {
  page: "#07080d", card: "#11131c", line: "#262a3b", text: "#c3c8d6", white: "#ffffff",
  accent: "#FCB58F", zebra: "#181b28", orange: "#E56838", green: "#1FAF5B", mute: "#8b92a6",
};
const F = "font-family:Arial,Helvetica,sans-serif;";

// Estilos curtos e herdados da tabela: são 20+ cards e o Gmail corta e-mails acima de ~100 KB.
function renderTable(t: PriceTable): string {
  const th = (h: string, i: number) => `<td${i ? ' align="right"' : ""} style="font-size:10px;line-height:13px;color:${C.accent}">${h}</td>`;
  const rows = t.rows.map((r, ri) => {
    let col = 0;
    const tr = r.cells.map((c) => {
      const first = col === 0;
      col += c.span;
      const span = c.span > 1 ? ` colspan="${c.span}"` : "";
      return first ? `<td${span} style="font-size:11px;color:${r.total ? C.white : C.text}">${c.html}</td>` : `<td${span} align="right" nowrap>${c.html}</td>`;
    }).join("");
    return `<tr${ri % 2 === 0 ? ` bgcolor="${C.zebra}"` : ""}${r.total ? ' style="font-weight:700"' : ""}>${tr}</tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="5" cellspacing="0" border="0" style="border-collapse:collapse;${F}font-size:12px;line-height:15px;color:${C.white};font-weight:700;">${t.head.length ? `<tr>${t.head.map(th).join("")}</tr>` : ""}${rows}</table>`;
}

export function renderProductCardsHtml(cards: EmailProductCard[], ctaUrl: string, opts: OfferCardsOptions = {}): string {
  if (!cards.length || !ctaUrl) return "";
  const btn = opts.buttonLabel || "Quero esse preço agora";
  const timerImg = (url: string | null, alt: string) => url
    ? `<img src="${escHtml(url)}" alt="${escHtml(alt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:12px;">`
    : "";
  const card = (c: EmailProductCard) => {
    const href = escHtml(withSimulatorParam(ctaUrl, c.slug));
    const o = c.offer || null;
    const timerUrl = o?.timer && opts.countdownUrl ? opts.countdownUrl(o.timer, o.fixedPct) : null;
    // Selo por fase só faz sentido sem cronômetro (o cronômetro mostra a fase do dia da abertura).
    const badgeText = o?.badgeByPhase && timerUrl ? opts.phaseBadge || "" : o?.badge || "";
    const badge = badgeText
      ? `<div style="margin:0 0 8px;"><span style="${F}display:inline-block;font-size:11px;font-weight:700;color:${C.white};background:${C.orange};border-radius:999px;padding:4px 10px;">${escHtml(badgeText)}</span></div>`
      : "";
    const line = (html: string, size = 13) => html
      ? `<div style="${F}font-size:${size}px;line-height:1.4;color:${C.text};margin-top:6px;">${html}</div>` : "";
    const img = c.imageUrl
      ? `<td width="196" valign="top" style="padding:14px 0 14px 14px;"><a href="${href}" style="text-decoration:none;"><img src="${escHtml(c.imageUrl)}" alt="${escHtml(c.name)}" width="182" style="display:block;width:182px;max-width:182px;height:auto;border:0;border-radius:10px;"></a></td>`
      : "";
    const rows: string[] = [];
    if (o?.tables.length) rows.push(`<tr><td colspan="2" style="padding:0 14px 4px;">${o.tables.map(renderTable).join('<div style="height:8px;line-height:8px;">&nbsp;</div>')}</td></tr>`);
    if (o?.note) rows.push(`<tr><td colspan="2" style="${F}padding:8px 14px 0;font-size:12px;line-height:1.45;color:${C.text};">${o.note}</td></tr>`);
    if (timerUrl) rows.push(`<tr><td colspan="2" style="padding:12px 14px 0;">${timerImg(timerUrl, "Contagem regressiva da oferta")}</td></tr>`);
    return `<tr><td style="padding:7px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:16px;">
<tr>${img}<td valign="top" style="padding:14px;">${badge}${c.category ? `<div style="${F}font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${C.accent};font-weight:700;margin-bottom:5px;">${escHtml(c.category)}</div>` : ""}<div style="${F}font-size:16px;line-height:1.3;color:${C.white};font-weight:700;">${escHtml(c.name)}</div>${line(o?.real || "")}${o?.now ? `<div style="${F}font-size:20px;line-height:1.3;color:${C.white};font-weight:800;margin-top:6px;">${escHtml(o.now)}</div>` : ""}${line(o?.save || "", 12)}</td></tr>
${rows.join("\n")}
<tr><td colspan="2" align="center" style="padding:14px;"><a href="${href}" style="${F}display:inline-block;font-size:14px;font-weight:700;color:${C.white};background:${C.green};text-decoration:none;border-radius:999px;padding:12px 22px;">${escHtml(btn)}</a></td></tr>
</table></td></tr>`;
  };
  const heroTimer = opts.countdownUrl && opts.heroTimer !== false ? opts.countdownUrl("tier", 0) : null;
  const title = opts.title === undefined ? "Escolha o seu produto" : opts.title;
  return `<section data-section="products" data-section-label="Produtos da landing">
<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="max-width:600px;margin:0 auto;background:${C.page};border-radius:18px;">
${title ? `<tr><td style="${F}padding:22px 16px 8px;font-size:21px;font-weight:800;color:${C.white};text-align:center;">${escHtml(title)}</td></tr>` : '<tr><td style="height:6px;line-height:6px;">&nbsp;</td></tr>'}
${heroTimer ? `<tr><td style="padding:4px 20px 8px;">${timerImg(heroTimer, "Contagem regressiva da fase atual")}</td></tr>` : ""}
${cards.map(card).join("\n")}
<tr><td style="height:10px;line-height:10px;">&nbsp;</td></tr>
</table>
</section>`;
}
