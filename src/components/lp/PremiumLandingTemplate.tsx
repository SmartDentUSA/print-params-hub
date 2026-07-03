import { ReactNode, useEffect, useRef, useState } from "react";

/**
 * PremiumLandingTemplate — light, editorial Smart Dent landing.
 * Design fixed here (mirrors the reference LP: white/soft gradient background,
 * gradient purple→orange accents, sticky header, product-card hero, positioning
 * banner with strike-through anchor price). Content is variable via LPContent.
 */

export type BenefitIcon =
  | "licenca"
  | "computador"
  | "treinamento"
  | "cartao"
  | "suporte"
  | "brasil"
  | "modulos"
  | "shield"
  | "sparkles"
  | "rocket"
  | "clock";

export type TrustIcon = "shield" | "headphones" | "infinity" | "check" | "clock";

export type LPContent = {
  brandName?: string;
  logoUrl?: string;
  theme?: LPThemeKey;
  resellerBadge?: string;
  nav?: { items: { label: string; anchor?: string }[]; cta?: string };
  trustBar?: string[];
  hero: {
    badge?: string;
    eyebrow?: string;
    headline: string;
    headlineParts?: { text: string; highlight?: boolean }[];
    sub?: string;
    bullets?: string[];
    trustInline?: { icon: TrustIcon; label: string }[];
    pricePill?: { label: string; value: string; note?: string; noteStrong?: string };
    primaryCta: string;
    secondaryCta?: string;
    productCardCaption?: string;
    audio?: { url: string; label?: string };
  };
  positioning?: {
    eyebrow?: string;
    headline: string;
    strikePrice?: string;
    highlightPrice?: string;
    body?: string;
  };
  howItWorks?: { title?: string; items: { title: string; desc: string }[] };
  price?: {
    ribbon?: string;
    title: string;
    priceLabel?: string;
    priceNote?: string;
    includes: string[];
    cta: string;
    footnote?: string;
  };
  conditions?: {
    title?: string;
    subtitle?: string;
    cards: {
      ribbon?: string;
      title: string;
      priceLabel?: string;
      priceNote?: string;
      originalPrice?: string;
      includes: string[];
      cta: string;
      footnote?: string;
    }[];
  };
  modules?: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    items: { name: string; application: string }[];
    footnote?: string;
  };
  regionalRules?: {
    title?: string;
    intro?: string;
    items: string[];
    footnote?: string;
  };
  implementation?: {
    title?: string;
    subtitle?: string;
    activation?: { title: string; items: string[] };
    training?: { title: string; body: string };
    support?: { title: string; items: string[] };
  };
  benefits?: { title?: string; items: { icon: BenefitIcon; title: string; desc: string }[] };
  testimonials?: { title?: string; items: { quote: string; author: string; role?: string }[] };
  faq?: { title?: string; items: { q: string; a: string }[] };
  finalCta?: { headline: string; sub?: string; cta: string };
  legal?: string;
};

interface Props {
  content: LPContent;
  heroImageUrl?: string | null;
  onCta?: (source: string) => void;
}

// Design system tokens (spec: single strong purple + orange accent + navy text).
const GRADIENT_BRAND = `linear-gradient(135deg, var(--lp-brand) 0%, var(--lp-brand-2) 100%)`;
const GRADIENT_SOFT = `linear-gradient(180deg, var(--lp-bg-soft) 0%, var(--lp-soft) 100%)`;

// -------- Nav helpers --------
const KNOWN_SECTION_IDS = ["top", "como-funciona", "preco", "condicoes", "modulos", "beneficios", "faq", "contato"];

