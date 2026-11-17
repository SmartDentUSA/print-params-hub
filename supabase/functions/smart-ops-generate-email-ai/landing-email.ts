// Landing enviada como HTML próprio (custom_html) → e-mail. Percorre a página na ordem
// (cabeçalho, seções do <main>, rodapé) e converte cada bloco para HTML de e-mail:
// títulos, textos, imagens públicas, botões, cronômetros (imagem animada), fases e os
// cards de produto. Nenhum texto é escrito pela IA: o e-mail é a própria landing.
import { DOMParser, type Element } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";
import { renderProductCardsHtml, safeInline, withSimulatorParam, type EmailProductCard } from "./custom-landing.ts";
import type { CountdownConfig } from "../_shared/email-countdown.ts";

export interface LandingEmailInput {
  html: string;
  ctaUrl: string;
  cards: EmailProductCard[];
  /** ids de simulador existentes (custom_simulators) — botão com esse data-slug abre o simulador */
  simulatorIds: Set<string>;
  countdown: CountdownConfig | null;
  countdownUrl: ((kind: "tier" | "fixed" | "end", fixedPct: number) => string | null) | undefined;
  phaseBadge?: string;
}

export interface LandingEmail { subject: string; preheader: string; buttonLabel: string; html: string }

const P = {
  bg: "#060606", panel: "#121214", line: "#26262b", text: "#F4F5F9", mute: "#A3A8BC",
  orange: "#F47C42", accent: "#FCB58F", green: "#1FAF5B",
};
const F = "font-family:Poppins,Arial,Helvetica,sans-serif;";
const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "SVG", "NOSCRIPT", "TEMPLATE", "NAV", "FORM", "INPUT", "SELECT", "TEXTAREA", "IFRAME", "VIDEO"]);
const SKIP_CLASSES = ["chips", "lb", "dock", "fab", "zoombtn", "store", "beam", "streak"];
const BLOCK_TAGS = new Set(["DIV", "SECTION", "ARTICLE", "ASIDE", "HEADER", "FOOTER", "MAIN", "P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "IMG", "TABLE", "FIGURE", "DETAILS"]);

/** Trecho com destaque: <em>/.hot viram laranja; mantém negrito, riscado e quebra. */
function inlineHtml(el: Element): string {
  const raw = el.innerHTML
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "\u0001$2\u0002")
    .replace(/<span\b[^>]*class\s*=\s*["'][^"']*\bhot\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, "\u0001$1\u0002")
    .replace(/<span\b[^>]*style\s*=\s*["'][^"']*color\s*:\s*var\(--orange\)[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, "\u0001$1\u0002")
    .replace(/<sup\b[^>]*>([\s\S]*?)<\/sup>/gi, "$1");
  return safeInline(raw)
    .replace(/\u0001/g, `<span style="color:${P.orange};">`)
    .replace(/\u0002/g, "</span>");
}

const plainText = (el: Element) => (el.textContent || "").replace(/\s+/g, " ").trim();
const hasClass = (el: Element, c: string) => (el.getAttribute("class") || "").split(/\s+/).includes(c);

export function landingToEmail(input: LandingEmailInput): LandingEmail {
  // As artes (data:image) já foram tratadas pelos cards; tirar deixa a leitura leve.
  const html = String(input.html || "").replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/gi, "data:,");
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new Error("landing sem HTML legível");
  const cardsBySlug = new Map(input.cards.map((c) => [c.slug, c]));
  const out: string[] = [];
  let firstButton = "";
  let preheader = "";

  const row = (inner: string, pad = "8px 28px") => `<tr><td style="padding:${pad};">${inner}</td></tr>`;
  const button = (label: string, slug: string | null) => {
    if (!firstButton) firstButton = label;
    const href = slug && input.simulatorIds.has(slug) ? withSimulatorParam(input.ctaUrl, slug) : input.ctaUrl;
    return row(`<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${P.green}" style="border-radius:999px;"><a href="${esc(href)}" style="${F}display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(label)}</a></td></tr></table>`, "12px 28px");
  };
  const image = (src: string, alt: string, width = 544) =>
    row(`<img src="${esc(src)}" alt="${esc(alt)}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;margin:0 auto;border:0;border-radius:12px;">`);
  const timer = (kind: "tier" | "fixed" | "end") => {
    const url = input.countdownUrl?.(kind, 0);
    return url ? image(url, "Contagem regressiva", 544) : "";
  };

  const steps = (el: Element) => {
    const cells = [...el.querySelectorAll(".step")].map((s) => {
      const strong = plainText(s.querySelector("strong") as Element || s);
      const unit = plainText(s.querySelector("span") as Element || s);
      const small = plainText(s.querySelector("small") as Element || s);
      return `<td align="center" style="${F}padding:10px 4px;border:1px solid ${P.line};border-radius:12px;background:${P.panel};"><div style="font-size:24px;font-weight:800;color:${P.text};">${esc(strong)}</div><div style="font-size:11px;font-weight:700;color:${P.orange};">${esc(unit)}</div><div style="font-size:10px;color:${P.mute};">${esc(small)}</div></td>`;
    });
    return cells.length
      ? row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="6" border="0"><tr>${cells.join("")}</tr></table>`)
      : "";
  };

  const imgSrc = (img: Element): string | null => {
    const src = img.getAttribute("src") || "";
    if (/^https:\/\//i.test(src) && !/\.svg(\?|$)/i.test(src)) return src;
    const parentCat = img.parentElement?.getAttribute("data-cat") || "";
    return /^https:\/\//i.test(parentCat) ? parentCat : null;
  };

  const walk = (el: Element) => {
    const tag = el.tagName;
    if (SKIP_TAGS.has(tag) || el.getAttribute("aria-hidden") === "true" || SKIP_CLASSES.some((c) => hasClass(el, c))) return;
    // Textos que a página preenche por script ("Carregando…", rótulos de fase) ficam de fora.
    if (el.getAttributeNames().some((n) => /^data-(hero|bar|dock|fin|t)-/.test(n) || n === "data-badge")) return;

    if (el.querySelector && hasClass(el, "grid") && el.querySelector("article")) {
      const slugs = [...el.querySelectorAll("article")].map((a) => (a as Element).getAttribute("data-slug")?.toLowerCase() || "");
      const cards = slugs.map((s) => cardsBySlug.get(s)).filter((c): c is EmailProductCard => !!c);
      const cardsHtml = renderProductCardsHtml(cards, input.ctaUrl, {
        title: "", heroTimer: false, countdownUrl: input.countdownUrl, phaseBadge: input.phaseBadge,
      });
      if (cardsHtml) out.push(`<tr><td style="padding:0 0 8px;">${cardsHtml}</td></tr>`);
      return;
    }
    if (hasClass(el, "cells") || el.getAttribute("role") === "timer") { out.push(timer("tier")); return; }
    if (hasClass(el, "steps")) { out.push(steps(el)); return; }
    if (hasClass(el, "proof")) {
      const items = [...el.children].map((c) => plainText(c as Element)).filter(Boolean);
      if (items.length) out.push(row(items.map((t) => `<div style="${F}font-size:14px;line-height:1.5;color:${P.text};margin:3px 0;"><span style="color:${P.green};font-weight:800;">✓</span>&nbsp; ${esc(t)}</div>`).join("")));
      return;
    }
    if (tag === "A") {
      const label = plainText(el);
      if (label && (hasClass(el, "btn") || el.hasAttribute("data-wa"))) out.push(button(label, el.getAttribute("data-slug")?.toLowerCase() || null));
      return;
    }
    if (tag === "IMG") {
      const src = imgSrc(el);
      if (src) {
        const w = Number(el.getAttribute("width") || 0);
        out.push(image(src, el.getAttribute("alt") || "", w && w < 544 ? Math.max(160, Math.min(544, w)) : 544));
      }
      return;
    }
    if (/^H[1-6]$/.test(tag)) {
      const size = tag === "H1" ? 30 : tag === "H2" ? 23 : tag === "H3" ? 18 : 15;
      const inner = inlineHtml(el);
      if (inner) out.push(row(`<div style="${F}font-size:${size}px;line-height:1.25;font-weight:800;color:${P.text};text-align:center;">${inner}</div>`, tag === "H1" ? "14px 28px 6px" : "16px 28px 4px"));
      return;
    }
    if (tag === "LI") {
      const inner = inlineHtml(el);
      if (inner) out.push(row(`<div style="${F}font-size:13px;line-height:1.5;color:${P.mute};text-align:center;">${inner}</div>`, "2px 28px"));
      return;
    }
    const hasBlockChild = [...el.children].some((c) => BLOCK_TAGS.has((c as Element).tagName) || (c as Element).tagName === "A" && ((c as Element).hasAttribute("data-wa") || hasClass(c as Element, "btn")));
    if (tag === "P" || !hasBlockChild) {
      const inner = inlineHtml(el);
      if (!inner || /carregando/i.test(inner)) return;
      const lead = hasClass(el, "lead");
      if (lead && !preheader) preheader = plainText(el);
      const small = hasClass(el, "legal");
      out.push(row(`<div style="${F}font-size:${small ? 11 : lead ? 16 : 14}px;line-height:1.55;color:${small ? P.mute : P.text};text-align:center;">${inner}</div>`, "6px 28px"));
      return;
    }
    for (const c of [...el.children]) walk(c as Element);
  };

  const sectionWrap = (key: string, label: string, start: number) => {
    const body = out.splice(start).join("\n");
    if (body.trim()) out.push(`<tr><td style="padding:0;"><section data-section="${esc(key)}" data-section-label="${esc(label)}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table></section></td></tr>`);
  };

  // Cabeçalho: só a marca.
  const logo = doc.querySelector("header img, .hdr img, .brand img") as Element | null;
  if (logo) { const src = imgSrc(logo); if (src) out.push(row(`<img src="${esc(src)}" alt="${esc(logo.getAttribute("alt") || "Smart Dent")}" width="200" style="display:block;width:200px;max-width:200px;height:auto;margin:0 auto;border:0;">`, "20px 28px 8px")); }

  const main = (doc.querySelector("main") || doc.body) as Element;
  let n = 0;
  for (const sec of [...main.children]) {
    const s = sec as Element;
    if (s.tagName === "SCRIPT" || s.tagName === "STYLE") continue;
    n++;
    const start = out.length;
    if (hasClass(s, "hero")) {
      // A logo do topo já entrou no cabeçalho.
      const heroLogo = s.querySelector(".logo-hero");
      if (heroLogo) heroLogo.remove();
    }
    walk(s);
    const cls = (s.getAttribute("class") || "").split(/\s+/).filter((c) => c && c !== "rv")[0] || `secao-${n}`;
    const label = plainText((s.querySelector("h1, h2, h3, strong") as Element) || s).slice(0, 40) || cls;
    sectionWrap(cls === "catalog" ? "products" : cls, label, start);
  }

  const footer = doc.querySelector("footer") as Element | null;
  if (footer) {
    const start = out.length;
    for (const blk of [...footer.querySelectorAll("h4, p, li")]) {
      const e = blk as Element;
      const text = e.tagName === "LI" ? esc(plainText(e)) : inlineHtml(e);
      if (!text) continue;
      const head = e.tagName === "H4";
      out.push(row(`<div style="${F}font-size:${head ? 13 : 12}px;line-height:1.5;font-weight:${head ? 800 : 400};color:${head ? P.text : P.mute};text-align:center;">${text}</div>`, head ? "12px 28px 2px" : "1px 28px"));
    }
    sectionWrap("footer", "Rodapé", start);
  }

  const title = plainText((doc.querySelector("title") as Element) || (doc.querySelector("h1") as Element) || doc.body as Element);
  const subject = title.slice(0, 90) || "Smart Dent";
  const body = `<!doctype html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${P.bg};">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${esc(preheader.slice(0, 130))}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${P.bg}" style="background:${P.bg};"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${P.bg};">
${out.join("\n")}
<tr><td style="height:24px;line-height:24px;">&nbsp;</td></tr>
</table></td></tr></table>
</body></html>`;
  return { subject, preheader: preheader.slice(0, 130), buttonLabel: firstButton || "Saiba mais", html: body };
}
