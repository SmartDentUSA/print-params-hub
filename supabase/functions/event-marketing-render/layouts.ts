// Composição gráfica das artes de divulgação de eventos.
// Padrão aprovado do carrossel:
//   card 1  -> CAPA (fundo da arte + chamada + estande + CTA)
//   cards N -> 1 card por PALESTRANTE (foto redonda + nome + demonstrações)
//   último  -> FECHAMENTO (estaremos presentes / datas / local / estande)
// A ARTE ENVIADA no cadastro do evento é usada como pixels originais
// (apenas crop/escala via preserveAspectRatio="slice"); as fotos dos
// palestrantes e o logo Smart Dent são arquivos originais aplicados.

export const CAROUSEL = { width: 1080, height: 1350 };
export const STORY = { width: 1080, height: 1920 };

const NAVY = "#0A1F45";
const NAVY_DEEP = "#061630";
const CARD = "#102C5C";
const LINE = "#2A4C86";
const BLUE_LIGHT = "#2FA8E0";
const ORANGE = "#E8821A";
const WHITE = "#FFFFFF";
const SOFT = "#C6DBF2";
const PAPER = "#EAF2FB";
const INK = "#0B2447";
const INK_SOFT = "#3D5B85";
const ICON_BG = "#D8E6F7";
const HAIR = "#C9DCF1";

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const perChar = fontSize * 0.55;
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

function textBlock(
  lines: string[],
  x: number,
  y: number,
  size: number,
  fill: string,
  weight: 400 | 700,
  lineHeight = 1.15,
  extra = "",
): string {
  return lines
    .map(
      (l, i) =>
        `<text x="${x}" y="${y + i * (size * lineHeight)}" font-family="Poppins" font-weight="${weight}" font-size="${size}" fill="${fill}" ${extra}>${esc(l)}</text>`,
    )
    .join("");
}

function pin(x: number, y: number, size: number, fill: string): string {
  const s = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="${fill}"><path d="M12 0C7.03 0 3 4.03 3 9c0 6.5 9 15 9 15s9-8.5 9-15c0-4.97-4.03-9-9-9zm0 12.5A3.5 3.5 0 1 1 12 5.5a3.5 3.5 0 0 1 0 7z"/></g>`;
}

/** Quadradinho de ícone (calendário / documento / relógio / pin). */
function iconBox(x: number, y: number, size: number, kind: "cal" | "doc" | "clock" | "pin", tone = INK): string {
  const g = size * 0.5;
  const cx = x + size / 2;
  const cy = y + size / 2;
  let glyph = "";
  if (kind === "cal") {
    glyph = `<g stroke="${tone}" stroke-width="2.6" fill="none">
      <rect x="${cx - g / 2}" y="${cy - g / 2 + 2}" width="${g}" height="${g - 2}" rx="3"/>
      <line x1="${cx - g / 2}" y1="${cy - g / 2 + 9}" x2="${cx + g / 2}" y2="${cy - g / 2 + 9}"/>
      <line x1="${cx - g / 4}" y1="${cy - g / 2 - 2}" x2="${cx - g / 4}" y2="${cy - g / 2 + 4}"/>
      <line x1="${cx + g / 4}" y1="${cy - g / 2 - 2}" x2="${cx + g / 4}" y2="${cy - g / 2 + 4}"/>
    </g>`;
  } else if (kind === "doc") {
    glyph = `<g stroke="${tone}" stroke-width="2.6" fill="none">
      <rect x="${cx - g / 2 + 2}" y="${cy - g / 2}" width="${g - 4}" height="${g}" rx="3"/>
      <line x1="${cx - g / 2 + 8}" y1="${cy - g / 4}" x2="${cx + g / 2 - 8}" y2="${cy - g / 4}"/>
      <line x1="${cx - g / 2 + 8}" y1="${cy}" x2="${cx + g / 2 - 8}" y2="${cy}"/>
      <line x1="${cx - g / 2 + 8}" y1="${cy + g / 4}" x2="${cx + g / 4}" y2="${cy + g / 4}"/>
    </g>`;
  } else if (kind === "clock") {
    glyph = `<g stroke="${tone}" stroke-width="2.6" fill="none">
      <circle cx="${cx}" cy="${cy}" r="${g / 2}"/>
      <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - g / 4}"/>
      <line x1="${cx}" y1="${cy}" x2="${cx + g / 4}" y2="${cy}"/>
    </g>`;
  } else {
    glyph = pin(cx - g / 2, cy - g / 2 - 2, g + 4, tone);
  }
  return `<g><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.28}" fill="${ICON_BG}"/>${glyph}</g>`;
}

export interface SpeakerSession {
  dateLong: string;
  weekday: string;
  theme: string;
  timeLabel: string;
}

