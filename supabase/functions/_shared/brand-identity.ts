// Padrão da marca (Configurações do Sistema → Padrão da marca).
// Fonte única para cores, fontes, estilo e referências usados ao gerar imagens.
// Lido de public.brand_identity_settings; cai para os valores padrão se a tabela falhar.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type BrandColor = { name: string; hex: string; role: string };
export type BrandFont = { family: string; weights: string; role: string };
export type BrandRef = { label: string; url: string };
export type BrandIdentity = {
  brand_name: string;
  palette: BrandColor[];
  fonts: BrandFont[];
  logos: BrandRef[];
  reference_images: BrandRef[];
  taglines: string[];
  voice: string;
  image_style: string;
  image_avoid: string;
};

export const DEFAULT_BRAND: BrandIdentity = {
  brand_name: "Smart Dent",
  palette: [
    { name: "Azul-marinho Smart Dent", hex: "#363E56", role: "principal" },
    { name: "Laranja Smart Dent", hex: "#E56838", role: "acento pontual" },
    { name: "Azul ardósia", hex: "#546085", role: "secundária" },
    { name: "Lavanda", hex: "#90A1D6", role: "apoio" },
    { name: "Azul acinzentado", hex: "#8B9EB4", role: "apoio" },
    { name: "Gelo", hex: "#EDF0F7", role: "fundo claro" },
  ],
  fonts: [
    { family: "Host Grotesk", weights: "300, 600", role: "títulos de produto" },
    { family: "Poppins", weights: "400, 600", role: "títulos institucionais e textos" },
  ],
  logos: [],
  reference_images: [],
  taglines: ["Soluções de odontologia digital"],
  voice: "Premium, técnico e confiante.",
  image_style: "Editorial premium e clínico, fundo gelo ou azul-marinho, produto herói fotorrealista, elementos de vidro, laranja só em detalhes.",
  image_avoid: "Neon, roxo, preto puro, excesso de laranja, clip-art, texto em excesso, preços.",
};

let cache: { at: number; value: BrandIdentity } | null = null;

export async function getBrandIdentity(supabase: SupabaseClient): Promise<BrandIdentity> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.value;
  try {
    const { data } = await supabase.from("brand_identity_settings").select("*").eq("id", "smartdent").maybeSingle();
    const v: BrandIdentity = data ? { ...DEFAULT_BRAND, ...data } as BrandIdentity : DEFAULT_BRAND;
    cache = { at: Date.now(), value: v };
    return v;
  } catch {
    return DEFAULT_BRAND;
  }
}

export function brandHex(b: BrandIdentity, match: RegExp, fallback: string): string {
  return b.palette.find((c) => match.test(c.name))?.hex ?? fallback;
}
export const brandOrange = (b: BrandIdentity) => brandHex(b, /laranja smart/i, "#E56838");
export const brandNavy = (b: BrandIdentity) => brandHex(b, /marinho/i, "#363E56");
export const brandSlate = (b: BrandIdentity) => brandHex(b, /ard[oó]sia/i, "#546085");

/** Bloco de texto para prompts de imagem. `compact` traz só cores e tipografia. */
export function brandPromptBlock(b: BrandIdentity, opts: { compact?: boolean } = {}): string {
  const colors = b.palette.map((c) => `${c.name} ${c.hex} (${c.role})`).join("; ");
  const fonts = b.fonts.map((f) => `${f.family} ${f.weights} — ${f.role}`).join("; ");
  const lines = [
    `PADRÃO DA MARCA ${b.brand_name.toUpperCase()} (obrigatório):`,
    `- Paleta: ${colors}.`,
    `- Tipografia: ${fonts}. Sans-serif geométrica limpa; nunca serifada, condensada ou decorativa.`,
  ];
  if (!opts.compact) {
    lines.push(`- Estilo visual: ${b.image_style}`);
    lines.push(`- Tom: ${b.voice}`);
  }
  lines.push(`- Evitar: ${b.image_avoid}`);
  return lines.join("\n");
}
