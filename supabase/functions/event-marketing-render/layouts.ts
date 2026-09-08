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
const FONT = "Arial, Helvetica, sans-serif";

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const perChar = fontSize * 0.6;
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

/** Reduz o corpo do texto até caber por completo na largura/linhas dadas. */
function fit(
  text: string,
  maxWidth: number,
  maxLines: number,
  size: number,
  min: number,
): { lines: string[]; size: number } {
  let s = size;
  while (s > min) {
    const lines = wrap(text, s, maxWidth, maxLines);
    const joined = lines.join(" ").replace(/\s+/g, " ").trim();
    const source = String(text || "").replace(/\s+/g, " ").trim();
    const fitsWidth = lines.every((l) => l.length * s * 0.6 <= maxWidth);
    if (fitsWidth && joined.length >= source.length) return { lines, size: s };
    s -= 2;
  }
  return { lines: wrap(text, min, maxWidth, maxLines), size: min };
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
        `<text x="${x}" y="${y + i * (size * lineHeight)}" font-family="${FONT}" font-weight="${weight}" font-size="${size}" fill="${fill}" ${extra}>${esc(l)}</text>`,
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
  dateLabel?: string;
  speakerName: string;
  photoDataUri?: string | null;
  /** Imagem da aula enviada no editor: entra como hero atrás da foto. */
  heroDataUri?: string | null;
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
  void white;
  return `<image x="${W - 60 - 300}" y="${y}" width="300" height="66" preserveAspectRatio="xMaxYMid meet" xlink:href="${c.logoDataUri}"/>`;
}

function eventLogo(x: number, y: number, w: number, c: Common): string {
  return c.eventLogoDataUri
    ? `<image x="${x}" y="${y}" width="${w}" height="${w * 0.32}" preserveAspectRatio="xMinYMid meet" xlink:href="${c.eventLogoDataUri}"/>`
    : "";
}

/** Bloco de uma demonstração no card do palestrante. `k` = escala (0.6–1). */
function demoBlock(
  x: number,
  y: number,
  w: number,
  index: number,
  s: SpeakerSession,
  k = 1,
): { svg: string; height: number } {
  const labelSize = Math.round(22 * k);
  const dateSize = Math.round(29 * k);
  const detailSize = Math.round(28 * k);
  const timeSize = Math.round(32 * k);
  const iconSize = Math.round(56 * k);
  const gap = Math.round(20 * k);
  const textX = x + iconSize + gap;
  const textW = w - iconSize - gap;
  const theme = fit(s.theme, textW, 2, detailSize, Math.round(17 * k));
  let cy = y;
  let out = `<text x="${x}" y="${cy}" font-family="${FONT}" font-weight="700" font-size="${labelSize}" fill="${BLUE_LIGHT}" letter-spacing="2">DEMONSTRAÇÃO ${index}</text>`;
  cy += Math.round(26 * k);

  // Data
  out += iconBox(x, cy, iconSize, "cal");
  const dateFit = fit(s.dateLong.toUpperCase(), textW, 1, dateSize, Math.round(19 * k));
  out += `<text x="${textX}" y="${cy + Math.round(iconSize * 0.44)}" font-family="${FONT}" font-weight="700" font-size="${dateFit.size}" fill="${INK}">${esc(dateFit.lines[0] || "")}</text>`;
  if (s.weekday) {
    out += `<text x="${textX}" y="${cy + Math.round(iconSize * 0.92)}" font-family="${FONT}" font-weight="400" font-size="${Math.round(22 * k)}" fill="${INK_SOFT}">(${esc(s.weekday.toUpperCase())})</text>`;
  }
  cy += iconSize + Math.round(18 * k);

  // Tema
  if (theme.lines.length) {
    out += iconBox(x, cy, iconSize, "doc");
    out += textBlock(theme.lines, textX, cy + Math.round(theme.size * 1.05), theme.size, INK, 400, 1.2);
    cy += Math.max(iconSize, Math.round(theme.lines.length * theme.size * 1.2)) + Math.round(16 * k);
  }

  // Horário
  out += iconBox(x, cy, iconSize, "clock");
  out += `<text x="${textX}" y="${cy + Math.round(iconSize * 0.66)}" font-family="${FONT}" font-weight="700" font-size="${timeSize}" fill="${INK}">${esc(s.timeLabel)}</text>`;
  cy += iconSize;

  return { svg: `<g>${out}</g>`, height: cy - y };
}