export interface CarouselCoverSlide {
  kind: "cover";
  headline: string;
  subline: string;
  dateLabel: string;
  location: string;
  stand: string;
  cta: string;
}

export interface CarouselSpeakerSlide {
  kind: "speaker";
  speakerName: string;
  photoDataUri?: string | null;
  sessions: SpeakerSession[];
}

export interface CarouselClosingSlide {
  kind: "closing";
  eventName: string;
  dateLabel: string;
  location: string;
  stand: string;
  tagline: string;
  keyword?: string;
}

export type CarouselSlide = CarouselCoverSlide | CarouselSpeakerSlide | CarouselClosingSlide;

interface Common {
  artDataUri: string;
  logoDataUri: string;
  eventLogoDataUri?: string | null;
}

function defs(W: number, H: number): string {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${NAVY_DEEP}"/>
    </linearGradient>
    <linearGradient id="photoFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${NAVY}" stop-opacity="0.05"/>
      <stop offset="0.55" stop-color="${NAVY}" stop-opacity="0.25"/>
      <stop offset="1" stop-color="${NAVY}" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="artToPaper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PAPER}" stop-opacity="0"/>
      <stop offset="0.62" stop-color="${PAPER}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${PAPER}" stop-opacity="1"/>
    </linearGradient>
    <clipPath id="frame"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath>
  </defs>`;
}

/** Logo Smart Dent no topo direito (branco por cima da arte). */
function brandTopRight(W: number, c: Common, y = 44, white = true): string {
  return `<image x="${W - 60 - 300}" y="${y}" width="300" height="66" preserveAspectRatio="xMaxYMid meet" xlink:href="${c.logoDataUri}"${white ? ' filter="url(#none)"' : ""}/>`;
}

function eventLogo(x: number, y: number, w: number, c: Common): string {
  return c.eventLogoDataUri
    ? `<image x="${x}" y="${y}" width="${w}" height="${w * 0.32}" preserveAspectRatio="xMinYMid meet" xlink:href="${c.eventLogoDataUri}"/>`
    : "";
}

/** Bloco de uma demonstração no card do palestrante. */
function demoBlock(x: number, y: number, w: number, index: number, s: SpeakerSession): { svg: string; height: number } {
  const themeLines = wrap(s.theme, 30, w - 110, 2);
  const iconX = x;
  const textX = x + 86;
  let cy = y;
  let out = `<text x="${x}" y="${cy}" font-family="Poppins" font-weight="700" font-size="23" fill="${BLUE_LIGHT}" letter-spacing="3">DEMONSTRAÇÃO ${index}</text>`;
  cy += 30;

  // Data
  out += iconBox(iconX, cy, 60, "cal");
  out += `<text x="${textX}" y="${cy + 26}" font-family="Poppins" font-weight="700" font-size="30" fill="${INK}">${esc(s.dateLong.toUpperCase())}</text>`;
  if (s.weekday) {
    out += `<text x="${textX}" y="${cy + 56}" font-family="Poppins" font-weight="400" font-size="25" fill="${INK_SOFT}">(${esc(s.weekday.toUpperCase())})</text>`;
  }
  cy += 84;

  // Tema
  out += iconBox(iconX, cy, 60, "doc");
  out += textBlock(themeLines, textX, cy + 26, 30, INK, 400, 1.25);
  cy += Math.max(74, 26 + themeLines.length * 38 + 12);

  // Horário
  out += iconBox(iconX, cy, 60, "clock");
  out += `<text x="${textX}" y="${cy + 40}" font-family="Poppins" font-weight="700" font-size="34" fill="${INK}">${esc(s.timeLabel)}</text>`;
  cy += 76;

  return { svg: `<g>${out}</g>`, height: cy - y };
}

export function buildCarouselSvg(slide: CarouselSlide, c: Common): { svg: string; width: number; height: number } {
  const { width: W, height: H } = CAROUSEL;
  let body = "";

  if (slide.kind === "cover") {
    const headSize = 84;
    const headLines = wrap(slide.headline.toUpperCase(), headSize, W - 200, 3);
    const subLines = wrap(slide.subline.toUpperCase(), 34, W - 220, 3);
    const ctaTop = H - 190;
    const logoY = ctaTop - 190;
    const standY = logoY - 190;
    const subBase = 470 + headLines.length * (headSize * 1.06) + 40;
    body = `
    <g clip-path="url(#frame)">
      <image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.artDataUri}"/>
      <rect width="${W}" height="${H}" fill="${NAVY_DEEP}" opacity="0.62"/>
      <rect width="${W}" height="${H}" fill="url(#photoFade)"/>
    </g>
    ${brandTopRight(W, c, 52)}
    ${textBlock(headLines, 90, 470, headSize, WHITE, 700, 1.06, 'letter-spacing="-2"')}
    ${textBlock(subLines, 90, subBase, 34, SOFT, 400, 1.35, 'letter-spacing="2"')}
    ${slide.stand ? `${pin(90, ${0} + ${standY}, 62, BLUE_LIGHT)}
    <text x="176" y="${standY + 26}" font-family="Poppins" font-weight="400" font-size="28" fill="${SOFT}" letter-spacing="4">ESTANDE</text>
    <text x="176" y="${standY + 78}" font-family="Poppins" font-weight="700" font-size="58" fill="${WHITE}">${esc(slide.stand)}</text>` : ""}
    ${eventLogo(90, logoY, 470, c)}
    <text x="90" y="${logoY + 176}" font-family="Poppins" font-weight="400" font-size="24" fill="${SOFT}" letter-spacing="3">${esc(slide.dateLabel.toUpperCase())}</text>
    <g>
      <rect x="90" y="${ctaTop}" width="620" height="96" rx="48" fill="${BLUE_LIGHT}"/>
      <text x="140" y="${ctaTop + 62}" font-family="Poppins" font-weight="700" font-size="38" fill="${WHITE}" letter-spacing="2">${esc(slide.cta.toUpperCase())}</text>
      <path d="M 610 ${ctaTop + 34} L 646 ${ctaTop + 48} L 610 ${ctaTop + 62} Z" fill="${WHITE}"/>
    </g>`;
  } else if (slide.kind === "speaker") {
    const artH = 560;
    const photoR = 132;
    const photoCx = 250;
    const photoCy = 400;
    const sessions = slide.sessions.slice(0, 3);
    let y = artH + 100;
    let blocks = "";
    sessions.forEach((s, i) => {
      if (i > 0) {
        blocks += `<line x1="90" y1="${y - 34}" x2="${W - 90}" y2="${y - 34}" stroke="${HAIR}" stroke-width="2"/>`;
      }
      const b = demoBlock(90, y, W - 180, i + 1, s);
      blocks += b.svg;
      y += b.height + 56;
    });
    const nameLines = wrap(slide.speakerName.toUpperCase(), 40, 520, 2);
    const pillW = Math.min(560, Math.max(...nameLines.map((l) => l.length)) * 24 + 80);
    const pillH = nameLines.length > 1 ? 132 : 84;
    body = `
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    <g clip-path="url(#frame)">
      <image x="0" y="0" width="${W}" height="${artH + 60}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.artDataUri}"/>
      <rect x="0" y="0" width="${W}" height="${artH + 60}" fill="url(#artToPaper)"/>
    </g>
    ${brandTopRight(W, c, 46)}
    <defs><clipPath id="spPhoto"><circle cx="${photoCx}" cy="${photoCy}" r="${photoR}"/></clipPath></defs>
    <circle cx="${photoCx}" cy="${photoCy}" r="${photoR + 7}" fill="${WHITE}"/>
    ${slide.photoDataUri
      ? `<g clip-path="url(#spPhoto)"><image x="${photoCx - photoR}" y="${photoCy - photoR}" width="${photoR * 2}" height="${photoR * 2}" preserveAspectRatio="xMidYMin slice" xlink:href="${slide.photoDataUri}"/></g>`
      : `<circle cx="${photoCx}" cy="${photoCy}" r="${photoR}" fill="${CARD}"/>`}
    <g>
      <rect x="${photoCx + photoR + 34}" y="${photoCy - pillH / 2}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${INK}"/>
      ${textBlock(nameLines, photoCx + photoR + 34 + 40, photoCy - pillH / 2 + (nameLines.length > 1 ? 54 : 55), 40, WHITE, 700, 1.15, 'letter-spacing="2"')}
    </g>
    ${blocks}
    ${eventLogo(90, H - 150, 420, c)}
    <text x="${W - 90}" y="${H - 96}" text-anchor="end" font-family="Poppins" font-weight="700" font-size="30" fill="${INK_SOFT}">${esc(slide.dateLabel || "")}</text>`;
  } else {
    const nameLines = wrap(slide.eventName.toUpperCase(), 92, W - 200, 3);
    const nameBase = 470;
    let y = nameBase + nameLines.length * 100 + 60;
    body = `
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    <g clip-path="url(#frame)">
      <image x="0" y="0" width="${W}" height="${620}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.artDataUri}"/>
      <rect x="0" y="0" width="${W}" height="${620}" fill="url(#artToPaper)"/>
    </g>
    ${brandTopRight(W, c, 46)}
    <text x="90" y="${nameBase - 70}" font-family="Poppins" font-weight="400" font-size="34" fill="${INK_SOFT}" letter-spacing="4">ESTAREMOS PRESENTES NA</text>
    ${textBlock(nameLines, 90, nameBase, 92, INK, 700, 1.08, 'letter-spacing="-2"')}
    ${iconBox(90, y, 64, "cal")}
    <text x="176" y="${y + 42}" font-family="Poppins" font-weight="700" font-size="34" fill="${INK}">${esc(slide.dateLabel.toUpperCase())}</text>
    ${iconBox(90, y + 104, 64, "pin")}
    ${textBlock(wrap(slide.location, 32, W - 420, 2), 176, y + 146, 32, INK, 400, 1.3)}
    ${slide.stand
      ? `<rect x="${W - 90 - 260}" y="${y + 96}" width="260" height="112" rx="18" fill="none" stroke="${INK}" stroke-width="3"/>
    <text x="${W - 90 - 130}" y="${y + 138}" text-anchor="middle" font-family="Poppins" font-weight="400" font-size="24" fill="${INK_SOFT}" letter-spacing="4">ESTANDE</text>
    <text x="${W - 90 - 130}" y="${y + 188}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="46" fill="${INK}">${esc(slide.stand)}</text>`
      : ""}
    ${eventLogo(90, y + 250, 440, c)}
    ${slide.keyword
      ? `<g><rect x="90" y="${H - 300}" width="${W - 180}" height="92" rx="46" fill="${ORANGE}"/>
      <text x="${W / 2}" y="${H - 240}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="34" fill="${WHITE}" letter-spacing="2">COMENTE ${esc(slide.keyword.toUpperCase())} E RECEBA A AGENDA</text></g>`
      : ""}
    ${textBlock(wrap(slide.tagline.toUpperCase(), 44, W - 200, 2), 90, H - 140, 44, INK, 700, 1.12, 'letter-spacing="-1"')}`;
  }

  return {
    width: W,
    height: H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${defs(W, H)}
${body}
</svg>`,
  };
}

