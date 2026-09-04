// Composição gráfica das artes de divulgação de eventos.
// Layout espelhando o padrão aprovado (capa do congresso + story por palestrante).
// A ARTE ENVIADA no cadastro do evento é usada como pixels originais
// (apenas crop/escala via preserveAspectRatio="slice"); as fotos dos
// palestrantes e o logo Smart Dent são arquivos originais aplicados.
// Nada aqui é gerado ou redesenhado por IA.

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
  weight: 400 | 600 | 700,
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

export interface SessionItem {
  timeLabel: string;
  theme: string;
  speakerName: string;
  photoDataUri?: string | null;
}

export interface CarouselDaySlide {
  kind: "day";
  dayLabel: string;
  sessions: SessionItem[];
}

export interface CarouselCoverSlide {
  kind: "cover";
  eventName: string;
  dateLabel: string;
  location: string;
  stand: string;
}

export interface CarouselCtaSlide {
  kind: "cta";
  keyword: string;
  eventName: string;
}

export type CarouselSlide = CarouselCoverSlide | CarouselDaySlide | CarouselCtaSlide;

interface Common {
  artDataUri: string;
  logoDataUri: string;
  eventLogoDataUri?: string | null;
}

/** Fundo + moldura interna + rodapé fino, comum a todas as peças. */
function shell(W: number, H: number): string {
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
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="30" y="30" width="${W - 60}" height="${H - 60}" rx="26" fill="none" stroke="${LINE}" stroke-width="3"/>`;
}

/** Cabeçalho: logo do evento à esquerda, Smart Dent à direita (capa) ou invertido. */
function header(W: number, c: Common, y: number, brandLeft: boolean): string {
  const brand = `<image x="${brandLeft ? 76 : W - 76 - 280}" y="${y}" width="280" height="62" preserveAspectRatio="${brandLeft ? "xMinYMid" : "xMaxYMid"} meet" xlink:href="${c.logoDataUri}"/>`;
  const evt = c.eventLogoDataUri
    ? `<image x="${brandLeft ? W - 76 - 300 : 76}" y="${y - 12}" width="300" height="92" preserveAspectRatio="${brandLeft ? "xMaxYMid" : "xMinYMid"} meet" xlink:href="${c.eventLogoDataUri}"/>`
    : "";
  return brand + evt;
}

function infoBoxes(W: number, y: number, location: string, stand: string): string {
  const locLines = wrap(location, 30, 480, 2);
  const standW = stand ? 250 : 0;
  const boxW = W - 152 - (standW ? standW + 24 : 0);
  return `
  <g>
    <rect x="76" y="${y}" width="${boxW}" height="118" rx="18" fill="${CARD}" stroke="${LINE}" stroke-width="2"/>
    ${pin(112, y + 34, 46, BLUE_LIGHT)}
    ${textBlock(locLines, 178, y + (locLines.length > 1 ? 52 : 70), 30, WHITE, 400, 1.35)}
  </g>
  ${
    stand
      ? `<g>
    <rect x="${W - 76 - standW}" y="${y}" width="${standW}" height="118" rx="18" fill="${CARD}" stroke="${ORANGE}" stroke-width="3"/>
    <text x="${W - 76 - standW / 2}" y="${y + 46}" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="24" fill="${SOFT}" letter-spacing="4">ESTANDE</text>
    <text x="${W - 76 - standW / 2}" y="${y + 94}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="46" fill="${WHITE}">${esc(stand)}</text>
  </g>`
      : ""
  }`;
}

function sessionCard(
  x: number,
  y: number,
  w: number,
  index: number,
  timeLabel: string,
  theme: string,
  speakerName?: string,
): string {
  const themeLines = wrap(theme, 32, w - 200, 2);
  const h = 60 + (speakerName ? 44 : 0) + themeLines.length * 44 + 44;
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${CARD}" stroke="${LINE}" stroke-width="2"/>
    <rect x="${x}" y="${y}" width="8" height="${h}" rx="4" fill="${ORANGE}"/>
    <g>
      <rect x="${x + 30}" y="${y + 26}" width="230" height="52" rx="12" fill="${BLUE_LIGHT}"/>
      <text x="${x + 145}" y="${y + 62}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="28" fill="${WHITE}">Hands-on ${index}</text>
    </g>
    <text x="${x + 286}" y="${y + 64}" font-family="Poppins" font-weight="700" font-size="34" fill="${WHITE}">${esc(timeLabel)}</text>
    ${speakerName ? `<text x="${x + 30}" y="${y + 118}" font-family="Poppins" font-weight="700" font-size="32" fill="${BLUE_LIGHT}">${esc(speakerName.toUpperCase())}</text>` : ""}
    ${textBlock(themeLines, x + 30, y + (speakerName ? 166 : 122), 32, SOFT, 400, 1.35)}
  </g>`;
}

