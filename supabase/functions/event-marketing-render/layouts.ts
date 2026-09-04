// Composição gráfica das artes de divulgação de eventos.
// A ARTE ENVIADA no cadastro do evento é usada como pixels originais
// (apenas crop/escala via preserveAspectRatio="slice"); as fotos dos
// palestrantes e o logo Smart Dent são arquivos originais aplicados.
// Nada aqui é gerado ou redesenhado por IA.

export const CAROUSEL = { width: 1080, height: 1350 };
export const STORY = { width: 1080, height: 1920 };

const BLUE = "#0A2A5E";
const BLUE_LIGHT = "#2FA8E0";
const ORANGE = "#E8821A";
const WHITE = "#FFFFFF";
const SOFT = "#CFE3F5";

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
): string {
  return lines
    .map(
      (l, i) =>
        `<text x="${x}" y="${y + i * (size * lineHeight)}" font-family="Poppins" font-weight="${weight}" font-size="${size}" fill="${fill}">${esc(l)}</text>`,
    )
    .join("");
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

function chrome(W: number, H: number, c: Common, artHeight: number): string {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BLUE}"/>
      <stop offset="1" stop-color="#061A3B"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BLUE}" stop-opacity="0.35"/>
      <stop offset="0.45" stop-color="${BLUE}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${BLUE}" stop-opacity="1"/>
    </linearGradient>
    <clipPath id="artClip"><rect x="0" y="0" width="${W}" height="${artHeight}"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g clip-path="url(#artClip)">
    <image x="0" y="0" width="${W}" height="${artHeight}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.artDataUri}"/>
  </g>
  <rect x="0" y="0" width="${W}" height="${artHeight}" fill="url(#scrim)"/>
  <image x="56" y="52" width="300" height="64" preserveAspectRatio="xMinYMid meet" xlink:href="${c.logoDataUri}"/>
  ${c.eventLogoDataUri ? `<image x="${W - 56 - 260}" y="46" width="260" height="76" preserveAspectRatio="xMaxYMid meet" xlink:href="${c.eventLogoDataUri}"/>` : ""}
  <rect x="0" y="${H - 10}" width="${W}" height="10" fill="${BLUE_LIGHT}"/>`;
}

function avatar(id: string, x: number, y: number, size: number, dataUri?: string | null): string {
  const r = size / 2;
  if (!dataUri) {
    return `<circle cx="${x + r}" cy="${y + r}" r="${r}" fill="#12315F" stroke="${BLUE_LIGHT}" stroke-width="4"/>`;
  }
  return `<defs><clipPath id="${id}"><circle cx="${x + r}" cy="${y + r}" r="${r}"/></clipPath></defs>
  <image x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})" xlink:href="${dataUri}"/>
  <circle cx="${x + r}" cy="${y + r}" r="${r - 2}" fill="none" stroke="${BLUE_LIGHT}" stroke-width="4"/>`;
}

export function buildCarouselSvg(slide: CarouselSlide, c: Common): { svg: string; width: number; height: number } {
  const { width: W, height: H } = CAROUSEL;
  let body = "";
  let artH = Math.round(H * 0.52);

  if (slide.kind === "cover") {
    artH = H;
    const nameLines = wrap(slide.eventName.toUpperCase(), 78, W - 112, 3);
    body = `
    <text x="56" y="${H - 470}" font-family="Poppins" font-weight="600" font-size="34" fill="${BLUE_LIGHT}" letter-spacing="4">ODONTOLOGIA DIGITAL AO VIVO</text>
    ${textBlock(nameLines, 56, H - 380, 78, WHITE, 700, 1.1)}
    <g><rect x="56" y="${H - 300 + nameLines.length * 78 * 0.1}" width="440" height="76" rx="14" fill="${ORANGE}"/>
    <text x="276" y="${H - 250 + nameLines.length * 78 * 0.1}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="36" fill="${WHITE}">${esc(slide.dateLabel)}</text></g>
    <text x="56" y="${H - 150}" font-family="Poppins" font-weight="400" font-size="36" fill="${SOFT}">${esc(slide.location)}</text>
    ${slide.stand ? `<text x="56" y="${H - 96}" font-family="Poppins" font-weight="700" font-size="38" fill="${WHITE}">ESTANDE ${esc(slide.stand)}</text>` : ""}`;
  } else if (slide.kind === "day") {
    artH = 420;
    const rows = slide.sessions.slice(0, 5);
    const rowH = Math.min(150, Math.floor((H - 560) / Math.max(rows.length, 1)));
    let y = 520;
    const items = rows
      .map((s, i) => {
        const av = avatar(`av${i}`, 56, y, Math.min(112, rowH - 16), s.photoDataUri);
        const themeLines = wrap(s.theme, 30, W - 260, 2);
        const block = `${av}
      <text x="192" y="${y + 34}" font-family="Poppins" font-weight="700" font-size="36" fill="${WHITE}">${esc(s.speakerName.toUpperCase())}</text>
      <text x="192" y="${y + 74}" font-family="Poppins" font-weight="700" font-size="28" fill="${ORANGE}">${esc(s.timeLabel)}</text>
      ${textBlock(themeLines, 192, y + 112, 30, SOFT, 400, 1.2)}`;
        y += rowH + 34;
        return block;
      })
      .join("");
    body = `
    <text x="56" y="${artH + 62}" font-family="Poppins" font-weight="600" font-size="32" fill="${BLUE_LIGHT}" letter-spacing="4">HANDS-ON · DEMONSTRAÇÕES</text>
    <text x="56" y="${artH + 132}" font-family="Poppins" font-weight="700" font-size="72" fill="${WHITE}">${esc(slide.dayLabel.toUpperCase())}</text>
    ${items}`;
  } else {
    artH = H;
    const kw = slide.keyword.toUpperCase();
    body = `
    <rect x="0" y="0" width="${W}" height="${H}" fill="${BLUE}" opacity="0.72"/>
    <image x="56" y="52" width="300" height="64" preserveAspectRatio="xMinYMid meet" xlink:href="${c.logoDataUri}"/>
    <text x="${W / 2}" y="${H / 2 - 210}" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="36" fill="${BLUE_LIGHT}" letter-spacing="4">QUER O CRONOGRAMA COMPLETO?</text>
    <text x="${W / 2}" y="${H / 2 - 100}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="66" fill="${WHITE}">COMENTE</text>
    <g><rect x="${W / 2 - 300}" y="${H / 2 - 60}" width="600" height="150" rx="24" fill="${ORANGE}"/>
    <text x="${W / 2}" y="${H / 2 + 42}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="96" fill="${WHITE}" letter-spacing="4">${esc(kw)}</text></g>
    <text x="${W / 2}" y="${H / 2 + 180}" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="54" fill="${WHITE}">E RECEBA MAIS INFORMAÇÕES</text>
    ${textBlock(wrap(slide.eventName, 34, W - 200, 2).map((l) => l), 56, H - 140, 34, SOFT, 400, 1.2)}`;
  }

  return {
    width: W,
    height: H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${chrome(W, H, c, artH)}
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
  const photoH = 1080;
  const sessions = input.sessions.slice(0, 3);
  let y = photoH + 300;
  const cards = sessions
    .map((s) => {
      const themeLines = wrap(s.theme, 34, W - 200, 2);
      const h = 92 + themeLines.length * 42;
      const block = `<g>
      <rect x="56" y="${y}" width="${W - 112}" height="${h}" rx="20" fill="#0E2E63" stroke="${BLUE_LIGHT}" stroke-width="2"/>
      <text x="88" y="${y + 54}" font-family="Poppins" font-weight="700" font-size="36" fill="${ORANGE}">${esc(s.dayLabel.toUpperCase())} · ${esc(s.timeLabel)}</text>
      ${textBlock(themeLines, 88, y + 100, 34, WHITE, 400, 1.2)}
    </g>`;
      y += h + 26;
      return block;
    })
    .join("");

  return {
    width: W,
    height: H,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BLUE}"/><stop offset="1" stop-color="#061A3B"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BLUE}" stop-opacity="0.45"/>
      <stop offset="0.5" stop-color="${BLUE}" stop-opacity="0.15"/>
      <stop offset="1" stop-color="${BLUE}" stop-opacity="1"/>
    </linearGradient>
    <clipPath id="artClip"><rect x="0" y="0" width="${W}" height="${photoH}"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g clip-path="url(#artClip)">
    <image x="0" y="0" width="${W}" height="${photoH}" preserveAspectRatio="xMidYMid slice" xlink:href="${input.artDataUri}"/>
    ${input.photoDataUri ? `<image x="0" y="0" width="${W}" height="${photoH}" preserveAspectRatio="xMidYMin slice" xlink:href="${input.photoDataUri}" opacity="1"/>` : ""}
  </g>
  <rect x="0" y="0" width="${W}" height="${photoH}" fill="url(#scrim)"/>
  <image x="56" y="60" width="320" height="72" preserveAspectRatio="xMinYMid meet" xlink:href="${input.logoDataUri}"/>
  ${input.eventLogoDataUri ? `<image x="${W - 56 - 280}" y="52" width="280" height="86" preserveAspectRatio="xMaxYMid meet" xlink:href="${input.eventLogoDataUri}"/>` : ""}

  <text x="56" y="${photoH + 110}" font-family="Poppins" font-weight="700" font-size="82" fill="${WHITE}">${esc(input.speakerName.toUpperCase())}</text>
  <text x="56" y="${photoH + 178}" font-family="Poppins" font-weight="600" font-size="40" fill="${BLUE_LIGHT}" letter-spacing="2">${esc(input.specialty.toUpperCase())}</text>
  <rect x="56" y="${photoH + 216}" width="180" height="6" fill="${ORANGE}"/>
  ${cards}
  <text x="56" y="${H - 132}" font-family="Poppins" font-weight="400" font-size="34" fill="${SOFT}">${esc(input.location)}</text>
  ${input.stand ? `<text x="56" y="${H - 76}" font-family="Poppins" font-weight="700" font-size="38" fill="${WHITE}">ESTANDE ${esc(input.stand)}</text>` : ""}
  <rect x="0" y="${H - 10}" width="${W}" height="10" fill="${BLUE_LIGHT}"/>
</svg>`,
  };
}
