/**
 * Opções de botão (CTA) da campanha de e-mail vindas dos simuladores de WhatsApp.
 * Usa somente os links encurtados oficiais (smartops_short_links, default_target = 'whatsapp'),
 * os mesmos mostrados no cartão do formulário — nunca fabrica URLs novas.
 */
export const OFFICIAL_SHORT_BASE = "https://s.smartdent.com.br";

export interface SimulatorCtaOption {
  id: string;
  label: string;
  url: string;
  tipo: "whatsapp";
}

interface ShortRow { short_code?: string | null; form_slug?: string | null; default_target?: string | null }
interface FormRow { slug?: string | null; name?: string | null }

export function buildSimulatorCtaOptions(rows: ShortRow[], forms: FormRow[]): SimulatorCtaOption[] {
  const nameBySlug = new Map<string, string>();
  for (const f of forms) if (f.slug) nameBySlug.set(f.slug, (f.name || f.slug).trim());
  const seen = new Set<string>();
  const out: SimulatorCtaOption[] = [];
  for (const r of rows) {
    if (r.default_target !== "whatsapp" || !r.short_code || !r.form_slug) continue;
    const name = nameBySlug.get(r.form_slug);
    if (!name || seen.has(r.short_code)) continue;
    seen.add(r.short_code);
    out.push({
      id: r.short_code,
      tipo: "whatsapp",
      label: `Simulador WhatsApp: ${name}`,
      url: `${OFFICIAL_SHORT_BASE}/${r.short_code}`,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export interface LandingCtaOption {
  id: string;
  label: string;
  url: string;
  tipo: "landing";
}

/** Landing pages publicadas com link curto oficial (default_target = 'landing_page'), marcadas com origem e-mail. */
export function buildLandingCtaOptions(rows: ShortRow[], forms: FormRow[], publishedSlugs: Set<string>): LandingCtaOption[] {
  const nameBySlug = new Map<string, string>();
  for (const f of forms) if (f.slug) nameBySlug.set(f.slug, (f.name || f.slug).trim());
  const seen = new Set<string>();
  const out: LandingCtaOption[] = [];
  for (const r of rows) {
    if (r.default_target !== "landing_page" || !r.short_code || !r.form_slug) continue;
    if (!publishedSlugs.has(r.form_slug)) continue;
    const name = nameBySlug.get(r.form_slug);
    if (!name || seen.has(r.short_code)) continue;
    seen.add(r.short_code);
    out.push({
      id: r.short_code,
      tipo: "landing",
      label: `Landing page: ${name}`,
      url: `${OFFICIAL_SHORT_BASE}/${r.short_code}?o=email`,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
