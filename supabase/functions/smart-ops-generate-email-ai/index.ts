import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CtaRef {
  tipo: "landing" | "form" | "custom";
  id?: string;
  url?: string;
  label?: string;
}

interface Body {
  produto?: string;
  produto_id?: string;
  cta_principal?: CtaRef;
  ctas_secundarios?: CtaRef[];
  segmento_resumo?: string;
  tom?: string;
  regenerate?: "all" | "subject";
  base_html?: string;
  use_landing_page?: boolean;
}

// ── Smart Dent LP palettes (mirrors PremiumLandingTemplate) ──
type LPThemeKey = "exocad-purple" | "navy-gold" | "emerald-cream" | "coral-slate" | "charcoal-ember" | "ocean-deep";

type LPThemeTokens = {
  brand: string;
  brandDark: string;
  brand2: string;
  text: string;
  textSoft: string;
  border: string;
  soft: string;
  bgSoft: string;
  orange: string;
  orangeSoft: string;
};

const LP_THEMES: Record<LPThemeKey, LPThemeTokens> = {
  "exocad-purple": {
    brand: "#605882", brandDark: "#4d466b", brand2: "#8B82A8",
    text: "#42495C", textSoft: "#5A5670", border: "#EFEBF4",
    soft: "#F3F0F8", bgSoft: "#FBFAFD", orange: "#DF7344", orangeSoft: "#FFF6F1",
  },
  "navy-gold": {
    brand: "#1E3A5F", brandDark: "#0F1B3D", brand2: "#3B6FA0",
    text: "#0F1B3D", textSoft: "#4A5A72", border: "#DCE3EE",
    soft: "#E8EDF3", bgSoft: "#F5F7FB", orange: "#C9A84C", orangeSoft: "#FBF6E4",
  },
  "emerald-cream": {
    brand: "#0D7A5F", brandDark: "#064E3B", brand2: "#10B981",
    text: "#064E3B", textSoft: "#3F6B5C", border: "#D4EBE0",
    soft: "#E6F5EF", bgSoft: "#F5FDF9", orange: "#C9A84C", orangeSoft: "#FBF6E4",
  },
  "coral-slate": {
    brand: "#574B90", brandDark: "#3E356A", brand2: "#8A7EC4",
    text: "#2D2D5F", textSoft: "#605D80", border: "#E5DEEB",
    soft: "#F3EEF6", bgSoft: "#FBFAFF", orange: "#FF6B6B", orangeSoft: "#FFF0F0",
  },
  "charcoal-ember": {
    brand: "#2D2D2D", brandDark: "#1A1A1A", brand2: "#4A4A4A",
    text: "#1A1A1A", textSoft: "#525252", border: "#E5E4E3",
    soft: "#EDECEB", bgSoft: "#FAFAFA", orange: "#E85D3A", orangeSoft: "#FFF1EC",
  },
  "ocean-deep": {
    brand: "#1A4A6E", brandDark: "#0C2340", brand2: "#2D8A9E",
    text: "#0C2340", textSoft: "#3F5A76", border: "#D0E1EC",
    soft: "#DEEEF4", bgSoft: "#F4F9FB", orange: "#5CBDB9", orangeSoft: "#E6F6F5",
  },
};

function getTheme(theme?: unknown): LPThemeTokens {
  const key = typeof theme === "string" && theme in LP_THEMES ? theme as LPThemeKey : "exocad-purple";
  return LP_THEMES[key];
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}

