// Composição gráfica das artes de marketing de treinamento.
// A FOTOGRAFIA é usada como pixels originais (apenas crop/escala via
// preserveAspectRatio="slice") e o LOGO é o arquivo PNG oficial embutido.
// Nada aqui gera, redesenha ou altera pessoas, produtos ou o logo.

export type RenderFormat =
  | "instagram_feed_vertical"
  | "instagram_feed_square"
  | "instagram_story"
  | "instagram_reel_cover";

export interface FormatSpec {
  width: number;
  height: number;
  /** Chave da pasta oficial de entregas em drive_subfolders. */
  deliveryKeys: string[];
  token: string;
}

export const FORMATS: Record<RenderFormat, FormatSpec> = {
  instagram_feed_vertical: { width: 1080, height: 1350, deliveryKeys: ["entregas_carrossel", "entregas"], token: "IG_FEED_VERTICAL" },
  instagram_feed_square: { width: 1080, height: 1080, deliveryKeys: ["entregas_carrossel", "entregas"], token: "IG_FEED_SQUARE" },
  instagram_story: { width: 1080, height: 1920, deliveryKeys: ["entregas_stories", "entregas"], token: "IG_STORY" },
  instagram_reel_cover: { width: 1080, height: 1920, deliveryKeys: ["entregas_reels", "entregas"], token: "IG_REEL_COVER" },
};

/** Identidade visual Smart Dent. */
const BLUE = "#0A2A5E";
const BLUE_LIGHT = "#2FA8E0";
const ORANGE = "#E8821A";
const WHITE = "#FFFFFF";

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Quebra de linha por estimativa de largura de glifo (Poppins). */
function wrap(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const perChar = fontSize * 0.56;
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length * perChar > maxWidth && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.slice(0, maxLines);
}

export interface LayoutInput {
  format: RenderFormat;
  photoDataUri: string;
  logoDataUri: string;
  turmaNumber: number | string;
  courseTitle: string;
  title: string;
  subtitle: string;
  cta: string;
  /** Ajuste global leve permitido (0.9–1.1). Não altera conteúdo da foto. */
  brightness?: number;
  saturation?: number;
  /** Foco do crop: 0 = topo/esquerda, 0.5 = centro, 1 = base/direita. */
  focus?: "top" | "center" | "bottom";
}

export function buildSvg(input: LayoutInput): { svg: string; width: number; height: number } {
  const spec = FORMATS[input.format];
  const { width: W, height: H } = spec;
  const isStory = H === 1920;

  // Área da fotografia: sempre em cima; o texto vive na faixa gráfica inferior.
  const photoH = isStory ? Math.round(H * 0.72) : Math.round(H * 0.66);
  const align = input.focus === "top" ? "xMidYMin" : input.focus === "bottom" ? "xMidYMax" : "xMidYMid";

  const b = Math.min(Math.max(input.brightness ?? 1, 0.9), 1.1);
  const s = Math.min(Math.max(input.saturation ?? 1, 0.9), 1.1);

  const pad = 64;
  const titleSize = isStory ? 84 : 72;
  const subSize = isStory ? 40 : 36;
  const titleLines = wrap(input.title, titleSize, W - pad * 2, 3);
  const subLines = wrap(input.subtitle, subSize, W - pad * 2, 2);

  const blockTop = photoH + 56;
  let y = blockTop + titleSize;
  const titleTspans = titleLines
    .map((l, i) => `<text x="${pad}" y="${y + i * (titleSize * 1.12)}" font-family="Poppins" font-weight="700" font-size="${titleSize}" fill="${WHITE}" letter-spacing="-1">${esc(l.toUpperCase())}</text>`)
    .join("");
  y = y + titleLines.length * (titleSize * 1.12) + 18;
  const subTspans = subLines
    .map((l, i) => `<text x="${pad}" y="${y + i * (subSize * 1.35)}" font-family="Poppins" font-weight="400" font-size="${subSize}" fill="#CFE3F5">${esc(l)}</text>`)
    .join("");
  const ctaY = H - pad - 34;
  const ctaText = esc(String(input.cta || "").toUpperCase());
  const ctaW = Math.min(W - pad * 2, Math.round(ctaText.length * subSize * 0.6) + 96);

  return {
    width: W,
    height: H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BLUE}"/>
      <stop offset="1" stop-color="#061A3B"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BLUE}" stop-opacity="0.55"/>
      <stop offset="0.35" stop-color="${BLUE}" stop-opacity="0"/>
      <stop offset="0.78" stop-color="${BLUE}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${BLUE}" stop-opacity="1"/>
    </linearGradient>
    <clipPath id="photoClip"><rect x="0" y="0" width="${W}" height="${photoH}"/></clipPath>
    <filter id="tone" color-interpolation-filters="sRGB">
      <feComponentTransfer><feFuncR type="linear" slope="${b}"/><feFuncG type="linear" slope="${b}"/><feFuncB type="linear" slope="${b}"/></feComponentTransfer>
      <feColorMatrix type="saturate" values="${s}"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- FOTOGRAFIA ORIGINAL: apenas crop/escala + ajuste global leve -->
  <g clip-path="url(#photoClip)" filter="url(#tone)">
    <image x="0" y="0" width="${W}" height="${photoH}" preserveAspectRatio="${align} slice" xlink:href="${input.photoDataUri}"/>
  </g>
  <rect x="0" y="0" width="${W}" height="${photoH}" fill="url(#scrim)"/>
  <rect x="0" y="${photoH - 6}" width="${W}" height="6" fill="${BLUE_LIGHT}"/>

  <!-- LOGO OFICIAL: arquivo original aplicado, sem redesenho -->
  <image x="${pad}" y="${pad - 14}" width="132" height="132" preserveAspectRatio="xMidYMid meet" xlink:href="${input.logoDataUri}"/>

  <g>
    <rect x="${W - pad - 300}" y="${pad + 10}" width="300" height="72" rx="36" fill="${ORANGE}"/>
    <text x="${W - pad - 150}" y="${pad + 58}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="34" fill="${WHITE}" letter-spacing="1">TURMA #${esc(String(input.turmaNumber))}</text>
  </g>

  <text x="${pad}" y="${blockTop - 6}" font-family="Poppins" font-weight="600" font-size="28" fill="${BLUE_LIGHT}" letter-spacing="3">${esc(input.courseTitle.toUpperCase())}</text>
  ${titleTspans}
  ${subTspans}

  ${ctaText ? `<g><rect x="${pad}" y="${ctaY - 46}" width="${ctaW}" height="72" rx="12" fill="${WHITE}"/><text x="${pad + ctaW / 2}" y="${ctaY}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="30" fill="${BLUE}" letter-spacing="1">${ctaText}</text></g>` : ""}
  <rect x="0" y="${H - 10}" width="${W}" height="10" fill="${BLUE_LIGHT}"/>
</svg>`,
  };
}