function cardHeight(theme: string, w: number, withSpeaker: boolean): number {
  const lines = wrap(theme, 32, w - 200, 2).length;
  return 60 + (withSpeaker ? 44 : 0) + lines * 44 + 44;
}

export function buildCarouselSvg(slide: CarouselSlide, c: Common): { svg: string; width: number; height: number } {
  const { width: W, height: H } = CAROUSEL;
  let body = "";

  if (slide.kind === "cover") {
    const artY = 292;
    const artH = 340;
    const headSize = 62;
    const headLines = wrap("ODONTOLOGIA DIGITAL AO VIVO", headSize, W - 152, 2);
    const ctaTop = H - 148;
    const microY = ctaTop - 52;
    const dividerY = microY - 42;
    const infoY = dividerY - 142;
    const tagY = infoY - 40;
    const headBottom = tagY - 96;
    const headBase = headBottom - (headLines.length - 1) * (headSize * 1.1);
    body = `
    ${header(W, c, 78, false)}
    <g>
      <rect x="76" y="188" width="${W - 152}" height="84" rx="42" fill="${BLUE_LIGHT}"/>
      <text x="${W / 2}" y="${244}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="36" fill="${WHITE}" letter-spacing="2">${esc(slide.dateLabel.toUpperCase())}</text>
    </g>
    <defs><clipPath id="artClip"><rect x="76" y="${artY}" width="${W - 152}" height="${artH}" rx="22"/></clipPath></defs>
    <g clip-path="url(#artClip)">
      <image x="76" y="${artY}" width="${W - 152}" height="${artH}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.artDataUri}"/>
      <rect x="76" y="${artY}" width="${W - 152}" height="${artH}" fill="url(#photoFade)"/>
    </g>
    ${textBlock(headLines, 76, headBase, headSize, WHITE, 700, 1.1, 'letter-spacing="-1"')}
    <text x="76" y="${tagY - 44}" font-family="Poppins" font-weight="600" font-size="29" fill="${BLUE_LIGHT}" letter-spacing="1">HANDS-ON · DEMONSTRAÇÕES</text>
    <text x="76" y="${tagY}" font-family="Poppins" font-weight="600" font-size="29" fill="${BLUE_LIGHT}" letter-spacing="1">PALESTRANTES · SOLUÇÕES REAIS</text>
    ${infoBoxes(W, infoY, slide.location, slide.stand)}
    <line x1="76" y1="${dividerY}" x2="${W - 76}" y2="${dividerY}" stroke="${LINE}" stroke-width="2"/>
    <text x="${W / 2}" y="${microY}" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="24" fill="${SOFT}" letter-spacing="4">CONHECIMENTO · PRÁTICA · PESSOAS · SOLUÇÕES</text>
    <g>
      <rect x="${W / 2 - 320}" y="${ctaTop}" width="640" height="84" rx="42" fill="none" stroke="${BLUE_LIGHT}" stroke-width="3"/>
      <text x="${W / 2 - 24}" y="${ctaTop + 54}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="27" fill="${WHITE}" letter-spacing="2">VEJA O CRONOGRAMA DE HANDS-ON</text>
      <text x="${W / 2 + 272}" y="${ctaTop + 56}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="32" fill="${BLUE_LIGHT}">→</text>
    </g>`;
  } else if (slide.kind === "day") {

    const artY = 180;
    const artH = 250;
    const rows = slide.sessions.slice(0, 4);
    let y = artY + artH + 176;
    const cards = rows
      .map((s, i) => {
        const card = sessionCard(76, y, W - 152, i + 1, s.timeLabel, s.theme, s.speakerName);
        y += cardHeight(s.theme, W - 152, true) + 24;
        return card;
      })
      .join("");
    body = `
    ${header(W, c, 78, true)}
    <defs><clipPath id="artClipDay"><rect x="76" y="${artY}" width="${W - 152}" height="${artH}" rx="22"/></clipPath></defs>
    <g clip-path="url(#artClipDay)">
      <image x="76" y="${artY}" width="${W - 152}" height="${artH}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.artDataUri}"/>
      <rect x="76" y="${artY}" width="${W - 152}" height="${artH}" fill="url(#photoFade)"/>
    </g>
    <text x="76" y="${artY + artH + 70}" font-family="Poppins" font-weight="600" font-size="28" fill="${BLUE_LIGHT}" letter-spacing="5">AGENDA DE HANDS-ON</text>
    <text x="76" y="${artY + artH + 138}" font-family="Poppins" font-weight="700" font-size="66" fill="${WHITE}">${esc(slide.dayLabel.toUpperCase())}</text>
    ${cards}`;
  } else {
    const kw = slide.keyword.toUpperCase();
    const kwW = Math.max(420, kw.length * 66 + 120);
    body = `
    <defs><clipPath id="artClipCta"><rect x="30" y="30" width="${W - 60}" height="${H - 60}" rx="26"/></clipPath></defs>
    <g clip-path="url(#artClipCta)">
      <image x="30" y="30" width="${W - 60}" height="${H - 60}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.artDataUri}" opacity="0.5"/>
      <rect x="30" y="30" width="${W - 60}" height="${H - 60}" fill="${NAVY}" opacity="0.8"/>
    </g>
    <rect x="30" y="30" width="${W - 60}" height="${H - 60}" rx="26" fill="none" stroke="${LINE}" stroke-width="3"/>
    ${header(W, c, 78, true)}
    <text x="${W / 2}" y="${H / 2 - 220}" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="34" fill="${BLUE_LIGHT}" letter-spacing="4">QUER O CRONOGRAMA COMPLETO?</text>
    <text x="${W / 2}" y="${H / 2 - 110}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="64" fill="${WHITE}">COMENTE</text>
    <g>
      <rect x="${(W - kwW) / 2}" y="${H / 2 - 60}" width="${kwW}" height="150" rx="24" fill="${ORANGE}"/>
      <text x="${W / 2}" y="${H / 2 + 44}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="92" fill="${WHITE}" letter-spacing="4">${esc(kw)}</text>
    </g>
    <text x="${W / 2}" y="${H / 2 + 184}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="46" fill="${WHITE}">E RECEBA MAIS INFORMAÇÕES</text>
    ${textBlock(wrap(slide.eventName, 32, W - 240, 2), 76, H - 150, 32, SOFT, 400, 1.3)}`;
  }

  return {
    width: W,
    height: H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${shell(W, H)}
${body}
</svg>`,
  };
}

export interface StoryInput extends Common {
  speakerName: string;
  specialty: string;
  photoDataUri?: string | null;
  sessions: Array<{ dayLabel: string; timeLabel: string; theme: string }>;
  eventName: string;
  location: string;
  stand: string;
}

export function buildStorySvg(input: StoryInput): { svg: string; width: number; height: number } {
  const { width: W, height: H } = STORY;
  const photoX = 70;
  const photoY = 230;
  const photoW = W - 140;
  const photoH = 880;

  const nameSize = 76;
  const nameLines = wrap(input.speakerName.toUpperCase(), nameSize, photoW - 100, 2);
  const nameBase = photoY + photoH - 130 - (nameLines.length - 1) * (nameSize * 1.05);

  let y = photoY + photoH + 84;
  const cards = input.sessions
    .slice(0, 3)
    .map((s, i) => {
      const label = `${s.dayLabel} · ${s.timeLabel}`;
      const card = sessionCard(photoX, y, photoW, i + 1, label, s.theme);
      y += cardHeight(s.theme, photoW, false) + 26;
      return card;
    })
    .join("");

  const footLine = [input.location, input.stand ? `Estande ${input.stand}` : ""].filter(Boolean).join("  |  ");

  return {
    width: W,
    height: H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${shell(W, H)}
  <defs>
    <clipPath id="photoClip"><rect x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" rx="26"/></clipPath>
  </defs>
  ${header(W, input, 96, true)}

  <g clip-path="url(#photoClip)">
    <image x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" preserveAspectRatio="xMidYMid slice" xlink:href="${input.artDataUri}"/>
    ${input.photoDataUri ? `<image x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" preserveAspectRatio="xMidYMin slice" xlink:href="${input.photoDataUri}"/>` : ""}
    <rect x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" fill="url(#photoFade)"/>
    ${textBlock(nameLines, photoX + 44, nameBase, nameSize, WHITE, 700, 1.05, 'letter-spacing="-1"')}
    <text x="${photoX + 44}" y="${photoY + photoH - 56}" font-family="Poppins" font-weight="600" font-size="38" fill="${BLUE_LIGHT}" letter-spacing="2">${esc(input.specialty.toUpperCase())}</text>
  </g>
  <rect x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" rx="26" fill="none" stroke="${LINE}" stroke-width="2"/>

  ${cards}

  ${pin(photoX + 6, H - 178, 40, BLUE_LIGHT)}
  <text x="${photoX + 62}" y="${H - 146}" font-family="Poppins" font-weight="700" font-size="34" fill="${WHITE}">${esc(footLine)}</text>
  <text x="${photoX + 62}" y="${H - 96}" font-family="Poppins" font-weight="400" font-size="30" fill="${SOFT}">${esc(input.eventName)}</text>
</svg>`,
  };
}