export interface StoryInput extends Common {
  speakerName: string;
  specialty: string;
  photoDataUri?: string | null;
  sessions: SpeakerSession[];
  eventName: string;
  location: string;
  stand: string;
}

export function buildStorySvg(input: StoryInput): { svg: string; width: number; height: number } {
  const { width: W, height: H } = STORY;
  const artH = 900;
  const photoR = 190;
  const photoCx = W / 2;
  const photoCy = 640;

  let y = artH + 190;
  let blocks = "";
  input.sessions.slice(0, 3).forEach((s, i) => {
    if (i > 0) blocks += `<line x1="90" y1="${y - 38}" x2="${W - 90}" y2="${y - 38}" stroke="${HAIR}" stroke-width="2"/>`;
    const b = demoBlock(90, y, W - 180, i + 1, s);
    blocks += b.svg;
    y += b.height + 60;
  });

  const nameLines = wrap(input.speakerName.toUpperCase(), 62, W - 240, 2);
  const footLine = [input.location, input.stand ? `Estande ${input.stand}` : ""].filter(Boolean).join("  |  ");

  return {
    width: W,
    height: H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${defs(W, H)}
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <g clip-path="url(#frame)">
    <image x="0" y="0" width="${W}" height="${artH}" preserveAspectRatio="xMidYMid slice" xlink:href="${input.artDataUri}"/>
    <rect x="0" y="0" width="${W}" height="${artH}" fill="url(#artToPaper)"/>
  </g>
  ${brandTopRight(W, input, 60)}
  <defs><clipPath id="stPhoto"><circle cx="${photoCx}" cy="${photoCy}" r="${photoR}"/></clipPath></defs>
  <circle cx="${photoCx}" cy="${photoCy}" r="${photoR + 9}" fill="${WHITE}"/>
  ${input.photoDataUri
    ? `<g clip-path="url(#stPhoto)"><image x="${photoCx - photoR}" y="${photoCy - photoR}" width="${photoR * 2}" height="${photoR * 2}" preserveAspectRatio="xMidYMin slice" xlink:href="${input.photoDataUri}"/></g>`
    : `<circle cx="${photoCx}" cy="${photoCy}" r="${photoR}" fill="${CARD}"/>`}
  ${textBlock(nameLines, W / 2, photoCy + photoR + 90, 62, INK, 700, 1.1, 'text-anchor="middle" letter-spacing="-1"')}
  <text x="${W / 2}" y="${photoCy + photoR + 90 + nameLines.length * 68 + 6}" text-anchor="middle" font-family="Poppins" font-weight="400" font-size="34" fill="${BLUE_LIGHT}" letter-spacing="3">${esc(input.specialty.toUpperCase())}</text>
  ${blocks}
  ${pin(90, H - 190, 46, BLUE_LIGHT)}
  <text x="156" y="${H - 152}" font-family="Poppins" font-weight="700" font-size="34" fill="${INK}">${esc(footLine)}</text>
  <text x="156" y="${H - 100}" font-family="Poppins" font-weight="400" font-size="30" fill="${INK_SOFT}">${esc(input.eventName)}</text>
</svg>`,
  };
}