function normalizeLabel(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function resolveAnchor(label: string, anchor?: string): string {
  if (anchor) {
    const id = anchor.replace(/^#/, "");
    if (KNOWN_SECTION_IDS.includes(id)) return `#${id}`;
  }
  const key = normalizeLabel(label);
  if (/beneficio/.test(key)) return "#beneficios";
  if (/modulo|recurso|feature/.test(key)) return "#modulos";
  if (/como.*funciona|passo|etapa/.test(key)) return "#como-funciona";
  if (/investimento|preco|preço|plano|condic|valor/.test(key)) return "#condicoes";
  if (/duvida|faq|pergunta/.test(key)) return "#faq";
  if (/contato|fale|conosco/.test(key)) return "#contato";
  if (/produto|inicio|home|top/.test(key)) return "#top";
  return "#top";
}

function smoothScrollTo(hash: string) {
  if (typeof window === "undefined") return;
  const id = hash.replace(/^#/, "");
  const el = document.getElementById(id);
  if (!el) return;
  const headerOffset = 72;
  const top = el.getBoundingClientRect().top + window.pageYOffset - headerOffset;
  window.scrollTo({ top, behavior: "smooth" });
}

// -------- Price / discount helpers --------
function parsePriceNumber(raw?: string): number | null {
  if (!raw) return null;
  // strip currency and spaces, handle "R$ 3.500,00" or "R$ 2.399"
  const cleaned = raw.replace(/[^\d,.\-]/g, "");
  if (!cleaned) return null;
  // If both '.' and ',' — assume '.' thousands and ',' decimal (pt-BR)
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

function computeDiscount(original?: string, current?: string): { savings: string; percent: number } | null {
  const o = parsePriceNumber(original);
  const c = parsePriceNumber(current);
  if (!o || !c || o <= c) return null;
  const savings = o - c;
  const percent = Math.round((savings / o) * 100);
  return { savings: formatBRL(savings), percent };
}

// -------- Paletas selecionáveis no editor --------
export type LPThemeKey =
  | "exocad-purple"
  | "navy-gold"
  | "emerald-cream"
  | "coral-slate"
  | "charcoal-ember"
  | "ocean-deep";

export const LP_THEMES: Record<LPThemeKey, {
  label: string;
  swatch: string[];
  vars: {
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
}> = {
  "exocad-purple": {
    label: "Roxo exocad",
    swatch: ["#605882", "#DF7344", "#42495C", "#F3F0F8"],
    vars: {
      brand: "#605882", brandDark: "#4d466b", brand2: "#8B82A8",
      text: "#42495C", textSoft: "#5A5670", border: "#EFEBF4",
      soft: "#F3F0F8", bgSoft: "#FBFAFD", orange: "#DF7344", orangeSoft: "#FFF6F1",
    },
  },
  "navy-gold": {
    label: "Navy & Ouro",
    swatch: ["#1E3A5F", "#C9A84C", "#0F1B3D", "#E8EDF3"],
    vars: {
      brand: "#1E3A5F", brandDark: "#0F1B3D", brand2: "#3B6FA0",
      text: "#0F1B3D", textSoft: "#4A5A72", border: "#DCE3EE",
      soft: "#E8EDF3", bgSoft: "#F5F7FB", orange: "#C9A84C", orangeSoft: "#FBF6E4",
    },
  },
  "emerald-cream": {
    label: "Esmeralda & Creme",
    swatch: ["#0D7A5F", "#C9A84C", "#064E3B", "#E6F5EF"],
    vars: {
      brand: "#0D7A5F", brandDark: "#064E3B", brand2: "#10B981",
      text: "#064E3B", textSoft: "#3F6B5C", border: "#D4EBE0",
      soft: "#E6F5EF", bgSoft: "#F5FDF9", orange: "#C9A84C", orangeSoft: "#FBF6E4",
    },
  },
  "coral-slate": {
    label: "Coral & Ardósia",
    swatch: ["#574B90", "#FF6B6B", "#2D2D5F", "#F3EEF6"],
    vars: {
      brand: "#574B90", brandDark: "#3E356A", brand2: "#8A7EC4",
      text: "#2D2D5F", textSoft: "#605D80", border: "#E5DEEB",
      soft: "#F3EEF6", bgSoft: "#FBFAFF", orange: "#FF6B6B", orangeSoft: "#FFF0F0",
    },
  },
  "charcoal-ember": {
    label: "Grafite & Brasa",
    swatch: ["#2D2D2D", "#E85D3A", "#1A1A1A", "#EDECEB"],
    vars: {
      brand: "#2D2D2D", brandDark: "#1A1A1A", brand2: "#4A4A4A",
      text: "#1A1A1A", textSoft: "#525252", border: "#E5E4E3",
      soft: "#EDECEB", bgSoft: "#FAFAFA", orange: "#E85D3A", orangeSoft: "#FFF1EC",
    },
  },
  "ocean-deep": {
    label: "Oceano Profundo",
    swatch: ["#1A4A6E", "#5CBDB9", "#0C2340", "#DEEEF4"],
    vars: {
      brand: "#1A4A6E", brandDark: "#0C2340", brand2: "#2D8A9E",
      text: "#0C2340", textSoft: "#3F5A76", border: "#D0E1EC",
      soft: "#DEEEF4", bgSoft: "#F4F9FB", orange: "#5CBDB9", orangeSoft: "#E6F6F5",
    },
  },
};

function themeStyle(key?: LPThemeKey): Record<string, string> {
  const t = LP_THEMES[key ?? "exocad-purple"] ?? LP_THEMES["exocad-purple"];
  return {
    "--lp-brand": t.vars.brand,
    "--lp-brand-dark": t.vars.brandDark,
    "--lp-brand-2": t.vars.brand2,
    "--lp-text": t.vars.text,
    "--lp-text-soft": t.vars.textSoft,
    "--lp-border": t.vars.border,
    "--lp-soft": t.vars.soft,
    "--lp-bg-soft": t.vars.bgSoft,
    "--lp-orange": t.vars.orange,
    "--lp-orange-soft": t.vars.orangeSoft,
  } as Record<string, string>;
}

function TrustSvg({ name, className }: { name: TrustIcon; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: className ?? "w-4 h-4",
    "aria-hidden": true,
  };
  switch (name) {
    case "shield":
      return (
        <svg {...common}>
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "headphones":
      return (
        <svg {...common}>
          <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
        </svg>
      );
    case "infinity":
      return (
        <svg {...common}>
          <path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    case "check":
    default:
      return (
        <svg {...common}>
          <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
  }
}

function BenefitSvg({ name, className }: { name: BenefitIcon; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: className ?? "w-6 h-6",
    "aria-hidden": true,
  };
  switch (name) {
    case "licenca":
      return (<svg {...common}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" /><path d="M9 12l2 2 4-4" /></svg>);
    case "computador":
      return (<svg {...common}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>);
    case "treinamento":
      return (<svg {...common}><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5" /></svg>);
    case "cartao":
      return (<svg {...common}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 10h20" /></svg>);
    case "suporte":
      return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 016 0c0 2-3 3-3 5" /><circle cx="12" cy="17" r="0.5" fill="currentColor" /></svg>);
    case "brasil":
      return (<svg {...common}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20" /></svg>);
    case "modulos":
      return (<svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>);
    case "shield":
      return (<svg {...common}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" /></svg>);
    case "sparkles":
      return (<svg {...common}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" /><path d="M19 15l.7 2.1L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.9L19 15z" /></svg>);
    case "rocket":
      return (<svg {...common}><path d="M5 15c-1 3 0 5 0 5s2 1 5 0" /><path d="M9 12c0-6 6-10 12-10 0 6-4 12-10 12l-2-2z" /><circle cx="15" cy="8" r="1.5" /></svg>);
    case "clock":
      return (<svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>);
  }
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className ?? "w-4 h-4"} aria-hidden>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function PrimaryButton({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-form-cta="primary"
      className={`inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3.5 rounded-full text-white font-semibold text-base bg-[var(--lp-brand)] transition hover:bg-[var(--lp-brand-dark)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-brand)] focus-visible:ring-offset-2 ${className ?? ""}`}
      style={{ boxShadow: "0 10px 30px -10px color-mix(in oklab, var(--lp-brand) 60%, transparent)" }}
    >
      {children}
      <ArrowRight />
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-form-cta="secondary"
      className="inline-flex items-center justify-center min-h-12 px-6 py-3 rounded-full border border-[var(--lp-brand)]/30 bg-white text-[var(--lp-brand)] font-semibold text-sm hover:bg-[var(--lp-soft)] focus-visible:ring-2 focus-visible:ring-[var(--lp-brand)] transition"
    >
      {children}
    </button>
  );
}

function HeroProductCard({ src, caption }: { src?: string | null; caption?: string }) {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute inset-0 -z-10 rounded-[36px] blur-2xl opacity-40" style={{ background: GRADIENT_BRAND }} />
      {src ? (
        <img
          src={src}
          alt=""
          className="relative w-full rounded-[28px] border border-white/60"
          style={{ boxShadow: "0 30px 60px -20px color-mix(in oklab, var(--lp-brand) 35%, transparent)" }}
        />
      ) : (
        <div
          className="relative w-full aspect-[4/5] rounded-[28px] border border-white/60 overflow-hidden"
          style={{ background: "linear-gradient(160deg, var(--lp-brand) 0%, var(--lp-brand-2) 50%, var(--lp-brand) 100%)", boxShadow: "0 30px 60px -20px color-mix(in oklab, var(--lp-brand) 45%, transparent)" }}
        >
          <svg viewBox="0 0 400 500" className="absolute inset-0 w-full h-full opacity-90" aria-hidden>
            <defs>
              <radialGradient id="lpglow" cx="50%" cy="45%" r="55%">
                <stop offset="0%" stopColor="var(--lp-orange)" stopOpacity="0.5" />
                <stop offset="70%" stopColor="var(--lp-orange)" stopOpacity="0.05" />
                <stop offset="100%" stopColor="var(--lp-orange)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="200" cy="220" r="180" fill="url(#lpglow)" />
            {[70, 110, 150, 190].map((r) => (
              <circle key={r} cx="200" cy="230" r={r} stroke="white" strokeOpacity={0.1} fill="none" />
            ))}
            <g stroke="white" strokeOpacity="0.35" strokeWidth="1" fill="none">
              <path d="M80 260 Q200 120 320 260" />
              <path d="M100 285 Q200 155 300 285" />
              <path d="M120 310 Q200 190 280 310" />
            </g>
            {Array.from({ length: 14 }).map((_, i) => {
              const angle = (i / 14) * Math.PI;
              const x = 200 + Math.cos(angle) * 150;
              const y = 260 - Math.sin(angle) * 150;
              return <circle key={i} cx={x} cy={y} r="3" fill="var(--lp-orange)" />;
            })}
          </svg>
          <div className="absolute top-6 left-6 right-6 flex items-start justify-between text-white">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] opacity-70">RMS · Regional Monthly Subscription</div>
              <div className="mt-1 text-3xl font-black tracking-tight">exocad</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.22em] opacity-70">Smart Dent</div>
            </div>
          </div>
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--lp-orange)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider shadow-lg">
              Official Reseller
            </div>
            <div className="text-right text-sm font-black tracking-wider">ULTIMATE<br />LAB BUNDLE</div>
          </div>
        </div>
      )}
      {caption && (
        <div
          className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-white/60 bg-white/95 px-4 py-3 backdrop-blur-xl sm:flex items-center gap-2"
          style={{ boxShadow: "0 20px 40px -20px color-mix(in oklab, var(--lp-brand) 25%, transparent)" }}
        >
          <TrustSvg name="check" className="h-5 w-5 text-[var(--lp-orange)]" />
          <div className="text-xs font-bold text-[var(--lp-text)]">{caption}</div>
        </div>
      )}
    </div>
  );
}

function Headline({ hero }: { hero: LPContent["hero"] }) {
  const parts = hero.headlineParts && hero.headlineParts.length > 0 ? hero.headlineParts : null;
  return (
    <h1 className="mt-6 text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight text-[var(--lp-text)]">
      {parts
        ? parts.map((p, i) =>
            p.highlight ? (
              <span key={i} className="text-[var(--lp-brand)]">
                {p.text}
              </span>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )
        : hero.headline}
    </h1>
  );
}

export function PremiumLandingTemplate({ content, heroImageUrl, onCta }: Props) {
  const c = content;
  const cta = (source: string) => () => onCta?.(source);

  return (
    <div
      className="min-h-screen bg-white text-[var(--lp-text)] antialiased"
      style={{
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        ...themeStyle(c.theme),
      }}
    >
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/75 backdrop-blur-sm border-b border-[var(--lp-border)]/60">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 sm:px-8">
          <a
            href="#top"
            onClick={(e) => { e.preventDefault(); smoothScrollTo("#top"); }}
            className="flex min-w-0 items-center gap-3"
          >
            {c.logoUrl ? (
              <img
                src={c.logoUrl}
                alt={c.brandName ?? "Logo"}
                className="h-8 w-auto max-w-[160px] object-contain"
                loading="eager"
              />
            ) : (
              <span className="text-lg font-black tracking-tight text-[var(--lp-text)]">{c.brandName ?? "SMART DENT"}</span>
            )}
            {c.resellerBadge && (
              <span className="hidden shrink-0 rounded-full border border-[var(--lp-orange)]/30 bg-[var(--lp-orange)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--lp-orange)] sm:inline-flex">
                {c.resellerBadge}
              </span>
            )}
          </a>
          <div className="hidden items-center gap-6 md:flex">
            {(c.nav?.items ?? []).map((n, i) => {
              const target = resolveAnchor(n.label, n.anchor);
              return (
                <a
                  key={i}
                  href={target}
                  onClick={(e) => { e.preventDefault(); smoothScrollTo(target); }}
                  className="text-sm font-medium text-[var(--lp-text)] hover:text-[var(--lp-brand)] transition cursor-pointer"
                >
                  {n.label}
                </a>
              );
            })}
            <button
              type="button"
              onClick={cta("header")}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ background: GRADIENT_BRAND, boxShadow: "0 10px 25px -10px color-mix(in oklab, var(--lp-brand) 70%, transparent)" }}
            >
              {c.nav?.cta ?? c.hero.primaryCta}
              <ArrowRight />
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28" style={{ background: GRADIENT_SOFT }}>
        <div className="pointer-events-none absolute -top-32 -right-32 h-[520px] w-[520px] rounded-full opacity-30 blur-3xl" style={{ background: GRADIENT_BRAND }} />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl" style={{ background: GRADIENT_BRAND }} />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            {c.hero.badge && (
              <span
                className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-orange)]/30 bg-white/85 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--lp-orange)] backdrop-blur"
                style={{ boxShadow: "0 4px 16px -8px color-mix(in oklab, var(--lp-orange) 40%, transparent)" }}
              >
                <TrustSvg name="check" className="h-3.5 w-3.5" />
                {c.hero.badge}
              </span>
            )}
            {c.hero.eyebrow && (
              <p className="mt-4 text-[var(--lp-orange)] uppercase tracking-widest text-xs font-bold">{c.hero.eyebrow}</p>
            )}
            <Headline hero={c.hero} />
            {c.hero.sub && <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--lp-text-soft)]">{c.hero.sub}</p>}

            <div className="mt-7 flex flex-wrap gap-3">
              <PrimaryButton onClick={cta("hero-primary")}>{c.hero.primaryCta}</PrimaryButton>
              {c.hero.secondaryCta && <SecondaryButton onClick={cta("hero-secondary")}>{c.hero.secondaryCta}</SecondaryButton>}
            </div>

            {c.hero.trustInline && c.hero.trustInline.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[var(--lp-text-soft)]">
                {c.hero.trustInline.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <TrustSvg name={t.icon} className="h-4 w-4 text-[var(--lp-brand)]" />
                    {t.label}
                  </span>
                ))}
              </div>
            )}

            {(!c.hero.trustInline || c.hero.trustInline.length === 0) && c.hero.bullets && c.hero.bullets.length > 0 && (
              <ul className="mt-6 space-y-2">
                {c.hero.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[var(--lp-text-soft)] text-sm md:text-base">
                    <TrustSvg name="check" className="w-5 h-5 mt-0.5 shrink-0 text-[var(--lp-orange)]" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <HeroProductCard src={heroImageUrl} caption={c.hero.productCardCaption ?? c.resellerBadge} />
        </div>
      </section>

      {/* POSITIONING BANNER */}
      {c.positioning && (
        <section className="border-y border-[var(--lp-border)] bg-white py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div
              className="grid gap-8 rounded-3xl border border-[var(--lp-orange)]/20 p-8 sm:p-10 lg:grid-cols-[auto_1fr] lg:items-center"
              style={{ background: "linear-gradient(135deg, #FFFFFF 0%, var(--lp-orange-soft) 100%)", boxShadow: "0 20px 40px -20px color-mix(in oklab, var(--lp-brand) 25%, transparent)" }}
            >
              <div
                className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--lp-orange)] text-white"
                style={{ boxShadow: "0 15px 30px -10px color-mix(in oklab, var(--lp-orange) 60%, transparent)" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8" aria-hidden>
                  <path d="M16 17h6v-6" />
                  <path d="m22 17-8.5-8.5-5 5L2 7" />
                </svg>
              </div>
              <div>
                {c.positioning.eyebrow && (
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--lp-orange)]">
                    {c.positioning.eyebrow}
                  </div>
                )}
                <h3 className="mt-2 text-2xl sm:text-3xl font-black leading-tight text-[var(--lp-text)]">
                  {c.positioning.headline.split("{strike}").flatMap((chunk, i, arr) => {
                    const nodes: ReactNode[] = [<span key={`c-${i}`}>{chunk}</span>];
                    if (i < arr.length - 1 && c.positioning?.strikePrice) {
                      nodes.push(
                        <span key={`s-${i}`} className="text-[var(--lp-orange)] line-through decoration-2">
                          {c.positioning.strikePrice}
                        </span>,
                      );
                    }
                    return nodes;
                  })}
                  {c.positioning.highlightPrice && (
                    <>
                      {" "}
                      <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRADIENT_BRAND }}>
                        {c.positioning.highlightPrice}
                      </span>
                    </>
                  )}
                </h3>
                {c.positioning.body && <p className="mt-3 text-[var(--lp-text-soft)] leading-relaxed">{c.positioning.body}</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      {c.howItWorks && c.howItWorks.items.length > 0 && (
        <section id="como-funciona" className="py-20 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            {c.howItWorks.title && (
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center max-w-2xl mx-auto text-[var(--lp-text)]">
                {c.howItWorks.title}
              </h2>
            )}
            <div className="mt-12 grid md:grid-cols-3 gap-6">
              {c.howItWorks.items.map((step, i) => (
                <div key={i} className="relative rounded-2xl bg-[var(--lp-bg-soft)] p-8 hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-[var(--lp-border)]">
                  <div
                    className="w-11 h-11 rounded-xl text-white font-black flex items-center justify-center text-lg mb-5"
                    style={{ background: GRADIENT_BRAND }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-xl font-bold text-[var(--lp-text)] mb-2">{step.title}</h3>
                  <p className="text-[var(--lp-text-soft)] leading-relaxed text-sm">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PRICE CARD */}
      {c.price && (
        <section id="preco" className="py-20 md:py-24" style={{ background: GRADIENT_SOFT }}>
          <div className="max-w-3xl mx-auto px-6">
            <div
              className="rounded-3xl bg-white overflow-hidden border border-[var(--lp-border)]"
              style={{ boxShadow: "0 30px 80px -30px color-mix(in oklab, var(--lp-brand) 35%, transparent)" }}
            >
              {c.price.ribbon && (
                <div className="text-white text-center py-3.5" style={{ background: GRADIENT_BRAND }}>
                  <span className="uppercase tracking-[0.22em] font-black text-sm">{c.price.ribbon}</span>
                </div>
              )}
              <div className="p-8 md:p-12">
                <h2 className="text-3xl md:text-4xl font-black text-[var(--lp-text)] tracking-tight">{c.price.title}</h2>
                {c.price.priceLabel && (
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl md:text-5xl font-black bg-clip-text text-transparent" style={{ backgroundImage: GRADIENT_BRAND }}>
                      {c.price.priceLabel}
                    </span>
                    {c.price.priceNote && <span className="text-sm text-[var(--lp-text-soft)]">{c.price.priceNote}</span>}
                  </div>
                )}
                <ul className="mt-7 space-y-3.5">
                  {c.price.includes.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-[var(--lp-orange)]/10 flex items-center justify-center">
                        <TrustSvg name="check" className="w-3.5 h-3.5 text-[var(--lp-orange)]" />
                      </span>
                      <span className="text-[var(--lp-text)] leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-9">
                  <PrimaryButton onClick={cta("price-card")} className="w-full">
                    {c.price.cta}
                  </PrimaryButton>
                </div>
                {c.price.footnote && (
                  <p className="mt-5 text-xs text-[var(--lp-text-soft)] text-center">{c.price.footnote}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CONDITIONS */}
      {/* BENEFITS */}
      {c.benefits && c.benefits.items.length > 0 && (
        <section id="beneficios" className="py-20 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            {c.benefits.title && (
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center max-w-2xl mx-auto text-[var(--lp-text)]">
                {c.benefits.title}
              </h2>
            )}
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {c.benefits.items.map((b, i) => (
                <div
                  key={i}
                  className="group rounded-2xl bg-white border border-[var(--lp-border)] p-7 hover:border-[var(--lp-orange)]/40 hover:-translate-y-1 transition-all duration-300"
                  style={{ boxShadow: "0 10px 25px -20px color-mix(in oklab, var(--lp-brand) 25%, transparent)" }}
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--lp-orange)]/10 text-[var(--lp-orange)] flex items-center justify-center mb-5 group-hover:bg-[var(--lp-orange)] group-hover:text-white transition-colors">
                    <BenefitSvg name={b.icon} className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--lp-text)] mb-2">{b.title}</h3>
                  <p className="text-sm text-[var(--lp-text-soft)] leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MODULES — Ultimate Lab Bundle */}
      {c.modules && c.modules.items.length > 0 && (
        <section id="modulos" className="py-20 md:py-24 bg-[var(--lp-bg-soft)]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-3xl">
              {c.modules.eyebrow && (
                <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--lp-text-soft)]">
                  {c.modules.eyebrow}
                </div>
              )}
              {c.modules.title && (
                <h2 className="mt-3 text-3xl md:text-5xl font-black tracking-tight text-[var(--lp-text)] leading-[1.05]">
                  {c.modules.title}
                </h2>
              )}
              {c.modules.subtitle && (
                <p className="mt-4 text-[var(--lp-text-soft)] leading-relaxed">
                  {c.modules.subtitle}
                </p>
              )}
            </div>
            <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {c.modules.items.map((m, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white border border-[var(--lp-border)] p-5 hover:border-[var(--lp-orange)]/40 transition"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-[var(--lp-orange)]/10 flex items-center justify-center">
                      <TrustSvg name="check" className="w-3 h-3 text-[var(--lp-orange)]" />
                    </span>
                    <div>
                      <h3 className="text-sm md:text-base font-bold text-[var(--lp-text)] leading-tight">{m.name}</h3>
                      <p className="mt-1 text-xs md:text-sm text-[var(--lp-text-soft)] leading-relaxed">{m.application}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {c.modules.footnote && (
              <div className="mt-8 rounded-2xl border border-[var(--lp-border)] bg-white/60 px-5 py-4">
                <p className="text-xs text-[var(--lp-text-soft)] leading-relaxed">
                  {c.modules.footnote}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* REGIONAL RULES — Uso seguro e regular da licença */}
      {c.regionalRules && c.regionalRules.items.length > 0 && (
        <section id="uso-regular" className="py-20 md:py-24 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            <div
              className="rounded-3xl border border-[var(--lp-border)] bg-white p-8 md:p-10"
              style={{ boxShadow: "0 20px 60px -30px color-mix(in oklab, var(--lp-brand) 25%, transparent)" }}
            >
              <div className="flex items-start gap-4">
                <span
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
                  style={{ background: GRADIENT_BRAND }}
                >
                  <BenefitSvg name="shield" className="w-6 h-6" />
                </span>
                <div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-[var(--lp-text)]">
                    {c.regionalRules.title ?? "Uso seguro e regular da licença"}
                  </h2>
                  {c.regionalRules.intro && (
                    <p className="mt-3 text-[var(--lp-text-soft)] leading-relaxed">{c.regionalRules.intro}</p>
                  )}
                </div>
              </div>
              <ul className="mt-7 grid gap-3 md:grid-cols-2">
                {c.regionalRules.items.map((r, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl bg-[var(--lp-bg-soft)] p-4">
                    <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-[var(--lp-brand)]/10 flex items-center justify-center">
                      <TrustSvg name="check" className="w-3 h-3 text-[var(--lp-brand)]" />
                    </span>
                    <span className="text-sm leading-relaxed text-[var(--lp-text)]">{r}</span>
                  </li>
                ))}
              </ul>
              {c.regionalRules.footnote && (
                <p className="mt-6 text-xs text-[var(--lp-text-soft)] leading-relaxed">{c.regionalRules.footnote}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* IMPLEMENTATION — Implantação, ativação, treinamento e suporte */}
      {c.implementation && (
        <section id="implantacao" className="py-20 md:py-24" style={{ background: GRADIENT_SOFT }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--lp-text)]">
                {c.implementation.title ?? "Implantação, ativação, treinamento e suporte"}
              </h2>
              {c.implementation.subtitle && (
                <p className="mt-4 text-[var(--lp-text-soft)] leading-relaxed">{c.implementation.subtitle}</p>
              )}
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {c.implementation.activation && (
                <div className="rounded-2xl bg-white border border-[var(--lp-border)] p-6">
                  <div className="w-11 h-11 rounded-xl bg-[var(--lp-orange)]/10 text-[var(--lp-orange)] flex items-center justify-center mb-4">
                    <BenefitSvg name="rocket" className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--lp-text)]">{c.implementation.activation.title}</h3>
                  <ul className="mt-4 space-y-2.5">
                    {c.implementation.activation.items.map((it, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--lp-text)] leading-relaxed">
                        <TrustSvg name="check" className="w-4 h-4 mt-0.5 shrink-0 text-[var(--lp-orange)]" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {c.implementation.training && (
                <div className="rounded-2xl bg-white border border-[var(--lp-border)] p-6">
                  <div className="w-11 h-11 rounded-xl bg-[var(--lp-brand)]/10 text-[var(--lp-brand)] flex items-center justify-center mb-4">
                    <BenefitSvg name="treinamento" className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--lp-text)]">{c.implementation.training.title}</h3>
                  <p className="mt-3 text-sm text-[var(--lp-text-soft)] leading-relaxed">{c.implementation.training.body}</p>
                </div>
              )}
              {c.implementation.support && (
                <div className="rounded-2xl bg-white border border-[var(--lp-border)] p-6">
                  <div className="w-11 h-11 rounded-xl bg-[var(--lp-orange)]/10 text-[var(--lp-orange)] flex items-center justify-center mb-4">
                    <BenefitSvg name="suporte" className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--lp-text)]">{c.implementation.support.title}</h3>
                  <ul className="mt-4 space-y-2.5">
                    {c.implementation.support.items.map((it, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--lp-text)] leading-relaxed">
                        <TrustSvg name="check" className="w-4 h-4 mt-0.5 shrink-0 text-[var(--lp-brand)]" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TESTIMONIALS */}
      {c.testimonials && c.testimonials.items.length > 0 && (
        <section className="py-20 md:py-24 bg-[var(--lp-bg-soft)]">
          <div className="max-w-6xl mx-auto px-6">
            {c.testimonials.title && (
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center max-w-2xl mx-auto text-[var(--lp-text)]">
                {c.testimonials.title}
              </h2>
            )}
            <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {c.testimonials.items.map((t, i) => (
                <figure key={i} className="rounded-2xl bg-white border border-[var(--lp-border)] p-7" style={{ boxShadow: "0 10px 25px -20px color-mix(in oklab, var(--lp-brand) 15%, transparent)" }}>
                  <svg viewBox="0 0 24 24" fill="var(--lp-orange)" className="w-8 h-8 mb-3" aria-hidden>
                    <path d="M7 7h4v10H3V11c0-2.2 1.8-4 4-4zm10 0h4v10h-8V11c0-2.2 1.8-4 4-4z" />
                  </svg>
                  <blockquote className="text-[var(--lp-text)] leading-relaxed">"{t.quote}"</blockquote>
                  <figcaption className="mt-5 pt-4 border-t border-[var(--lp-border)]">
                    <div className="font-bold text-[var(--lp-text)]">{t.author}</div>
                    {t.role && <div className="text-xs text-[var(--lp-brand-2)]">{t.role}</div>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {c.conditions && (c.conditions.cards ?? []).length > 0 && (
        <section id="condicoes" className="py-20 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            {(c.conditions.title || c.conditions.subtitle) && (
              <div className="max-w-3xl mx-auto text-center">
                {c.conditions.title && (
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--lp-text)]">
                    {c.conditions.title}
                  </h2>
                )}
                {c.conditions.subtitle && (
                  <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--lp-text-soft)]">
                    {c.conditions.subtitle}
                  </p>
                )}
              </div>
            )}

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {(c.conditions.cards ?? []).slice(0, 3).map((card, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-[28px] border border-[var(--lp-border)] bg-white"
                  style={{ boxShadow: "0 24px 70px -34px color-mix(in oklab, var(--lp-brand) 45%, transparent)" }}
                >
                  <div className="px-6 py-3.5 text-center" style={{ background: GRADIENT_BRAND }}>
                    <span className="text-xs font-black uppercase tracking-[0.22em] text-white">
                      {card.ribbon || `Condição ${i + 1}`}
                    </span>
                  </div>
                  <div className="p-7 md:p-8">
                    <h3 className="text-2xl font-black leading-tight text-[var(--lp-text)]">{card.title}</h3>
                    {card.priceLabel && (() => {
                      const discount = computeDiscount(card.originalPrice, card.priceLabel);
                      return (
                        <div className="mt-5 space-y-1.5">
                          {card.originalPrice && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--lp-text-soft)]">De</span>
                              <span className="text-lg font-semibold text-[var(--lp-text-soft)] line-through decoration-[var(--lp-orange)]/70 decoration-2">
                                {card.originalPrice}
                              </span>
                            </div>
                          )}
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            {card.originalPrice && (
                              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--lp-brand)]">Por</span>
                            )}
                            <span className="text-4xl md:text-5xl font-black text-[var(--lp-brand)]">{card.priceLabel}</span>
                            {card.priceNote && <span className="text-sm text-[var(--lp-text-soft)]">{card.priceNote}</span>}
                          </div>
                          {discount && (
                            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--lp-orange)]/10 px-3 py-1 text-xs font-bold text-[var(--lp-orange)]">
                              <span>Economize {discount.savings}</span>
                              <span className="opacity-70">·</span>
                              <span>{discount.percent}% OFF</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <ul className="mt-7 space-y-3.5">
                      {card.includes.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start gap-3">
                          <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-[var(--lp-orange)]/10 flex items-center justify-center">
                            <TrustSvg name="check" className="w-3 h-3 text-[var(--lp-orange)]" />
                          </span>
                          <span className="text-sm leading-relaxed text-[var(--lp-text)]">{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-8">
                      <PrimaryButton onClick={cta(`condition-${i + 1}`)} className="w-full">
                        {card.cta}
                      </PrimaryButton>
                    </div>
                    {card.footnote && (
                      <p className="mt-5 text-center text-xs leading-relaxed text-[var(--lp-text-soft)]">{card.footnote}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {c.faq && c.faq.items.length > 0 && (
        <section id="faq" className="py-20 md:py-24 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center text-[var(--lp-text)]">
              {c.faq.title ?? "Perguntas frequentes"}
            </h2>
            <div className="mt-10 space-y-3">
              {c.faq.items.map((item, i) => (
                <details key={i} className="group rounded-2xl bg-[var(--lp-bg-soft)] hover:bg-white transition-colors overflow-hidden border border-[var(--lp-border)]">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 p-5 md:p-6 font-semibold text-[var(--lp-text)]">
                    <span>{item.q}</span>
                    <span className="shrink-0 w-8 h-8 rounded-full bg-white text-[var(--lp-orange)] flex items-center justify-center text-xl font-black group-open:rotate-45 transition-transform" aria-hidden>
                      +
                    </span>
                  </summary>
                  <div className="px-5 md:px-6 pb-5 md:pb-6 text-[var(--lp-text-soft)] leading-relaxed">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      {c.finalCta && (
        <section id="contato" className="relative py-20 md:py-24 overflow-hidden text-white" style={{ background: GRADIENT_BRAND }}>
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-white opacity-10 blur-3xl" aria-hidden />
          <div className="relative max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">{c.finalCta.headline}</h2>
            {c.finalCta.sub && <p className="mt-5 text-lg text-white/85">{c.finalCta.sub}</p>}
            <div className="mt-9 flex justify-center">
              <button
                type="button"
                onClick={cta("final")}
                data-form-cta="primary"
                className="inline-flex items-center gap-2 rounded-full bg-white text-[var(--lp-brand)] px-8 py-4 font-bold text-base hover:brightness-105 hover:-translate-y-0.5 transition"
                style={{ boxShadow: "0 20px 40px -15px rgba(0,0,0,0.25)" }}
              >
                {c.finalCta.cta}
                <ArrowRight />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="bg-white text-[var(--lp-brand-2)] text-xs border-t border-[var(--lp-border)]">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="font-semibold text-[var(--lp-text)]">{c.brandName ?? "Smart Dent | Fluxo Digital"}</div>
          <div className="text-center md:text-right leading-relaxed">
            {c.legal ?? "© Smart Dent. Todos os direitos reservados. exocad® é marca registrada de exocad GmbH."}
          </div>
        </div>
      </footer>

      {/* MOBILE STICKY CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 md:hidden bg-white/95 backdrop-blur-xl border-t border-[var(--lp-border)] p-3"
        style={{ boxShadow: "0 -12px 32px -8px color-mix(in oklab, var(--lp-brand) 20%, transparent)", paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <button
          type="button"
          onClick={cta("mobile-sticky")}
          data-form-cta="primary"
          className="w-full min-h-12 rounded-full text-white font-bold transition hover:brightness-110"
          style={{ background: GRADIENT_BRAND, boxShadow: "0 10px 25px -8px color-mix(in oklab, var(--lp-brand) 60%, transparent)" }}
        >
          {c.hero.primaryCta}
        </button>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
    </div>
  );
}

export const DEFAULT_LP_CONTENT: LPContent = {
  brandName: "SMART DENT",
  resellerBadge: "Official Reseller exocad",
  nav: {
    items: [
      { label: "Produto", anchor: "#top" },
      { label: "Módulos", anchor: "#modulos" },
      { label: "Como funciona", anchor: "#como-funciona" },
      { label: "Condições", anchor: "#condicoes" },
      { label: "FAQ", anchor: "#faq" },
    ],
    cta: "Assinar Agora",
  },
  hero: {
    badge: "Licença Oficial · RMS para o Brasil",
    eyebrow: "exocad no Brasil",
    headline: "O exocad mais completo agora cabe no fluxo de caixa do seu laboratório.",
    headlineParts: [
      { text: "O " },
      { text: "exocad mais completo", highlight: true },
      { text: " agora cabe no fluxo de caixa do seu laboratório." },
    ],
    sub: "Tenha o DentalCAD Ultimate Lab Bundle por assinatura mensal, com ativação, implantação, treinamento e suporte especializado da Smart Dent.",
    primaryCta: "Quero ativar meu exocad",
    secondaryCta: "Falar com Especialista",
    trustInline: [
      { icon: "shield", label: "Licença oficial" },
      { icon: "headphones", label: "Suporte em português" },
      { icon: "infinity", label: "Casos ilimitados" },
    ],
    productCardCaption: "Revenda Oficial exocad",
  },
  positioning: {
    eyebrow: "Menor barreira inicial da história do exocad no Brasil",
    headline: "Um pacote que antes ultrapassava {strike} em licença perpétua, agora começa com",
    strikePrice: "R$ 100.000",
    highlightPrice: "R$ 2.390",
    body: "O modelo RMS (Regional Monthly Subscription) transforma um investimento de capital de seis dígitos em uma mensalidade acessível, sem abrir mão de nada: mesma licença oficial, mesma amplitude de módulos, agora com suporte local Smart Dent.",
  },
  howItWorks: {
    title: "Como funciona a ativação",
    items: [
      { title: "Assinatura e ativação", desc: "Você adere ao pré-lançamento pagando a ativação + 1º mês." },
      { title: "Implantação assistida", desc: "Time Smart Dent conduz o setup técnico, licença e integrações." },
      { title: "Treinamento em português", desc: "Sessão remota guiada para você começar a produzir imediatamente." },
    ],
  },
  price: {
    ribbon: "Ativação inicial",
    title: "Pacote completo, sem surpresas",
    includes: [
      "Licença oficial DentalCAD Ultimate Lab Bundle",
      "Ativação assistida por Smart Dent",
      "Treinamento remoto conduzido",
      "Suporte técnico em português",
      "Casos ilimitados",
    ],
    cta: "Quero ativar agora",
  },
  conditions: {
    title: "Escolha a melhor condição para ativar seu exocad",
    subtitle: "Três opções comerciais para encaixar a licença oficial no momento do seu laboratório.",
    cards: [
      {
        ribbon: "Condição 1",
        title: "Implantação assistida",
        priceLabel: "Sob consulta",
        priceNote: "para times em expansão",
        includes: [
          "Diagnóstico inicial do fluxo digital",
          "Planejamento técnico com especialista",
          "Treinamento remoto para equipe",
          "Acompanhamento na entrada em produção",
        ],
        cta: "Solicitar condição",
        footnote: "Ideal para laboratórios que precisam organizar o fluxo antes da ativação.",
      },
      {
        ribbon: "Condição 2",
        title: "Plano consultivo",
        priceLabel: "Personalizado",
        priceNote: "para operação completa",
        includes: [
          "Condição ajustada ao cenário do laboratório",
          "Mapeamento de módulos e necessidades",
          "Suporte comercial Smart Dent",
          "Próximo passo guiado com consultor",
        ],
        cta: "Falar com consultor",
        footnote: "A Smart Dent orienta a melhor composição antes da contratação.",
      },
    ],
  },
  modules: {
    eyebrow: "O que está incluído",
    title: "Um pacote para o laboratório inteiro",
    subtitle: "O Ultimate Lab Bundle reúne 15 módulos do DentalCAD — do fluxo restaurador básico até prótese total, implantes, barras, splints e planejamento estético.",
    items: [
      { name: "DentalCAD Core Version", application: "Coroas, pontes, copings, inlays, onlays, overlays, facetas, enceramentos, telescópicas e fluxos restauradores essenciais." },
      { name: "Virtual Articulator", application: "Simulação de movimentos mandibulares e análise de oclusão dinâmica." },
      { name: "Provisional Module", application: "Desenho de provisórios, incluindo estruturas do tipo eggshell com base em escaneamentos pré-operatórios." },
      { name: "TruSmile™ Module", application: "Visualização e renderização realista das restaurações." },
      { name: "ZRS Tooth Library", application: "Biblioteca adicional de formas dentais naturais." },
      { name: "Implant Module", application: "Pilares personalizados, coroas sobre implante e restaurações parafusadas." },
      { name: "Bar Module", application: "Desenho de barras simples e complexas para soluções implantossuportadas." },
      { name: "DICOM Viewer Module", application: "Visualização de dados volumétricos durante o processo de desenho. Não substitui o exoplan nem constitui ferramenta autônoma de diagnóstico." },
      { name: "Model Creator Module", application: "Criação de modelos físicos a partir de escaneamentos digitais, para impressão 3D." },
      { name: "Smile Creator Module", application: "Planejamento estético com integração de dados 2D e 3D." },
      { name: "Full Denture Module", application: "Desenho digital de próteses totais, incluindo fluxos compatíveis previstos no pacote." },
      { name: "Inspira™ Denture Tooth Library", application: "Biblioteca de dentes para fluxos digitais de prótese total, conforme disponibilidade da versão." },
      { name: "PartialCAD Module", application: "Desenho de estruturas metálicas ou digitais para próteses parciais removíveis." },
      { name: "Bite Splint Module", application: "Placas oclusais, night guards, splints e estruturas tabletop." },
      { name: "Jaw Motion Import Module", application: "Importação de movimentos reais de sistemas de registro mandibular e arco facial digital." },
    ],
    footnote: "Observação: a disponibilidade final acompanha a versão, a região e as condições vigentes do fabricante. O bundle não inclui xSNAP, In-CAD Nesting/Nesting, exocam, exoplan, ChairsideCAD ou outros produtos independentes — esses são adquiridos separadamente.",
  },
  regionalRules: {
    title: "Uso seguro e regular da licença",
    intro: "Regras regionais e condições de uso que fazem parte do funcionamento correto da licença RMS no Brasil.",
    items: [
      "A licença RMS é destinada ao Brasil e deve ser instalada, ativada, acessada e utilizada no Brasil.",
      "A conta my.exocad deve conter dados consistentes e país de registro compatível com o Brasil.",
      "Não utilizar VPN, proxy, túnel, hospedagem remota, desktop remoto ou outros mecanismos com a finalidade de mascarar ou contornar a localização geográfica.",
      "A licença é por seat: um usuário final e um computador por vez; não é licença concorrente nem flutuante.",
      "A ativação e a validação contínua dependem de conexão com os mecanismos de licença da exocad.",
      "Inconsistências de região, conta, IP, geolocalização, dispositivo ou pagamento podem impedir ou suspender a ativação.",
      "Mudança de computador, sistema ou hardware pode exigir nova validação e deve ser comunicada previamente.",
      "O cliente é responsável pela guarda de eventual dongle ou mecanismo físico disponibilizado; não há transferência de propriedade ao cliente.",
    ],
    footnote: "Estas condições estão detalhadas nos Termos e no FAQ.",
  },
  implementation: {
    title: "Implantação, ativação, treinamento e suporte",
    subtitle: "Escopo do que a Smart Dent conduz na entrada em operação do seu exocad.",
    activation: {
      title: "Ativação inicial",
      items: [
        "Conferência do pagamento e dos dados de contratação.",
        "Validação do cliente, do país, da conta my.exocad e do usuário final.",
        "Análise básica dos requisitos técnicos informados.",
        "Solicitação e associação da licença ao cliente.",
        "Instalação e/ou orientação de instalação conforme procedimento vigente.",
        "Configuração inicial do ambiente e dos parâmetros aplicáveis.",
        "Teste de abertura, validação e funcionamento da licença.",
        "Entrega das orientações para treinamento e suporte.",
      ],
    },
    training: {
      title: "Treinamento inicial",
      body: "Treinamento inicial remoto, conforme agenda e formato definidos pela Smart Dent, voltado à introdução ao ambiente, fluxo de trabalho e recursos essenciais do plano.",
    },
    support: {
      title: "Suporte Smart Dent",
      items: [
        "Atendimento em português pelos canais oficiais, em horário comercial.",
        "Orientação de licença, ativação, configuração inicial e incidentes de uso do software.",
        "Suporte não inclui execução dos projetos do laboratório, desenho de casos por terceiros, responsabilidade clínica ou manutenção de hardware.",
        "Atendimentos remotos dependem de autorização, disponibilidade do cliente e observância das regras regionais.",
      ],
    },
  },
  benefits: {
    title: "O que a Smart Dent entrega",
    items: [
      { icon: "licenca", title: "Licença original", desc: "Emitida diretamente pela exocad GmbH." },
      { icon: "brasil", title: "Suporte no Brasil", desc: "Time Smart Dent em português." },
      { icon: "treinamento", title: "Treinamento incluso", desc: "Sessão remota para começar rápido." },
      { icon: "modulos", title: "Ultimate Lab Bundle", desc: "Todos os módulos que o laboratório precisa." },
      { icon: "rocket", title: "Ativação assistida", desc: "Setup técnico conduzido pelo nosso time." },
      { icon: "shield", title: "Revenda oficial", desc: "Contrato limpo, sem intermediários." },
    ],
  },
  faq: {
    title: "Perguntas frequentes",
    items: [
      { q: "O que é o exocad RMS?", a: "RMS significa Regional Monthly Subscription (Assinatura Mensal Regional). É o modelo que permite ao seu laboratório utilizar a licença oficial e completa do exocad no Brasil através de uma assinatura mensal. Isso elimina a barreira do alto investimento inicial de uma licença perpétua, adequando-se perfeitamente ao seu fluxo de caixa." },
      { q: "A licença é oficial?", a: "Sim. A licença é fornecida dentro da parceria e dos procedimentos oficiais da exocad, com ativação e validação exclusiva para o território brasileiro." },
      { q: "A licença será minha para sempre?", a: "Não se trata de uma compra vitalícia ou perpétua. O cliente adquire o direito temporário de usar a licença oficial enquanto a assinatura estiver ativa. Ao interromper a mensalidade, o acesso ao software é pausado." },
      { q: "Preciso ter uma conta my.exocad?", a: "Sim. A conta deve ser obrigatoriamente vinculada ao cliente e estar cadastrada com dados e país compatíveis com o Brasil." },
      { q: "Como funciona o pagamento da Ativação Inicial?", a: "Para começar, você paga apenas o valor de Ativação e Implantação Inicial (de R$ 3.700 por R$ 2.390 na pré-venda). Este pagamento único no início já inclui o seu primeiro mês de uso da licença, além de todo o serviço de cadastramento, validação da conta, configuração, treinamento e acompanhamento de implantação pela Smart Dent." },
      { q: "Qual será o valor da minha mensalidade a partir do segundo mês?", a: "Após o período coberto pela Ativação Inicial, a sua assinatura entra no ciclo de recorrência mensal. Na condição promocional de lançamento, a mensalidade cai de R$ 2.390,00 para R$ 1.199/mês, debitada automaticamente no cartão." },
      { q: "O pagamento é seguro?", a: "Sim. O checkout e a cobrança são processados de forma 100% segura pela Stripe. A Smart Dent não recebe nem armazena os dados completos do seu cartão de crédito." },
      { q: "Quem fornece a licença e quem cobra?", a: "A licença, a ativação e o suporte local são realizados pela MMTech Brasil / Smart Dent. O pagamento é processado pela MMTech North America LLC por meio da Stripe, conforme os documentos de contratação." },
      { q: "Quem aparece no extrato do cartão?", a: "A descrição na sua fatura pode conter termos como MMTECH, SMART DENT, STRIPE ou LINK, dependendo do meio de pagamento e do banco emissor do seu cartão." },
      { q: "O que acontece se o cartão falhar na mensalidade?", a: "A Stripe e a Smart Dent poderão enviar avisos e realizar novas tentativas de cobrança. A continuidade ou renovação da licença depende da regularização do pagamento antes do próximo ciclo de faturamento da exocad." },
      { q: "Posso cancelar a assinatura?", a: "Sim, você pode cancelar seguindo os prazos e condições do contrato. O modelo RMS foi criado para oferecer previsibilidade sem amarras desnecessárias. Contudo, não há reembolso proporcional do período já iniciado, e uma contratação futura após o encerramento poderá exigir o pagamento de uma nova taxa de ativação." },
      { q: "O Ultimate Bundle inclui todos os produtos da exocad?", a: "O pacote reúne a maior amplitude de módulos do DentalCAD voltada para laboratórios e clínicos (como Implant Module, Model Creator, Smile Creator, PartialCAD, Bite Splint, Provisional, Full Denture, Bar, DICOM Viewer, entre outros). No entanto, não inclui produtos independentes (como exoplan, ChairsideCAD ou exocam), nem add-ons que não façam parte do pacote vigente." },
      { q: "Existe cobrança por caso ou taxa de exportação (click fees)?", a: "Não. O DentalCAD RMS Ultimate Lab Bundle permite um número ilimitado de casos e não possui click fees (taxas ocultas) para exportação." },
      { q: "Funciona com meu scanner, impressora ou fresadora?", a: "Sim. O DentalCAD possui arquitetura aberta e ampla compatibilidade com o mercado. A integração específica depende do equipamento, do formato de arquivo, das bibliotecas e do fluxo utilizados. Nossa equipe orientará essa análise durante a implantação." },
      { q: "Terei direito a atualizações do exocad?", a: "Sim. Enquanto a sua assinatura estiver ativa e regular, você terá acesso a todas as atualizações previstas no plano e disponibilizadas oficialmente pela exocad." },
      { q: "A inteligência artificial da exocad está incluída?", a: "Na atual promoção de lançamento, os assinantes ganham 30 Créditos de I.A. por mês. No entanto, é importante ressaltar que os serviços de IA e seus créditos dependem da versão do software, do tipo de licença e da disponibilidade regional definida pela exocad, não sendo garantidos permanentemente fora destas condições específicas." },
      { q: "Ser um assinante Smart Dent traz outros benefícios?", a: "Sim! Além do software completo, os assinantes ativos têm acesso a um pacote de cursos online completos e descontos exclusivos em toda a linha de resinas e insumos para odontologia digital do portfólio Smart Dent." },
      { q: "Posso usar em mais de um computador?", a: "Não. Cada licença RMS não é flutuante; ela é por seat e fica limitada a um usuário final e a um computador por vez. Mudanças de equipamento precisam ser avaliadas, comunicadas e autorizadas previamente." },
      { q: "Posso acessar a licença de fora do Brasil?", a: "Não. A modalidade RMS é estritamente regional e deve ser utilizada no Brasil. É proibido utilizar VPN, proxy, hospedagem remota (hosting) ou mecanismos semelhantes com a finalidade de mascarar ou contornar a localização geográfica, sob pena de suspensão." },
      { q: "Meu computador é compatível?", a: "A compatibilidade técnica será analisada durante o nosso onboarding. De qualquer forma, o cliente é responsável por manter o computador, o sistema operacional, a conexão de internet e demais requisitos de hardware em condições adequadas para rodar o software." },
      { q: "Preciso estar conectado à internet?", a: "Sim. A ativação inicial e a validação contínua da sua licença dependem de conexão com a internet para comunicação com os servidores da exocad." },
      { q: "Há uso de dongle físico (pen drive)?", a: "A licença pode utilizar um dongle USB ou outro mecanismo de licenciamento digital, conforme a solução disponibilizada pela exocad. Caso haja um dispositivo físico, ele é entregue para uso temporário, não transfere propriedade ao cliente, e deve ser guardado com segurança e devolvido quando solicitado." },
      { q: "Acabei de realizar o pagamento da Ativação. E agora?", a: "Bem-vindo ao ecossistema Smart Dent! Nossa equipe fará a conferência do pagamento e iniciará a implantação. Validaremos sua conta my.exocad, associaremos sua licença, auxiliaremos na configuração inicial e agendaremos seu treinamento." },
      { q: "O treinamento está incluído?", a: "Sim. A ativação inicial inclui um treinamento remoto voltado à introdução do ambiente, fluxo de trabalho e recursos essenciais, realizado conforme o formato e a agenda definidos pela equipe Smart Dent." },
      { q: "O suporte técnico está incluído?", a: "Sim, você terá suporte em português pelos canais oficiais da Smart Dent em horário comercial. O atendimento cobre o escopo técnico da licença (orientação, ativação, configuração e incidentes do software). Nota: o suporte não inclui a execução/desenho de casos para o laboratório, responsabilidade clínica ou manutenção de equipamentos não contratados." },
    ],
  },
  finalCta: {
    headline: "Pronto para ativar seu exocad com a Smart Dent?",
    sub: "Ativação assistida, treinamento em português e suporte oficial.",
    cta: "Quero ativar agora",
  },
  legal: "© Smart Dent. Todos os direitos reservados. exocad® é marca registrada de exocad GmbH.",
};