/** Empilha as demonstrações com a maior escala que couber no espaço disponível. */
function stackDemos(
  x: number,
  top: number,
  w: number,
  sessions: SpeakerSession[],
  available: number,
): string {
  for (let k = 1; k >= 0.58; k -= 0.04) {
    let y = top;
    let out = "";
    sessions.forEach((s, i) => {
      if (i > 0) {
        out += `<line x1="${x}" y1="${y - Math.round(18 * k)}" x2="${x + w}" y2="${y - Math.round(18 * k)}" stroke="${HAIR}" stroke-width="2"/>`;
      }
      const b = demoBlock(x, y, w, i + 1, s, k);
      out += b.svg;
      y += b.height + Math.round(40 * k);
    });
    if (y - top - Math.round(40 * k) <= available || k <= 0.6) return out;
  }
  return "";
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
    ${slide.stand ? `${pin(90, standY, 62, BLUE_LIGHT)}
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
    const artH = 500;
    const photoR = 118;
    const photoCx = 220;
    const photoCy = 340;
    const sessions = slide.sessions.slice(0, 3);
    const compact = sessions.length >= 3;
    let y = artH + 58;
    let blocks = "";
    sessions.forEach((s, i) => {
      if (i > 0) {
        blocks += `<line x1="72" y1="${y - (compact ? 17 : 24)}" x2="${W - 72}" y2="${y - (compact ? 17 : 24)}" stroke="${HAIR}" stroke-width="2"/>`;
      }
      const b = demoBlock(72, y, W - 144, i + 1, s, compact);
      blocks += b.svg;
      y += b.height + (compact ? 28 : 40);
    });
    const nameLines = wrap(slide.speakerName.toUpperCase(), 38, 560, 2);
    const pillW = 610;
    const pillH = nameLines.length > 1 ? 116 : 78;
    body = `
    <g clip-path="url(#frame)">
      <image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.artDataUri}"/>
      <rect width="${W}" height="${H}" fill="${PAPER}"/>
      <image x="0" y="0" width="${W}" height="${artH}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.artDataUri}"/>
      <rect x="0" y="0" width="${W}" height="${artH}" fill="${NAVY_DEEP}" opacity="0.9"/>
      <rect x="0" y="${artH - 92}" width="${W}" height="92" fill="url(#artToPaper)"/>
    </g>
    ${brandTopRight(W, c, 46)}
    <defs><clipPath id="spPhoto"><circle cx="${photoCx}" cy="${photoCy}" r="${photoR}"/></clipPath></defs>
    <circle cx="${photoCx}" cy="${photoCy}" r="${photoR + 7}" fill="${WHITE}"/>
    ${slide.photoDataUri
      ? `<g clip-path="url(#spPhoto)"><image x="${photoCx - photoR}" y="${photoCy - photoR}" width="${photoR * 2}" height="${photoR * 2}" preserveAspectRatio="xMidYMin slice" xlink:href="${slide.photoDataUri}"/></g>`
      : `<circle cx="${photoCx}" cy="${photoCy}" r="${photoR}" fill="${CARD}"/>`}
    <g>
      <rect x="${photoCx + photoR + 30}" y="${photoCy - pillH / 2}" width="${pillW}" height="${pillH}" rx="18" fill="${INK}"/>
      ${textBlock(nameLines, photoCx + photoR + 30 + 34, photoCy - pillH / 2 + (nameLines.length > 1 ? 47 : 51), 38, WHITE, 700, 1.12, 'letter-spacing="1"')}
    </g>
    ${blocks}
    <rect x="0" y="${H - 104}" width="${W}" height="104" fill="${WHITE}"/>
    ${eventLogo(72, H - 91, 300, c)}
    <text x="${W - 72}" y="${H - 44}" text-anchor="end" font-family="${FONT}" font-weight="700" font-size="27" fill="${INK_SOFT}">${esc(slide.dateLabel || "")}</text>`;
  } else {
    const nameLines = wrap(slide.eventName.toUpperCase(), 92, W - 200, 3);
    const nameBase = 470;
    let y = nameBase + nameLines.length * 100 + 60;
    body = `
    <g clip-path="url(#frame)">
      <image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.artDataUri}"/>
      <rect width="${W}" height="${H}" fill="${PAPER}" opacity="0.93"/>
      <image x="0" y="0" width="${W}" height="${620}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.artDataUri}"/>
      <rect x="0" y="0" width="${W}" height="${620}" fill="url(#artToPaper)"/>
    </g>
    ${brandTopRight(W, c, 46)}
    <text x="90" y="${nameBase - 70}" font-family="Poppins" font-weight="400" font-size="34" fill="${INK_SOFT}" letter-spacing="4">ESTAREMOS PRESENTES NA</text>
    ${textBlock(nameLines, 90, nameBase, 92, INK, 700, 1.08, 'letter-spacing="-2"')}
    ${iconBox(90, y, 64, "cal")}
    <text x="176" y="${y + 42}" font-family="Poppins" font-weight="700" font-size="34" fill="${INK}">${esc(slide.dateLabel.toUpperCase())}</text>
    ${iconBox(90, y + 104, 64, "pin")}
    ${textBlock(wrap(slide.location, 32, W - 480, 2), 176, y + 146, 32, INK, 400, 1.3)}
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
  const artH = 740;
  const photoR = 158;
  const photoCx = W / 2;
  const photoCy = 500;
  const sessions = input.sessions.slice(0, 3);
  const footH = 210;

  const name = fit(input.speakerName.toUpperCase(), W - 200, 2, 56, 36);
  const nameY = artH + 96;
  const specialty = fit(input.specialty || "", W - 200, 2, 30, 22);
  const specialtyY = nameY + name.lines.length * (name.size * 1.1) + 18;
  const blocksTop = specialtyY + specialty.lines.length * (specialty.size * 1.25) + 46;
  const available = H - footH - 40 - blocksTop;

  function layout(compact: boolean): { svg: string; end: number } {
    let y = blocksTop;
    let out = "";
    sessions.forEach((s, i) => {
      if (i > 0) {
        out += `<line x1="72" y1="${y - (compact ? 16 : 22)}" x2="${W - 72}" y2="${y - (compact ? 16 : 22)}" stroke="${HAIR}" stroke-width="2"/>`;
      }
      const b = demoBlock(72, y, W - 144, i + 1, s, compact);
      out += b.svg;
      y += b.height + (compact ? 30 : 46);
    });
    return { svg: out, end: y - blocksTop };
  }

  let built = layout(false);
  if (built.end > available) built = layout(true);

  const footLine = fit(
    [input.location, input.stand ? `Estande ${input.stand}` : ""].filter(Boolean).join("  |  "),
    W - 250,
    1,
    32,
    22,
  );
  const eventLine = fit(input.eventName, W - 250, 2, 27, 20);

  return {
    width: W,
    height: H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${defs(W, H)}
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <g clip-path="url(#frame)">
    <image x="0" y="0" width="${W}" height="${artH}" preserveAspectRatio="xMidYMid slice" xlink:href="${input.artDataUri}"/>
    <rect x="0" y="0" width="${W}" height="${artH}" fill="${NAVY_DEEP}" opacity="0.88"/>
    <rect x="0" y="${artH - 120}" width="${W}" height="120" fill="url(#artToPaper)"/>
  </g>
  <rect x="0" y="${artH}" width="${W}" height="${H - artH}" fill="${PAPER}"/>
  ${brandTopRight(W, input, 60)}
  <defs><clipPath id="stPhoto"><circle cx="${photoCx}" cy="${photoCy}" r="${photoR}"/></clipPath></defs>
  <circle cx="${photoCx}" cy="${photoCy}" r="${photoR + 9}" fill="${WHITE}"/>
  ${input.photoDataUri
    ? `<g clip-path="url(#stPhoto)"><image x="${photoCx - photoR}" y="${photoCy - photoR}" width="${photoR * 2}" height="${photoR * 2}" preserveAspectRatio="xMidYMin slice" xlink:href="${input.photoDataUri}"/></g>`
    : `<circle cx="${photoCx}" cy="${photoCy}" r="${photoR}" fill="${CARD}"/>`}
  ${textBlock(name.lines, W / 2, nameY, name.size, INK, 700, 1.1, 'text-anchor="middle"')}
  ${specialty.lines.length
    ? textBlock(specialty.lines, W / 2, specialtyY, specialty.size, BLUE_LIGHT, 400, 1.25, 'text-anchor="middle" letter-spacing="1"')
    : ""}
  ${built.svg}
  <rect x="0" y="${H - footH}" width="${W}" height="${footH}" fill="${WHITE}"/>
  ${pin(90, H - footH + 34, 46, BLUE_LIGHT)}
  ${textBlock(footLine.lines, 156, H - footH + 72, footLine.size, INK, 700, 1.15)}
  ${textBlock(eventLine.lines, 156, H - footH + 122, eventLine.size, INK_SOFT, 400, 1.25)}
</svg>`,
  };
}
