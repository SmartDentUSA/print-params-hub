import { ReactNode } from "react";

/**
 * PremiumLandingTemplate — hand-crafted Smart Dent landing page.
 * Renders structured content JSON produced by the AI (or by manual editing).
 * Design fixed here; content variable. This is what guarantees premium quality.
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

export type LPContent = {
  brandName?: string;
  trustBar?: string[];
  hero: {
    eyebrow?: string;
    badge?: string;
    headline: string;
    sub?: string;
    primaryCta: string;
    secondaryCta?: string;
    bullets?: string[];
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

function Icon({ name, className }: { name: BenefitIcon; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: className ?? "w-6 h-6",
    "aria-hidden": true,
  };
  switch (name) {
    case "licenca":
      return (
        <svg {...common}>
          <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "computador":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      );
    case "treinamento":
      return (
        <svg {...common}>
          <path d="M22 10L12 5 2 10l10 5 10-5z" />
          <path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5" />
        </svg>
      );
    case "cartao":
      return (
        <svg {...common}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case "suporte":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9a3 3 0 016 0c0 2-3 3-3 5" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" />
        </svg>
      );
    case "brasil":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20" />
        </svg>
      );
    case "modulos":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common}>
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
          <path d="M19 15l.7 2.1L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.9L19 15z" />
        </svg>
      );
    case "rocket":
      return (
        <svg {...common}>
          <path d="M5 15c-1 3 0 5 0 5s2 1 5 0" />
          <path d="M9 12c0-6 6-10 12-10 0 6-4 12-10 12l-2-2z" />
          <circle cx="15" cy="8" r="1.5" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
  }
}

function PrimaryButton({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-form-cta="primary"
      className={`inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3.5 rounded-xl bg-[#F47C42] text-white font-bold text-base shadow-[0_10px_30px_-8px_rgba(244,124,66,0.6)] hover:brightness-110 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F47C42] focus-visible:ring-offset-2 transition-all duration-200 ${className ?? ""}`}
    >
      {children}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}

function SecondaryButton({ children, onClick, dark }: { children: ReactNode; onClick?: () => void; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-form-cta="secondary"
      className={
        dark
          ? "inline-flex items-center justify-center min-h-12 px-6 py-3 rounded-xl border border-white/30 text-white font-semibold hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 transition"
          : "inline-flex items-center justify-center min-h-12 px-6 py-3 rounded-xl border border-[#2C245B]/25 text-[#2C245B] font-semibold hover:bg-[#2C245B]/5 focus-visible:ring-2 focus-visible:ring-[#2C245B] transition"
      }
    >
      {children}
    </button>
  );
}

function DotPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-25" aria-hidden>
      <defs>
        <pattern id="lp-dots" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.5" fill="#F47C42" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#lp-dots)" />
    </svg>
  );
}

function HeroVisual({ src }: { src?: string | null }) {
  if (src) {
    return (
      <div className="relative w-full aspect-square md:aspect-[4/5] rounded-3xl overflow-hidden bg-[#2C245B]/40 shadow-2xl">
        <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#1D173E]/50 via-transparent to-[#F47C42]/20 pointer-events-none" />
      </div>
    );
  }
  // SVG geometric fallback — abstract dental/CAD mesh
  return (
    <div className="relative w-full aspect-square md:aspect-[4/5] rounded-3xl overflow-hidden bg-gradient-to-br from-[#2C245B] via-[#1D173E] to-[#0F0B26] shadow-2xl ring-1 ring-white/10">
      <svg viewBox="0 0 400 500" className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <radialGradient id="glow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#F47C42" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#F47C42" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#F47C42" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="mesh" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="220" r="180" fill="url(#glow)" />
        {/* Concentric rings */}
        {[60, 100, 140, 180].map((r) => (
          <circle key={r} cx="200" cy="230" r={r} stroke="white" strokeOpacity={0.08} fill="none" />
        ))}
        {/* Stylized dental arch / smile mesh */}
        <g stroke="url(#mesh)" strokeWidth="1" fill="none">
          <path d="M80 260 Q200 100 320 260" strokeOpacity="0.7" />
          <path d="M90 280 Q200 130 310 280" strokeOpacity="0.5" />
          <path d="M100 300 Q200 160 300 300" strokeOpacity="0.35" />
        </g>
        {/* Grid nodes */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI;
          const x = 200 + Math.cos(angle) * 140;
          const y = 260 - Math.sin(angle) * 140;
          return <circle key={i} cx={x} cy={y} r="3" fill="#F47C42" />;
        })}
        {/* Bottom dots grid */}
        <g fill="white" fillOpacity="0.15">
          {Array.from({ length: 10 }).map((_, r) =>
            Array.from({ length: 14 }).map((_, c) => (
              <circle key={`${r}-${c}`} cx={40 + c * 25} cy={380 + r * 12} r="1" />
            )),
          )}
        </g>
      </svg>
      <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 text-white/80 text-xs">
        <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full ring-1 ring-white/15">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Fluxo digital ativo
        </span>
      </div>
    </div>
  );
}