// Strip anything price-shaped from LP text (Core rule: no prices in AI content).
function stripPrices(s: string): string {
  if (!s) return s;
  return s
    .replace(/R\$\s*[\d.,]+/gi, "")
    .replace(/\binicia-se a cobrança mensal de\s*(?:no cartão cadastrado)?/gi, "inicia-se a recorrência no cartão cadastrado")
    .replace(/\bcobrança mensal de\s*(?:no cartão)?/gi, "recorrência")
    .replace(/\b(?:de|por|mensalidade\s+de|ativação\s+de|cobrança\s+mensal\s+de)\s*[\d]{1,3}(?:\.\d{3})*(?:,\d{2})?/gi, "")
    .replace(/\b[\d]{1,3}(?:\.\d{3})*(?:,\d{2})?\s*(?:no cartão|por mês|mensais|mensal|\/mês)/gi, "")
    .replace(/\b\d+(?:[,.]\d+)?%\b/g, "")
    .replace(/\{strike\}/gi, "")
    .replace(/\bpor\s+R\$[^.,]*/gi, "")
    .replace(/\s+([,.!?:;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanPriceHeavyText(v: unknown): string {
  const raw = typeof v === "string" ? v : cleanLpText(v);
  if (!raw) return "";
  const hadCommercialValue = /R\$|\b(?:por|de)\s*[\d]{1,3}(?:\.\d{3})*(?:,\d{2})?|\b\d+(?:[,.]\d+)?%\b/i.test(raw);
  const cleaned = stripPrices(raw);
  if (!hadCommercialValue) return cleaned;
  if (cleaned.length < 30 || /\b(de|por|mensalidade|desconto)\b/i.test(cleaned)) return "";
  return cleaned;
}

function cleanLpText(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(cleanLpText).filter(Boolean).join(" ");
  if (typeof v === "object") return "";
  return stripPrices(String(v));
}

type LPDossier = {
  hero_image_url?: string | null;
  logo_url?: string | null;
  theme?: LPThemeKey;
  brand_name?: string;
  reseller_badge?: string;
  nav_cta?: string;
  hero: {
    eyebrow?: string;
    badge?: string;
    headline_parts?: { text: string; highlight?: boolean }[];
    headline?: string;
    sub?: string;
    bullets?: string[];
    trust?: string[];
    primary_cta?: string;
    secondary_cta?: string;
    product_card_caption?: string;
  };
  positioning?: { eyebrow?: string; headline?: string; body?: string };
  conditions?: {
    title?: string;
    subtitle?: string;
    items: { title: string; ribbon?: string; includes: string[]; footnote?: string }[];
  };
  final_cta?: { headline?: string; sub?: string; cta?: string };
  trust_bar?: string[];
};

async function loadLpDossier(
  supabase: any,
  ctaPrincipal: CtaRef | undefined,
  produtoId: string | undefined,
): Promise<LPDossier | null> {
  try {
    let row: any = null;
    let reason = "";

    // Prefer explicit landing CTA id.
    if (ctaPrincipal?.tipo === "landing" && ctaPrincipal.id) {
      const { data } = await supabase
        .from("smartops_form_landing_pages")
        .select("id, hero_image_url, content, status, form_id")
        .eq("id", ctaPrincipal.id)
        .maybeSingle();
      if (!data) reason = "cta_id_not_found";
      else if (data.status !== "published") reason = `cta_status_${data.status}`;
      else row = data;
    }

    // Fallback: any published LP whose form belongs to this product.
    if (!row && produtoId) {
      const { data: forms } = await supabase
        .from("smartops_forms").select("id").eq("product_catalog_id", produtoId);
      const ids = (forms || []).map((f: any) => f.id);
      if (!ids.length) {
        reason = reason || "no_forms_for_product";
      } else {
        const { data } = await supabase
          .from("smartops_form_landing_pages")
          .select("id, hero_image_url, content, status, form_id")
          .in("form_id", ids)
          .eq("status", "published")
          .limit(1);
        if (data && data[0]) row = data[0];
        else reason = reason || "no_published_lp_for_forms";
      }
    }

    if (!row || !row.content) {
      console.log("[generate-email-ai] loadLpDossier no row:", reason || "no_reason", {
        cta_id: ctaPrincipal?.id, cta_tipo: ctaPrincipal?.tipo, produto_id: produtoId,
      });
      return null;
    }
    console.log("[generate-email-ai] LP row loaded:", row.id, "hero:", row.hero_image_url ? "yes" : "no");
    const c = row.content as any;

    const parts = Array.isArray(c?.hero?.headlineParts)
      ? c.hero.headlineParts
          .map((p: any) => ({ text: cleanLpText(p?.text), highlight: !!p?.highlight }))
          .filter((p: any) => p.text)
      : undefined;

    const trustInline = Array.isArray(c?.hero?.trustInline)
      ? c.hero.trustInline.map((t: any) => cleanLpText(t?.label)).filter(Boolean)
      : undefined;

    const bullets = Array.isArray(c?.hero?.bullets)
      ? c.hero.bullets.map(cleanLpText).filter(Boolean).slice(0, 5)
      : undefined;

    // Section 3 — Condições. Aggregate all condition cards from the LP.
    const conditionCards = Array.isArray(c?.conditions?.cards)
      ? c.conditions.cards
          .map((card: any) => ({
            title: cleanLpText(card?.title),
            ribbon: cleanLpText(card?.ribbon),
            includes: Array.isArray(card?.includes)
              ? card.includes.map((s: any) => cleanPriceHeavyText(s)).filter(Boolean).slice(0, 6)
              : [],
            footnote: cleanPriceHeavyText(card?.footnote),
          }))
          .filter((x: any) => x.title || (x.includes && x.includes.length))
          .slice(0, 3)
      : [];
    // Fallback: use top-level price.includes as a single "Condições" card if no cards[]
    if (!conditionCards.length && Array.isArray(c?.price?.includes) && c.price.includes.length) {
      conditionCards.push({
        title: cleanLpText(c?.price?.title) || "Condições",
        ribbon: cleanLpText(c?.price?.ribbon),
        includes: c.price.includes.map((s: any) => cleanPriceHeavyText(s)).filter(Boolean).slice(0, 8),
        footnote: cleanPriceHeavyText(c?.price?.footnote),
      });
    }
    const conditions = conditionCards.length
      ? {
          title: cleanLpText(c?.conditions?.title) || cleanLpText(c?.price?.title) || "Condições",
          subtitle: cleanPriceHeavyText(c?.conditions?.subtitle) || cleanPriceHeavyText(c?.price?.priceNote),
          items: conditionCards,
        }
      : undefined;

    const trustBar = Array.isArray(c?.trustBar)
      ? c.trustBar.map(cleanLpText).filter(Boolean).slice(0, 4)
      : undefined;

    const theme = typeof c?.theme === "string" && c.theme in LP_THEMES ? c.theme as LPThemeKey : "exocad-purple";

    return {
      hero_image_url: row.hero_image_url || null,
      logo_url: c?.logoUrl || null,
      theme,
      brand_name: cleanLpText(c?.brandName) || "Smart Dent",
      reseller_badge: cleanLpText(c?.resellerBadge),
      nav_cta: cleanLpText(c?.nav?.cta),
      hero: {
        eyebrow: cleanLpText(c?.hero?.eyebrow),
        badge: cleanLpText(c?.hero?.badge),
        headline_parts: parts,
        headline: cleanLpText(c?.hero?.headline),
        sub: cleanLpText(c?.hero?.sub),
        bullets,
        trust: trustInline,
        primary_cta: cleanLpText(c?.hero?.primaryCta),
        secondary_cta: cleanLpText(c?.hero?.secondaryCta),
        product_card_caption: cleanLpText(c?.hero?.productCardCaption),
      },
      positioning: c?.positioning ? {
        eyebrow: cleanLpText(c.positioning.eyebrow),
        headline: cleanPriceHeavyText(c.positioning.headline) || "DentalCAD Ultimate Lab Bundle com ativação, implantação, treinamento e suporte Smart Dent.",
        body: cleanPriceHeavyText(c.positioning.body) || "Uma oportunidade para estruturar o fluxo CAD com licença oficial, configuração orientada e acompanhamento especializado.",
      } : undefined,
      conditions,
      final_cta: c?.finalCta ? {
        headline: cleanLpText(c.finalCta.headline),
        sub: cleanLpText(c.finalCta.sub),
        cta: cleanLpText(c.finalCta.cta),
      } : undefined,
      trust_bar: trustBar,
    };
  } catch (e) {
    console.warn("[generate-email-ai] loadLpDossier failed:", e);
    return null;
  }
}

// ── Deterministic Gmail-safe clone of PremiumLandingTemplate ──
function buildLpEmailHtml(opts: {
  subject: string;
  preheader: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  brandName?: string;
  theme?: LPThemeKey;
  eyebrow?: string;
  badge?: string;
  headlineHtml: string;             // may include <span class="hl">…</span>
  sub?: string;
  bullets?: string[];
  trust?: string[];
  positioning?: { eyebrow?: string; headline?: string; body?: string };
  conditions?: LPDossier["conditions"];
  finalCta?: { headline?: string; sub?: string; cta?: string };
  ctaPrimary: { label: string; url: string };
  ctaSecondary?: { label: string; url: string } | null;
  resellerBadge?: string;
}): string {
  const {
    preheader, heroImageUrl, logoUrl, brandName = "Smart Dent", theme, eyebrow, badge,
    headlineHtml, sub, bullets, trust, positioning, conditions,
    finalCta, ctaPrimary, ctaSecondary, resellerBadge,
  } = opts;

  const t = getTheme(theme);
  const grad = `linear-gradient(135deg, ${t.brand} 0%, ${t.brand2} 100%)`;
  const softGrad = `linear-gradient(180deg, ${t.bgSoft} 0%, ${t.soft} 100%)`;

  const hl = (h: string) => h.replace(
    /<span class="hl">([\s\S]*?)<\/span>/g,
    `<span style="color:${t.brand};">$1</span>`,
  );

  const pill = (txt: string) => `<span style="display:inline-block;border:1px solid ${t.orange}33;background:#ffffffcc;border-radius:999px;padding:7px 14px;font-family:Inter,Arial,sans-serif;font-size:11px;line-height:1;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${t.orange};">${esc(txt)}</span>`;

  const primaryButton = (label: string, url: string) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 10px 10px 0;vertical-align:top;">
      <tr><td bgcolor="${t.brand}" style="border-radius:999px;background:${t.brand};background:${grad};box-shadow:0 12px 28px rgba(96,88,130,0.24);">
        <a href="${esc(url)}" style="display:inline-block;padding:15px 24px;font-family:Inter,Arial,sans-serif;font-weight:800;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(label)} &nbsp;→</a>
      </td></tr>
    </table>`;

  const secondaryButton = ctaSecondary ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 0 10px 0;vertical-align:top;">
      <tr><td bgcolor="#ffffff" style="border-radius:999px;background:#ffffff;border:1px solid ${t.border};">
        <a href="${esc(ctaSecondary.url)}" style="display:inline-block;padding:14px 22px;font-family:Inter,Arial,sans-serif;font-weight:800;font-size:13px;line-height:18px;color:${t.brand};text-decoration:none;border-radius:999px;">${esc(ctaSecondary.label)}</a>
      </td></tr>
    </table>` : "";

  const bulletsHtml = (bullets && bullets.length)
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 4px 0;">${
        bullets.map(b => `
          <tr><td valign="top" style="padding:6px 0;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:${t.textSoft};">
            <span style="display:inline-block;width:8px;height:8px;background:${t.orange};border-radius:50%;margin-right:10px;vertical-align:middle;"></span>${esc(b)}
          </td></tr>`).join("")
      }</table>`
    : "";

  const trustHtml = (trust && trust.length)
    ? `<div style="margin:14px 0 0 0;font-family:Inter,Arial,sans-serif;font-size:12px;color:${t.textSoft};">
         ${trust.map(item => `<span style="display:inline-block;margin:0 14px 6px 0;"><span style="color:${t.brand};font-weight:900;">✓</span> ${esc(item)}</span>`).join("")}
       </div>`
    : "";

  // (Section 3) Condições — renderiza os cards da LP (sem preços)
  const conditionsHtml = (conditions && conditions.items && conditions.items.length)
    ? `<tr><td style="padding:34px 28px 8px 28px;background:#ffffff;">
         ${conditions.title ? `<h2 style="margin:0 0 8px 0;text-align:center;font-family:Arial Black,Inter,Arial,sans-serif;font-size:28px;line-height:1.15;color:${t.text};letter-spacing:0;">${esc(conditions.title)}</h2>` : ""}
         ${conditions.subtitle ? `<p style="margin:0 auto 22px auto;max-width:520px;text-align:center;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.55;color:${t.textSoft};">${esc(conditions.subtitle)}</p>` : ""}
         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
           ${conditions.items.map((card) => `
             <tr><td valign="top" style="padding:0 0 14px 0;">
               <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${t.bgSoft};border:1px solid ${t.border};border-radius:18px;">
                 <tr><td style="padding:22px 22px;">
                   ${card.ribbon ? `<div style="display:inline-block;font-family:Inter,Arial,sans-serif;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:${t.orange};font-weight:900;background:${t.orangeSoft};border-radius:999px;padding:5px 10px;margin-bottom:10px;">${esc(card.ribbon)}</div>` : ""}
                   ${card.title ? `<div style="font-family:Arial Black,Inter,Arial,sans-serif;font-weight:900;font-size:19px;line-height:1.2;color:${t.text};margin-bottom:12px;">${esc(card.title)}</div>` : ""}
                   ${card.includes && card.includes.length ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${card.includes.map((it) => `
                     <tr><td valign="top" style="padding:5px 0;font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.55;color:${t.textSoft};">
                       <span style="display:inline-block;width:7px;height:7px;background:${t.orange};border-radius:50%;margin-right:10px;vertical-align:middle;"></span>${esc(it)}
                     </td></tr>`).join("")}</table>` : ""}
                   ${card.footnote ? `<div style="margin-top:12px;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.5;color:${t.textSoft};font-style:italic;">${esc(card.footnote)}</div>` : ""}
                 </td></tr>
               </table>
             </td></tr>`).join("")}
         </table>
       </td></tr>`
    : "";

  const positioningHtml = positioning && (positioning.headline || positioning.body)
    ? `<tr><td style="padding:28px 28px 0 28px;background:#ffffff;">
         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,#ffffff 0%,${t.orangeSoft} 100%);border:1px solid ${t.orange}33;border-radius:24px;box-shadow:0 18px 44px rgba(96,88,130,0.10);">
           <tr>
             <td width="72" valign="top" style="padding:28px 0 28px 28px;">
               <div style="width:56px;height:56px;border-radius:18px;background:${t.orange};font-family:Arial,sans-serif;font-weight:900;font-size:24px;line-height:56px;text-align:center;color:#ffffff;">↗</div>
             </td>
             <td valign="top" style="padding:28px 28px 28px 18px;">
               ${positioning.eyebrow ? `<div style="font-family:Inter,Arial,sans-serif;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:${t.orange};font-weight:900;margin-bottom:9px;">${esc(positioning.eyebrow)}</div>` : ""}
               ${positioning.headline ? `<div style="font-family:Arial Black,Inter,Arial,sans-serif;font-weight:900;font-size:25px;line-height:1.18;color:${t.text};margin-bottom:10px;letter-spacing:0;">${esc(positioning.headline)}</div>` : ""}
               ${positioning.body ? `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.62;color:${t.textSoft};">${esc(positioning.body)}</div>` : ""}
             </td>
           </tr>
         </table>
       </td></tr>`
    : "";

  const heroImgHtml = heroImageUrl
    ? `<img src="${esc(heroImageUrl)}" alt="Produto" width="300" style="display:block;width:100%;max-width:300px;height:auto;border-radius:18px;box-shadow:0 28px 60px rgba(66,73,92,0.18);" />`
    : "";

  const resellerHtml = resellerBadge
    ? `<span style="display:inline-block;font-family:Inter,Arial,sans-serif;font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:${t.orange};font-weight:900;background:${t.orangeSoft};border:1px solid ${t.orange}33;border-radius:999px;padding:6px 10px;vertical-align:middle;">${esc(resellerBadge)}</span>`
    : "";

  const finalCtaHtml = `
    <tr><td style="padding:34px 28px;background:#ffffff;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${t.brand};background:${grad};border-radius:24px;">
        <tr><td align="center" style="padding:34px 28px;">
          <div style="font-family:Arial Black,Inter,Arial,sans-serif;font-size:28px;line-height:1.15;color:#ffffff;letter-spacing:0;margin-bottom:10px;">${esc(finalCta?.headline || opts.subject || "Ative seu fluxo digital")}</div>
          ${finalCta?.sub ? `<div style="max-width:500px;margin:0 auto 22px auto;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#ffffff;opacity:.92;">${esc(finalCta.sub)}</div>` : ""}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr><td bgcolor="#ffffff" style="border-radius:999px;background:#ffffff;">
              <a href="${esc(ctaPrimary.url)}" style="display:inline-block;padding:15px 25px;font-family:Inter,Arial,sans-serif;font-weight:900;font-size:14px;line-height:18px;color:${t.brand};text-decoration:none;border-radius:999px;">${esc(finalCta?.cta || ctaPrimary.label)} &nbsp;→</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>`;

  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(opts.subject)}</title>
<style>
@media only screen and (max-width: 640px) {
  .lp-shell { width: 100% !important; }
  .lp-hero-col { display:block !important; width:100% !important; }
  .lp-hero-copy { padding-right:0 !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:${t.soft};font-family:Inter,Arial,sans-serif;color:${t.text};">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${esc(preheader)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${t.soft};">
    <tr><td align="center" style="padding:0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="680" class="lp-shell" style="width:680px;max-width:680px;background:#ffffff;overflow:hidden;">
        <tr><td style="padding:18px 28px;background:#ffffff;border-bottom:1px solid ${t.border};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="font-family:Inter,Arial,sans-serif;font-weight:900;font-size:16px;color:${t.text};">
                ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(brandName)}" height="28" style="display:block;max-height:28px;width:auto;" />` : `${esc(brandName)} <span style="color:${t.brand};">| Fluxo Digital</span>`}
              </td>
              <td align="right" style="white-space:nowrap;">${resellerHtml}</td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:52px 28px 44px 28px;background:${t.bgSoft};background:${softGrad};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td class="lp-hero-col lp-hero-copy" valign="middle" width="55%" style="padding-right:24px;">
                ${badge ? pill(badge) : ""}
                ${eyebrow ? `<div style="margin-top:18px;font-family:Inter,Arial,sans-serif;font-size:12px;letter-spacing:1.9px;text-transform:uppercase;color:${t.orange};font-weight:900;">${esc(eyebrow)}</div>` : ""}
                <h1 style="margin:18px 0 0 0;font-family:Arial Black,Inter,Arial,sans-serif;font-size:42px;line-height:1.05;color:${t.text};letter-spacing:0;font-weight:900;">${hl(headlineHtml)}</h1>
                ${sub ? `<p style="margin:22px 0 0 0;font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.62;color:${t.textSoft};">${esc(sub)}</p>` : ""}
                <div style="margin:22px 0 0 0;">${primaryButton(ctaPrimary.label, ctaPrimary.url)}${secondaryButton}</div>
                ${trustHtml || bulletsHtml}
              </td>
              <td class="lp-hero-col" valign="middle" width="45%" align="center" style="padding-top:8px;">
                ${heroImgHtml || `<div style="width:100%;max-width:300px;height:210px;border-radius:18px;background:${t.soft};border:1px solid ${t.border};"></div>`}
                ${(resellerBadge || opts.brandName) ? `<div style="display:inline-block;margin-top:-18px;background:#ffffff;border-radius:999px;padding:10px 16px;border:1px solid ${t.border};box-shadow:0 18px 40px rgba(66,73,92,.12);font-family:Inter,Arial,sans-serif;font-weight:900;font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:${t.orange};">${esc(resellerBadge || opts.brandName || "Smart Dent")}</div>` : ""}
              </td>
            </tr>
          </table>
        </td></tr>

        ${positioningHtml}
        ${conditionsHtml}
        ${finalCtaHtml}

        <tr><td style="padding:0 28px 28px 28px;background:#ffffff;">
          <div style="border-top:1px solid ${t.border};padding-top:18px;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.55;color:${t.textSoft};text-align:center;">
            Enviado por <strong style="color:${t.text};">Smart Dent | Fluxo Digital</strong> para {{nome}}.<br/>
            Consultoria e revenda oficial em odontologia digital.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: Body = await req.json();
    const {
      produto, produto_id, cta_principal, ctas_secundarios = [],
      segmento_resumo, tom = "consultivo",
      regenerate = "all", base_html,
      use_landing_page = true,
    } = body;

    // Preset tone expansions → concrete writing guidance for the LLM
    const TOM_PRESETS: Record<string, string> = {
      consultivo: "Consultivo, profissional, direto ao ponto. Orienta o dentista/laboratório sem pressionar. Foco em ajudar a decidir.",
      tecnico: "Técnico especialista. Vocabulário odontológico preciso (fluxo digital, CAD/CAM, ISO, precisão em µm). Zero hype, dados objetivos.",
      educativo: "Educativo e didático. Ensina antes de vender. Referencia casos clínicos, artigos e boas práticas.",
      direto_comercial: "Direto e comercial, para leads quentes. Foco em benefício concreto e próximo passo claro. Frases curtas.",
      storytelling: "Storytelling clínico. Conta a jornada de um profissional que adotou o produto e o resultado obtido. Emoção controlada.",
      urgencia_soft: "Urgência suave, sem gatilhos agressivos. Comunica escassez real (vagas, prazo) com respeito.",
      celebrativo: "Celebrativo e otimista. Lançamento, marco, novidade. Tom de compartilhamento de conquista.",
      reativacao_amigavel: "Reativação amigável e leve. Reconecta com o lead frio sem cobrar. Reconhece o tempo sem contato.",
      pos_venda_cs: "Pós-venda / customer success. Acolhedor, orientador, foco em fazer o cliente usar bem o produto que já tem.",
      evento_convite: "Convite para evento (curso, webinar, feira). Datas, benefícios da participação, call-to-action de inscrição.",
    };
    const tomInstruction = TOM_PRESETS[tom] || tom;

    // ── Product context (REAL columns from system_a_catalog) ──
    let produtoCtx: Record<string, any> | null = null;
    const PRODUCT_COLS =
      "id, name, description, image_url, product_category, product_subcategory, " +
      "technical_specs, clinical_indications, contraindications, compatibility_list, " +
      "certifications, cta_1_label, cta_1_url, cta_1_description, keywords, category";
    if (produto_id) {
      const { data } = await supabase
        .from("system_a_catalog")
        .select(PRODUCT_COLS)
        .eq("id", produto_id).maybeSingle();
      produtoCtx = data as any;
    } else if (produto) {
      const { data } = await supabase
        .from("system_a_catalog")
        .select(PRODUCT_COLS)
        .ilike("name", `%${produto}%`).limit(1).maybeSingle();
      produtoCtx = data as any;
    }

    // Technical specs as bullets
    const techSpecs = produtoCtx?.technical_specs;
    let techBullets = "-";
    if (techSpecs && typeof techSpecs === "object") {
      techBullets = Object.entries(techSpecs)
        .slice(0, 6)
        .map(([k, v]) => `• ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
        .join("\n");
    } else if (typeof techSpecs === "string") {
      techBullets = techSpecs.slice(0, 400);
    }

    const ctaLabel = (c?: CtaRef) => c?.label || ({
      landing: "Acessar landing page do produto",
      form: "Preencher formulário do produto",
      custom: "Saiba mais",
    } as Record<string, string>)[c?.tipo || "custom"];

    const ctaLine = (c: CtaRef) => `- [${c.tipo}] ${ctaLabel(c)} → ${c.url || "{{url}}"}`;

    const allowedUrls = [cta_principal?.url, ...(ctas_secundarios || []).map(c => c.url)]
      .filter((u): u is string => !!u);

    // ── Load Landing Page dossier (primary copy + visual source of truth) ──
    const lp = use_landing_page ? await loadLpDossier(supabase, cta_principal, produto_id) : null;
    console.log("[generate-email-ai] LP branch selected:", lp ? "YES" : "NO",
      "regenerate=", regenerate, "cta_url=", cta_principal?.url ? "yes" : "no");

    // Helper: build the branded email using LP content verbatim (no LLM copy).
    const buildVerbatim = (lpData: LPDossier, subj: string) => {
      const heroImage = lpData.hero_image_url || (produtoCtx?.image_url as string | undefined) || null;
      const headlineVerbatim = lpData.hero.headline_parts?.length
        ? lpData.hero.headline_parts.map(p =>
            p.highlight ? `<span class="hl">${esc(p.text)}</span>` : esc(p.text)
          ).join("")
        : esc(lpData.hero.headline || produtoCtx?.name || "Smart Dent");
      const secondary = (ctas_secundarios || []).find(c => !!c.url) || null;
      return buildLpEmailHtml({
        subject: subj,
        preheader: stripPrices(lpData.hero.sub || ""),
        heroImageUrl: heroImage,
        logoUrl: lpData.logo_url || null,
        brandName: lpData.brand_name || "Smart Dent",
        theme: lpData.theme,
        badge: lpData.hero.badge || "",
        eyebrow: lpData.hero.eyebrow || "",
        headlineHtml: headlineVerbatim,
        sub: stripPrices(lpData.hero.sub || ""),
        bullets: (lpData.hero.bullets || []).map(b => stripPrices(b)),
        trust: lpData.hero.trust || [],
        positioning: lpData.positioning ? {
          eyebrow: lpData.positioning.eyebrow,
          headline: stripPrices(lpData.positioning.headline || ""),
          body: stripPrices(lpData.positioning.body || ""),
        } : undefined,
        howItWorks: (lpData.how_it_works || []).map(h => ({
          title: stripPrices(h.title), desc: stripPrices(h.desc),
        })),
        howTitle: lpData.how_title,
        benefits: lpData.benefits,
        modules: lpData.modules,
        implementation: lpData.implementation,
        finalCta: lpData.final_cta,
        ctaPrimary: { label: lpData.hero.primary_cta || lpData.nav_cta || ctaLabel(cta_principal!), url: cta_principal!.url! },
        ctaSecondary: secondary ? { label: lpData.hero.secondary_cta || ctaLabel(secondary) || "Ver detalhes", url: secondary.url! } : null,
        resellerBadge: lpData.reseller_badge,
      });
    };

    // If we have an LP, take the deterministic-assembly path:
    // ask the LLM ONLY for the copy fields, then render the branded skeleton server-side.
    // If the LLM fails, we DO NOT fall back to the legacy prompt — we render the LP verbatim
    // so the email always keeps the LP visual identity.
    if (lp && cta_principal?.url && regenerate === "all") {
      const heroImage = lp.hero_image_url || (produtoCtx?.image_url as string | undefined) || null;
      console.log("[generate-email-ai] LP branch selected id=", (lp as any).id || "?", "hero_image=", heroImage || "none");

      const lpBrief = {
        hero: {
          eyebrow: lp.hero.eyebrow || "",
          headline: lp.hero.headline_parts?.map(p => (p.highlight ? `«${p.text}»` : p.text)).join("").trim() || lp.hero.headline || "",
          sub: lp.hero.sub || "",
          bullets: lp.hero.bullets || [],
          trust: lp.hero.trust || [],
        },
        positioning: lp.positioning || null,
        howItWorks: lp.how_it_works || [],
        benefits: lp.benefits?.items || [],
        modules: lp.modules?.items || [],
        implementation: lp.implementation || null,
      };

      const copySystem = `Você é copywriter sênior da Smart Dent | Fluxo Digital. Reescreve a copy da LANDING PAGE do produto para um e-mail, aplicando o TOM escolhido, sem inventar nada além do que está no dossiê da LP.

REGRAS ABSOLUTAS:
- NUNCA cite preços, valores em R$, descontos numéricos ou promoções com valor. NUNCA cite "assinatura mensal de R$…", "de R$… por R$…".
- Preserve o significado e o posicionamento originais da LP. Reescreva no TOM: ${tomInstruction}
- Português do Brasil. Sem emojis exagerados (máx 1 no assunto).
- Headline: mantenha a intenção da headline da LP. Se a LP marcou parte com «…», envolva a MESMA ideia com <span class="hl">…</span> no seu HTML (será renderizada com gradiente roxo→laranja no e-mail).
- Bullets: 3-5 no máximo, curtos (máx 90 chars), sem valores monetários.
- Positioning body: máx 260 chars, sem preços.
- How it works: até 3 passos, título curto (máx 32 chars) e desc (máx 140 chars).

SAÍDA: apenas JSON válido, sem markdown, sem texto extra, com este schema:
{
  "subject": string (máx 70 chars),
  "preheader": string (máx 110 chars),
  "cta_button_label": string (máx 32 chars),
  "eyebrow": string (máx 40 chars, uppercase-friendly),
  "headline_html": string (uma linha, pode conter <span class="hl">trecho destacado</span>, sem outras tags),
  "sub": string (máx 220 chars),
  "bullets": string[] (3-5 itens),
  "positioning": { "eyebrow": string, "headline": string, "body": string } | null,
  "how_it_works": [{ "title": string, "desc": string }] (0 a 3),
  "plain_text": string (versão texto puro do email, com CTA no final)
}`;

      const copyUser = `═══ DOSSIÊ DA LANDING PAGE (fonte primária) ═══
Produto: ${produtoCtx?.name || produto || "produto Smart Dent"}
Marca/badge: ${lp.reseller_badge || "-"}
Imagem hero disponível no e-mail: ${heroImage || "(sem imagem)"}

Hero:
- Eyebrow LP: ${lpBrief.hero.eyebrow || "-"}
- Headline LP: ${lpBrief.hero.headline || "-"}
- Sub LP: ${lpBrief.hero.sub || "-"}
- Bullets LP: ${(lpBrief.hero.bullets || []).map(b => `• ${b}`).join("\n") || "-"}
- Trust inline LP: ${(lpBrief.hero.trust || []).join(" · ") || "-"}

Positioning LP: ${lpBrief.positioning ? JSON.stringify(lpBrief.positioning) : "(nenhum)"}

How it works LP: ${(lpBrief.howItWorks || []).length ? JSON.stringify(lpBrief.howItWorks) : "(nenhum)"}

Benefícios LP (opcional para inspirar bullets se hero.bullets estiver vazio): ${(lpBrief.benefits || []).length ? JSON.stringify(lpBrief.benefits) : "(nenhum)"}
Módulos LP (não reescrever; layout renderiza direto da LP): ${(lpBrief.modules || []).length ? `${lpBrief.modules.length} módulos disponíveis` : "(nenhum)"}
Implantação/Suporte LP: ${lpBrief.implementation ? JSON.stringify(lpBrief.implementation).slice(0, 1200) : "(nenhum)"}

═══ AUDIÊNCIA ═══
${segmento_resumo || "leads da base Smart Dent"}

═══ CTA principal ═══
Rótulo sugerido (pode ser reescrito no tom): ${ctaLabel(cta_principal)}
Destino: ${cta_principal.url}

Gere o JSON agora. NÃO invente preços. NÃO invente seções.`;

      const copyRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: copySystem },
            { role: "user", content: copyUser },
          ],
          response_format: { type: "json_object" },
        }),
      });

      const doVerbatimReturn = (reason: string) => {
        console.warn("[generate-email-ai] fallback_to_lp_verbatim reason=", reason);
        const html = buildVerbatim(lp, produtoCtx?.name || produto || "Smart Dent");
        return new Response(JSON.stringify({
          success: true,
          subject: (produtoCtx?.name || "Smart Dent").slice(0, 90),
          preheader: stripPrices(lp.hero.sub || "").slice(0, 130),
          cta_button_label: ctaLabel(cta_principal!) || "Saiba mais",
          html_body: html,
          plain_text: "",
          produto_context: produtoCtx,
          source: "landing_page_verbatim",
          fallback_reason: reason,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      };

      if (!copyRes.ok) {
        const errTxt = await copyRes.text();
        console.error("[generate-email-ai/lp] gateway error", copyRes.status, errTxt);
        return doVerbatimReturn(`gateway_${copyRes.status}`);
      }
      {
        const aiJson = await copyRes.json();
        const content = aiJson.choices?.[0]?.message?.content || "{}";
        let parsed: any = {};
        try { parsed = JSON.parse(content); }
        catch { const m = content.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; }

        if (!parsed || !parsed.headline_html) {
          return doVerbatimReturn("empty_llm_json");
        }

        const bulletsClean = Array.isArray(parsed.bullets)
          ? parsed.bullets.map((b: any) => stripPrices(String(b))).filter(Boolean).slice(0, 5)
          : (lp.hero.bullets || []).map(b => stripPrices(b)).filter(Boolean).slice(0, 5);

        const howClean = Array.isArray(parsed.how_it_works)
          ? parsed.how_it_works
              .map((h: any) => ({ title: stripPrices(String(h?.title || "")), desc: stripPrices(String(h?.desc || "")) }))
              .filter((h: any) => h.title || h.desc)
              .slice(0, 3)
          : (lp.how_it_works || []).map(h => ({ title: stripPrices(h.title), desc: stripPrices(h.desc) })).filter(h => h.title || h.desc).slice(0, 3);

        const positioningClean = parsed.positioning && (parsed.positioning.headline || parsed.positioning.body)
          ? {
              eyebrow: stripPrices(String(parsed.positioning.eyebrow || "")),
              headline: stripPrices(String(parsed.positioning.headline || "")),
              body: stripPrices(String(parsed.positioning.body || "")),
            }
          : lp.positioning;

        const ctaBtnLabel = String(parsed.cta_button_label || ctaLabel(cta_principal) || "Saiba mais").slice(0, 40);

        const secondary = (ctas_secundarios || []).find(c => !!c.url) || null;

        // Sanitize headline_html: allow only <span class="hl">…</span>. Strip anything else.
        const rawHeadline = stripPrices(String(parsed.headline_html || lp.hero.headline || ""));
        const safeHeadline = rawHeadline
          .replace(/<(?!\/?span\b|\/?SPAN\b)[^>]*>/g, "")
          .replace(/<span(?![^>]*class=["']?hl)[^>]*>/gi, "");

        const html = buildLpEmailHtml({
          subject: String(parsed.subject || produtoCtx?.name || "Smart Dent"),
          preheader: stripPrices(String(parsed.preheader || "")),
          heroImageUrl: heroImage,
          logoUrl: lp.logo_url || null,
          brandName: lp.brand_name || "Smart Dent",
          theme: lp.theme,
          badge: lp.hero.badge || "",
          eyebrow: stripPrices(String(parsed.eyebrow || lp.hero.eyebrow || "")),
          headlineHtml: safeHeadline,
          sub: stripPrices(String(parsed.sub || lp.hero.sub || "")),
          bullets: bulletsClean,
          trust: lp.hero.trust || [],
          positioning: positioningClean,
          howTitle: lp.how_title,
          howItWorks: howClean,
          benefits: lp.benefits,
          modules: lp.modules,
          implementation: lp.implementation,
          finalCta: lp.final_cta,
          ctaPrimary: { label: ctaBtnLabel, url: cta_principal.url },
          ctaSecondary: secondary ? { label: lp.hero.secondary_cta || ctaLabel(secondary) || "Ver detalhes", url: secondary.url! } : null,
          resellerBadge: lp.reseller_badge,
        });

        console.log("[generate-email-ai] LP branch OK — source=landing_page_ai");
        return new Response(JSON.stringify({
          success: true,
          subject: String(parsed.subject || "").slice(0, 90),
          preheader: stripPrices(String(parsed.preheader || "")).slice(0, 130),
          cta_button_label: ctaBtnLabel,
          html_body: html,
          plain_text: stripPrices(String(parsed.plain_text || "")),
          produto_context: produtoCtx,
          source: "landing_page_ai",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const systemPrompt = `Você é um copywriter sênior da Smart Dent | Fluxo Digital, especializado em odontologia digital (impressão 3D, escaneamento, CAD/CAM). Escreve emails B2B para dentistas e laboratórios.

REGRAS ABSOLUTAS:
- NUNCA cite preços, valores em R$, descontos numéricos ou promoções com valor.
- Tom: ${tomInstruction}
- Português do Brasil, sem gírias, sem exagero, sem emojis em excesso (no máx. 1-2 no assunto).
- HTML DEVE ser um documento COMPLETO começando em \`<!doctype html><html><head><meta charset="UTF-8"></head><body ...>\` e terminando em \`</body></html>\`. Inline styles (Gmail/Outlook), largura máx 600px, fontes web-safe.
- NUNCA gere tags <table>, <tr> ou <td> soltas sem envolver em uma tabela completa e fechada corretamente. Se usar tabela para layout, feche todas as tags.
- Personalizar com placeholders: {{nome}} (primeiro nome do lead) e {{vendedor_nome}}. NUNCA use {{link_wa_vendedor}} nem qualquer outro placeholder.
- CTA principal como botão destacado. CTAs secundários como links no rodapé.
- OBRIGATÓRIO: use a imagem do produto (\`<img src="…" alt="…" style="max-width:100%;height:auto">\`) no topo, logo após a saudação.
- OBRIGATÓRIO: cite pelo menos 1 indicação clínica concreta E 1 spec técnica real do dossiê fornecido. NÃO invente números.
- PROIBIDO incluir depoimentos, citações de clientes, blocos em itálico com nome de dentista, "Dra. Joyce", "Cliente Smart Dent" ou qualquer prova social. O e-mail vai direto do dossiê ao CTA.
- Estrutura sugerida: preheader (invisível) → saudação → hero image do produto → hook (1 parágrafo) → 2-3 benefícios com bullets (usando as specs/indicações) → CTA botão (landing page do produto) → rodapé com o CTA secundário (formulário do produto) + assinatura Smart Dent.

REGRAS DE LINKS (CRÍTICAS — QUEBRAM O E-MAIL SE VIOLADAS):
- Todo \`<a href="...">\` do HTML DEVE usar EXATAMENTE uma das URLs listadas abaixo em "CALLS-TO-ACTION". Não invente URLs, não use encurtadores, não use utm.
- PROIBIDO qualquer link para: WhatsApp, wa.me, api.whatsapp.com, mailto:, telefone (tel:), redes sociais (instagram/facebook/youtube/linkedin/tiktok), base de conhecimento (/base-conhecimento/...), blog, ou qualquer outro domínio/rota.
- PROIBIDO escrever "Falar no WhatsApp", "Fale pelo WhatsApp", "WhatsApp do vendedor" ou variações. Não existe CTA de WhatsApp neste e-mail.
- URLs permitidas neste e-mail:\n${allowedUrls.map(u => `  • ${u}`).join("\n") || "  (nenhuma — abortar)"}

SAÍDA: apenas JSON válido, sem markdown, sem texto extra.`;

    const userPrompt = `═══ DOSSIÊ DO PRODUTO ═══
Nome: ${produtoCtx?.name || produto || "produto Smart Dent"}
Categoria: ${produtoCtx?.product_category || produtoCtx?.category || "-"} / ${produtoCtx?.product_subcategory || ""}
Descrição: ${produtoCtx?.description ? String(produtoCtx.description).slice(0, 800) : "-"}
Imagem hero (USAR NO HTML): ${produtoCtx?.image_url || "-"}

Especificações técnicas (usar 1 no email):
${techBullets}

Indicações clínicas:
${produtoCtx?.clinical_indications ? (Array.isArray(produtoCtx.clinical_indications) ? produtoCtx.clinical_indications.slice(0, 5).join("; ") : String(produtoCtx.clinical_indications).slice(0, 400)) : "-"}

Compatibilidade: ${produtoCtx?.compatibility_list ? (Array.isArray(produtoCtx.compatibility_list) ? produtoCtx.compatibility_list.slice(0, 5).join(", ") : String(produtoCtx.compatibility_list).slice(0, 200)) : "-"}
Certificações: ${produtoCtx?.certifications ? (Array.isArray(produtoCtx.certifications) ? produtoCtx.certifications.join(", ") : String(produtoCtx.certifications)) : "-"}

═══ AUDIÊNCIA ═══
Segmento de destino: ${segmento_resumo || "leads da base Smart Dent"}

═══ CALLS-TO-ACTION ═══
CTA principal:
${cta_principal ? ctaLine(cta_principal) : "- (nenhum)"}
CTAs secundários:
${(ctas_secundarios || []).map(ctaLine).join("\n") || "- (nenhum)"}

${regenerate === "subject"
  ? `Regere APENAS o assunto e preheader para o HTML abaixo, mantendo o restante:\n${base_html?.slice(0, 3000) || ""}`
  : "Gere o email completo agora."}

Retorne JSON no formato:
{
  "subject": "assunto curto (máx 70 chars), sem clickbait",
  "preheader": "pré-cabeçalho (máx 110 chars)",
  "cta_button_label": "texto do botão principal",
  "html_body": "<HTML completo do email, responsivo, com placeholders {{nome}} etc>",
  "plain_text": "versão texto puro do email"
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      console.error("[generate-email-ai] gateway error", aiRes.status, errTxt);
      return new Response(JSON.stringify({
        error: "AI gateway error",
        status: aiRes.status,
        detail: errTxt.slice(0, 500),
      }), { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: Record<string, string> = {};
    try { parsed = JSON.parse(content); }
    catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    // ── Server-side link sanitizer: replace any href not in the allow-list ──
    const fallbackUrl = cta_principal?.url || allowedUrls[0] || "";
    const allowedSet = new Set(allowedUrls);
    const sanitizeHtml = (h: string): string => {
      if (!h || !fallbackUrl) return h;
      // Strip any {{link_wa_vendedor}} placeholder leftovers
      h = h.replaceAll("{{link_wa_vendedor}}", fallbackUrl);
      // Rewrite disallowed hrefs
      h = h.replace(/href\s*=\s*"([^"]*)"/gi, (_m, url) =>
        `href="${allowedSet.has(url) ? url : fallbackUrl}"`
      );
      h = h.replace(/href\s*=\s*'([^']*)'/gi, (_m, url) =>
        `href='${allowedSet.has(url) ? url : fallbackUrl}'`
      );
      // Neutralize any residual "Falar no WhatsApp"-style text
      h = h.replace(/Falar\s+(no|agora\s+pelo|via)\s+WhatsApp/gi, ctaLabel(cta_principal));
      return h;
    };
    const sanitizedHtml = sanitizeHtml(parsed.html_body || "");
    const sanitizedText = (parsed.plain_text || "")
      .replaceAll("{{link_wa_vendedor}}", fallbackUrl)
      .replace(/Falar\s+(no|agora\s+pelo|via)\s+WhatsApp/gi, ctaLabel(cta_principal) || "");

    return new Response(JSON.stringify({
      success: true,
      subject: parsed.subject || "",
      preheader: parsed.preheader || "",
      cta_button_label: parsed.cta_button_label || ctaLabel(cta_principal) || "Saiba mais",
      html_body: sanitizedHtml,
      plain_text: sanitizedText,
      produto_context: produtoCtx,
      source: "catalog_dossier",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[generate-email-ai] error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});