export function PremiumLandingTemplate({ content, heroImageUrl, onCta }: Props) {
  const c = content;
  const cta = (source: string) => () => onCta?.(source);

  return (
    <div
      className="min-h-screen bg-white text-[#202331] antialiased"
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      {/* Top trust bar */}
      {c.trustBar && c.trustBar.length > 0 && (
        <div className="bg-[#1D173E] text-white/85 text-xs">
          <div className="max-w-6xl mx-auto px-6 py-2.5 flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
            {c.trustBar.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="#F47C42" strokeWidth="2.5" className="w-3.5 h-3.5" aria-hidden>
                  <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#1D173E] text-white">
        <DotPattern />
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-[#F47C42] opacity-10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-40 w-[520px] h-[520px] rounded-full bg-[#2C245B] opacity-40 blur-3xl" aria-hidden />

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
          <div>
            {c.hero.badge && (
              <span className="inline-flex items-center gap-2 bg-[#F47C42] text-white uppercase tracking-[0.18em] text-[11px] md:text-xs font-black px-4 py-2 rounded-full shadow-[0_8px_24px_-6px_rgba(244,124,66,0.7)] mb-6">
                <Icon name="sparkles" className="w-3.5 h-3.5" />
                {c.hero.badge}
              </span>
            )}
            {c.hero.eyebrow && (
              <p className="text-[#F47C42] uppercase tracking-widest text-xs font-bold mb-3">{c.hero.eyebrow}</p>
            )}
            <h1
              className="font-black tracking-tight text-4xl md:text-6xl lg:text-[64px] leading-[1.05]"
              style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}
            >
              {c.hero.headline}
            </h1>
            {c.hero.sub && <p className="mt-6 text-lg md:text-xl text-white/75 max-w-xl leading-relaxed">{c.hero.sub}</p>}
            {c.hero.bullets && c.hero.bullets.length > 0 && (
              <ul className="mt-6 space-y-2">
                {c.hero.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-white/85 text-sm md:text-base">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#F47C42" strokeWidth="2.5" className="w-5 h-5 mt-0.5 shrink-0" aria-hidden>
                      <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <PrimaryButton onClick={cta("hero-primary")}>{c.hero.primaryCta}</PrimaryButton>
              {c.hero.secondaryCta && <SecondaryButton onClick={cta("hero-secondary")} dark>{c.hero.secondaryCta}</SecondaryButton>}
            </div>
          </div>
          <div className="relative">
            <HeroVisual src={heroImageUrl} />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      {c.howItWorks && c.howItWorks.items.length > 0 && (
        <section className="py-20 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            {c.howItWorks.title && (
              <h2
                className="text-3xl md:text-4xl font-black tracking-tight text-center max-w-2xl mx-auto"
                style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}
              >
                {c.howItWorks.title}
              </h2>
            )}
            <div className="mt-12 grid md:grid-cols-3 gap-6">
              {c.howItWorks.items.map((step, i) => (
                <div key={i} className="relative rounded-2xl bg-[#F4F5F8] p-8 hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ring-1 ring-black/[0.03]">
                  <div className="w-11 h-11 rounded-xl bg-[#2C245B] text-white font-black flex items-center justify-center text-lg mb-5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-xl font-bold text-[#1D173E] mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {step.title}
                  </h3>
                  <p className="text-[#202331]/70 leading-relaxed text-sm">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PRICE CARD */}
      {c.price && (
        <section className="py-20 md:py-24 bg-[#F4F5F8]">
          <div className="max-w-3xl mx-auto px-6">
            <div className="rounded-3xl bg-white shadow-[0_30px_80px_-30px_rgba(28,23,62,0.35)] overflow-hidden ring-1 ring-black/[0.04]">
              {c.price.ribbon && (
                <div className="bg-gradient-to-r from-[#F47C42] via-[#F58A54] to-[#F47C42] text-white text-center py-3.5">
                  <span className="uppercase tracking-[0.22em] font-black text-sm">{c.price.ribbon}</span>
                </div>
              )}
              <div className="p-8 md:p-12">
                <h2
                  className="text-3xl md:text-4xl font-black text-[#1D173E] tracking-tight"
                  style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}
                >
                  {c.price.title}
                </h2>
                {c.price.priceLabel && (
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl md:text-5xl font-black text-[#2C245B]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {c.price.priceLabel}
                    </span>
                    {c.price.priceNote && <span className="text-sm text-[#202331]/60">{c.price.priceNote}</span>}
                  </div>
                )}
                <ul className="mt-7 space-y-3.5">
                  {c.price.includes.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-[#168B5B]/10 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#168B5B" strokeWidth="3" className="w-3.5 h-3.5" aria-hidden>
                          <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="text-[#202331] leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-9">
                  <PrimaryButton onClick={cta("price-card")} className="w-full">
                    {c.price.cta}
                  </PrimaryButton>
                </div>
                {c.price.footnote && (
                  <p className="mt-5 text-xs text-[#202331]/60 text-center">{c.price.footnote}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* BENEFITS */}
      {c.benefits && c.benefits.items.length > 0 && (
        <section className="py-20 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            {c.benefits.title && (
              <h2
                className="text-3xl md:text-4xl font-black tracking-tight text-center max-w-2xl mx-auto"
                style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}
              >
                {c.benefits.title}
              </h2>
            )}
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {c.benefits.items.map((b, i) => (
                <div
                  key={i}
                  className="group rounded-2xl bg-white border border-[#E5E7EE] p-7 hover:border-[#F47C42]/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#F47C42]/10 text-[#F47C42] flex items-center justify-center mb-5 group-hover:bg-[#F47C42] group-hover:text-white transition-colors">
                    <Icon name={b.icon} className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1D173E] mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {b.title}
                  </h3>
                  <p className="text-sm text-[#202331]/70 leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TESTIMONIALS */}
      {c.testimonials && c.testimonials.items.length > 0 && (
        <section className="py-20 md:py-24 bg-[#1D173E] text-white relative overflow-hidden">
          <DotPattern />
          <div className="relative max-w-6xl mx-auto px-6">
            {c.testimonials.title && (
              <h2
                className="text-3xl md:text-4xl font-black tracking-tight text-center max-w-2xl mx-auto"
                style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}
              >
                {c.testimonials.title}
              </h2>
            )}
            <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {c.testimonials.items.map((t, i) => (
                <figure key={i} className="rounded-2xl bg-white/5 backdrop-blur ring-1 ring-white/10 p-7">
                  <svg viewBox="0 0 24 24" fill="#F47C42" className="w-8 h-8 mb-3" aria-hidden>
                    <path d="M7 7h4v10H3V11c0-2.2 1.8-4 4-4zm10 0h4v10h-8V11c0-2.2 1.8-4 4-4z" />
                  </svg>
                  <blockquote className="text-white/90 leading-relaxed">"{t.quote}"</blockquote>
                  <figcaption className="mt-5 pt-4 border-t border-white/10">
                    <div className="font-bold">{t.author}</div>
                    {t.role && <div className="text-xs text-white/60">{t.role}</div>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {c.faq && c.faq.items.length > 0 && (
        <section className="py-20 md:py-24 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <h2
              className="text-3xl md:text-4xl font-black tracking-tight text-center"
              style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}
            >
              {c.faq.title ?? "Perguntas frequentes"}
            </h2>
            <div className="mt-10 space-y-3">
              {c.faq.items.map((item, i) => (
                <details
                  key={i}
                  className="group rounded-2xl bg-[#F4F5F8] hover:bg-[#EEF0F5] transition-colors overflow-hidden ring-1 ring-black/[0.03]"
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 p-5 md:p-6 font-semibold text-[#1D173E]">
                    <span>{item.q}</span>
                    <span
                      className="shrink-0 w-8 h-8 rounded-full bg-white text-[#F47C42] flex items-center justify-center text-xl font-black group-open:rotate-45 transition-transform"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <div className="px-5 md:px-6 pb-5 md:pb-6 text-[#202331]/75 leading-relaxed">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      {c.finalCta && (
        <section className="relative py-20 md:py-24 bg-gradient-to-br from-[#2C245B] via-[#1D173E] to-[#0F0B26] text-white overflow-hidden">
          <DotPattern />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-[#F47C42] opacity-15 blur-3xl" aria-hidden />
          <div className="relative max-w-3xl mx-auto px-6 text-center">
            <h2
              className="text-3xl md:text-5xl font-black tracking-tight leading-tight"
              style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}
            >
              {c.finalCta.headline}
            </h2>
            {c.finalCta.sub && <p className="mt-5 text-lg text-white/75">{c.finalCta.sub}</p>}
            <div className="mt-9 flex justify-center">
              <PrimaryButton onClick={cta("final")}>{c.finalCta.cta}</PrimaryButton>
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="bg-[#1D173E] text-white/60 text-xs">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="font-semibold text-white/80">{c.brandName ?? "Smart Dent | Fluxo Digital"}</div>
          <div className="text-center md:text-right leading-relaxed">
            {c.legal ?? "© Smart Dent. Todos os direitos reservados. exocad® é marca registrada de exocad GmbH."}
          </div>
        </div>
      </footer>

      {/* MOBILE STICKY CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 md:hidden bg-white/95 backdrop-blur-xl border-t border-black/5 p-3 shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.15)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <button
          type="button"
          onClick={cta("mobile-sticky")}
          data-form-cta="primary"
          className="w-full min-h-12 rounded-xl bg-[#F47C42] text-white font-bold shadow-lg hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[#F47C42] focus-visible:ring-offset-2 transition"
        >
          {c.hero.primaryCta}
        </button>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
    </div>
  );
}

export const DEFAULT_LP_CONTENT: LPContent = {
  brandName: "Smart Dent | Fluxo Digital",
  trustBar: ["Revenda oficial", "Suporte em português", "Licença legítima"],
  hero: {
    badge: "Ativação inicial",
    eyebrow: "exocad no Brasil",
    headline: "Seu laboratório pronto para o fluxo digital exocad.",
    sub: "Ativação assistida, treinamento em português e suporte da Smart Dent — revenda oficial no Brasil.",
    primaryCta: "Quero ativar agora",
    secondaryCta: "Falar com especialista",
    bullets: [
      "Licença original exocad DentalCAD",
      "Treinamento remoto conduzido",
      "Suporte técnico Smart Dent Brasil",
    ],
  },
  howItWorks: {
    title: "Como funciona a ativação",
    items: [
      { title: "Preenchimento rápido", desc: "Você envia seus dados e a Smart Dent valida a licença em minutos." },
      { title: "Instalação assistida", desc: "Nossa equipe conduz a instalação remota no seu computador." },
      { title: "Treinamento e prontidão", desc: "Sessão de treinamento em português e suporte para começar a produzir." },
    ],
  },
  price: {
    ribbon: "Ativação inicial",
    title: "Pacote completo, sem surpresas",
    includes: [
      "Licença oficial exocad DentalCAD",
      "Ativação assistida remotamente",
      "Treinamento inicial em português",
      "Suporte técnico Smart Dent Brasil",
    ],
    cta: "Quero ativar agora",
    footnote: "Emitido pela exocad GmbH • Nota fiscal e garantia oficiais",
  },
  benefits: {
    title: "Por que ativar com a Smart Dent",
    items: [
      { icon: "licenca", title: "Licença legítima", desc: "Chave oficial emitida pela exocad GmbH, com garantia e atualizações." },
      { icon: "brasil", title: "Suporte no Brasil", desc: "Atendimento em português com quem entende fluxo odontológico." },
      { icon: "treinamento", title: "Treinamento incluído", desc: "Sessão inicial em português com casos reais do laboratório." },
      { icon: "modulos", title: "Módulos avançados", desc: "Acesso à ampliação para módulos premium quando precisar." },
      { icon: "suporte", title: "Ativação assistida", desc: "Nossa equipe faz a instalação com você — nada de manual perdido." },
      { icon: "cartao", title: "Pagamento facilitado", desc: "Condições de pagamento acessíveis para laboratórios e clínicas." },
    ],
  },
  faq: {
    title: "Perguntas frequentes",
    items: [
      { q: "A licença é oficial?", a: "Sim. A licença é emitida oficialmente pela exocad GmbH e vinculada ao seu dongle/computador conforme o modelo escolhido." },
      { q: "Como é o treinamento?", a: "Realizamos uma sessão inicial remota em português, com material de apoio e casos práticos do dia a dia." },
      { q: "Consigo emitir nota fiscal?", a: "Sim, toda a operação é feita pela Smart Dent no Brasil com nota fiscal." },
      { q: "E se eu tiver dúvidas depois?", a: "Você tem suporte técnico contínuo da Smart Dent Brasil pelos canais oficiais." },
    ],
  },
  finalCta: {
    headline: "Pronto para começar seu fluxo digital com exocad?",
    sub: "Preencha o formulário e nossa equipe entra em contato para iniciar sua ativação.",
    cta: "Quero ativar agora",
  },
};