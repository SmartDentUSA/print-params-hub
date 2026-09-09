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
  location?: string;
  stand?: string;
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
  /** Arte enviada no cadastro: gabarito de referência, NUNCA usada como fundo. */
  artDataUri: string;
  /** Imagem de fundo real (hero do evento). Sem ela, o fundo é o gradiente institucional. */
  bgDataUri?: string | null;
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

function technologyMark(x: number, y: number, scale = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <text x="0" y="0" font-family="${FONT}" font-weight="400" font-size="15" fill="${INK_SOFT}" letter-spacing="5">PRÁTICA</text>
    <text x="-9" y="28" font-family="${FONT}" font-weight="400" font-size="15" fill="${INK_SOFT}" letter-spacing="4">TECNOLOGIA</text>
    <text x="-2" y="56" font-family="${FONT}" font-weight="400" font-size="15" fill="${INK_SOFT}" letter-spacing="5">RESULTADOS</text>
  </g>`;
}

function innovationTag(W: number, y = 62): string {
  return `<g>
    <text x="${W - 64}" y="${y}" text-anchor="end" font-family="${FONT}" font-weight="400" font-size="18" fill="${WHITE}" letter-spacing="5">INOVAÇÃO</text>
    <text x="${W - 64}" y="${y + 28}" text-anchor="end" font-family="${FONT}" font-weight="400" font-size="18" fill="${WHITE}" letter-spacing="5">QUE CONECTA</text>
    <text x="${W - 64}" y="${y + 56}" text-anchor="end" font-family="${FONT}" font-weight="400" font-size="18" fill="${WHITE}" letter-spacing="5">PESSOAS</text>
    <rect x="${W - 150}" y="${y + 72}" width="86" height="6" rx="3" fill="${BLUE_LIGHT}"/>
  </g>`;
}

function brandRibbon(W: number, y: number): string {
  return `<g>
    <line x1="64" y1="${y - 30}" x2="${W - 64}" y2="${y - 30}" stroke="${BLUE_LIGHT}" stroke-width="2"/>
    <text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${FONT}" font-weight="400" font-size="16" fill="${INK_SOFT}" letter-spacing="4">CONHECIMENTO   •   PRÁTICA   •   PESSOAS   •   SOLUÇÕES</text>
  </g>`;
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

/**
 * Template FIXO das demonstrações (1, 2 ou 3): a altura e a posição de cada
 * card são sempre as mesmas, independente da quantidade — com 1 ou 2
 * demonstrações o restante do espaço fica livre, exatamente como o padrão
 * aprovado. Só texto do editor de eventos entra aqui; nenhuma imagem.
 */
function referenceDemoCards(
  sessions: SpeakerSession[],
  top: number,
  _available: number,
  story = false,
): string {
  const shown = sessions.slice(0, 3);
  if (!shown.length) return "";
  const side = story ? 58 : 48;
  const gap = story ? 24 : 18;
  const cardH = story ? 244 : 214;
  const cardW = CAROUSEL.width - side * 2;
  const iconSize = story ? 58 : 52;
  const textX = side + iconSize + 42;
  const markX = CAROUSEL.width - side - 122;
  const textW = markX - textX - 36;
  return shown.map((s, index) => {
    const y = top + index * (cardH + gap);
    const labelW = story ? 276 : 248;
    const date = fit(s.dateLong.toUpperCase(), textW, 1, story ? 28 : 24, 17);
    const theme = fit(s.theme.toUpperCase(), textW, 2, story ? 27 : 23, 16);
    const time = fit(s.timeLabel.toUpperCase(), textW, 1, story ? 27 : 23, 17);
    const rowGap = Math.max(10, Math.round((cardH - iconSize * 3) / 4));
    const row1 = y + rowGap + 12;
    const row2 = row1 + iconSize + rowGap;
    const row3 = row2 + iconSize + rowGap;
    return `<g>
      <rect x="${side}" y="${y}" width="${cardW}" height="${cardH}" rx="16" fill="${WHITE}" stroke="${HAIR}" stroke-width="2"/>
      <rect x="${side + 16}" y="${y - 14}" width="${labelW}" height="38" rx="19" fill="${BLUE_LIGHT}"/>
      <text x="${side + 16 + labelW / 2}" y="${y + 12}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="18" fill="${WHITE}" letter-spacing="2">DEMONSTRAÇÃO ${index + 1}</text>
      ${iconBox(side + 22, row1, iconSize, "cal")}
      <text x="${textX}" y="${row1 + iconSize * 0.46}" font-family="${FONT}" font-weight="700" font-size="${date.size}" fill="${INK}">${esc(date.lines[0] || "")}</text>
      <text x="${textX}" y="${row1 + iconSize * 0.84}" font-family="${FONT}" font-weight="400" font-size="${story ? 18 : 16}" fill="${INK_SOFT}">(${esc(s.weekday.toUpperCase())})</text>
      ${iconBox(side + 22, row2, iconSize, "doc")}
      ${textBlock(theme.lines, textX, row2 + theme.size * 1.05, theme.size, INK, 400, 1.12)}
      ${iconBox(side + 22, row3, iconSize, "clock")}
      <text x="${textX}" y="${row3 + iconSize * 0.66}" font-family="${FONT}" font-weight="700" font-size="${time.size}" fill="${INK}">${esc(time.lines[0] || "")}</text>
      <line x1="${markX - 22}" y1="${y + 30}" x2="${markX - 22}" y2="${y + cardH - 26}" stroke="${BLUE_LIGHT}" stroke-width="3"/>
      <g transform="translate(${markX + 10} ${y + cardH / 2 - 46})">
        <path d="M 12 4 C 20 -2 36 -2 44 4 C 52 10 50 24 46 34 C 42 44 38 46 34 40 C 31 35 25 35 22 40 C 18 46 14 44 10 34 C 6 24 4 10 12 4 Z" fill="none" stroke="${BLUE_LIGHT}" stroke-width="3.5" stroke-linejoin="round"/>
        ${technologyMark(-20, 66, 0.72)}
      </g>
    </g>`;
  }).join("");
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
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      ${c.bgDataUri ? `<image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.bgDataUri}"/>
      <rect width="${W}" height="${H}" fill="${NAVY_DEEP}" opacity="0.45"/>` : ""}
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
    const artH = 560;
    const footH = 150;
    const photoR = 118;
    const photoCx = 205;
    const photoCy = 496;
    const sessions = slide.sessions.slice(0, 3);
    // Template fixo: os cards sempre começam na mesma altura.
    const blocksTop = 690;
    const blocks = referenceDemoCards(sessions, blocksTop, 0);
    // Única imagem de fundo permitida: a imagem de fundo do evento (hero).
    const hero = c.bgDataUri || null;


    const pillX = photoCx + photoR + 28;
    const pillW = W - 64 - pillX;
    const name = fit(slide.speakerName.toUpperCase(), pillW - 56, 1, 34, 22);
    const pillH = 76;
    const headline = fit("TODA A TECNOLOGIA AO VIVO.", 470, 3, 60, 44);
    const headTop = 182;
    const headLines = headline.lines
      .map((l, i) => `<text x="64" y="${headTop + i * headline.size * 1.02}" font-family="${FONT}" font-weight="700" font-size="${headline.size}" fill="${/TECNOLOG/.test(l) ? BLUE_LIGHT : WHITE}" letter-spacing="-1">${esc(l)}</text>`)
      .join("");
    body = `
    <g clip-path="url(#frame)">
      <rect width="${W}" height="${H}" fill="${PAPER}"/>
      <rect x="0" y="0" width="${W}" height="${artH}" fill="url(#bg)"/>
      ${hero ? `<image x="0" y="0" width="${W}" height="${artH}" preserveAspectRatio="xMidYMid slice" xlink:href="${hero}"/>
      <rect x="0" y="0" width="${W}" height="${artH}" fill="${NAVY_DEEP}" opacity="0.34"/>
      <rect x="0" y="0" width="${Math.round(W * 0.72)}" height="${artH}" fill="url(#leftScrim)"/>` : ""}
      <rect x="0" y="${artH - 96}" width="${W}" height="96" fill="url(#artToPaper)"/>
    </g>
    <defs>
      <linearGradient id="leftScrim" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${NAVY_DEEP}" stop-opacity="0.82"/>
        <stop offset="1" stop-color="${NAVY_DEEP}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <image x="64" y="44" width="288" height="62" preserveAspectRatio="xMinYMid meet" xlink:href="${c.logoDataUri}"/>
    ${headLines}
    <text x="64" y="${headTop + headline.lines.length * headline.size * 1.02 - 18}" font-family="${FONT}" font-weight="400" font-size="23" fill="${WHITE}" letter-spacing="1">VISITE NOSSO ESTANDE E PARTICIPE DAS DEMONSTRAÇÕES.</text>
    ${eventLogo(W - 370, 148, 300, c)}
    ${innovationTag(W, 48)}
    <defs><clipPath id="spPhoto"><circle cx="${photoCx}" cy="${photoCy}" r="${photoR}"/></clipPath></defs>
    <circle cx="${photoCx}" cy="${photoCy}" r="${photoR + 7}" fill="${WHITE}"/>
    ${slide.photoDataUri
      ? `<g clip-path="url(#spPhoto)"><image x="${photoCx - photoR}" y="${photoCy - photoR}" width="${photoR * 2}" height="${photoR * 2}" preserveAspectRatio="xMidYMin slice" xlink:href="${slide.photoDataUri}"/></g>`
      : `<circle cx="${photoCx}" cy="${photoCy}" r="${photoR}" fill="${CARD}"/>`}
    <g>
      <rect x="${pillX}" y="${photoCy - pillH / 2}" width="${pillW}" height="${pillH}" rx="14" fill="${INK}" stroke="${BLUE_LIGHT}" stroke-width="2"/>
      ${textBlock(name.lines, pillX + 28, photoCy + name.size * 0.36, name.size, WHITE, 700, 1.15)}
    </g>
    ${blocks}
    <rect x="0" y="${H - footH}" width="${W}" height="${footH}" fill="${WHITE}"/>
    ${pin(64, H - 108, 40, BLUE_LIGHT)}
    <text x="120" y="${H - 100}" font-family="${FONT}" font-weight="700" font-size="23" fill="${INK}">${esc(slide.dateLabel || "")}</text>
    <text x="120" y="${H - 70}" font-family="${FONT}" font-weight="400" font-size="21" fill="${INK_SOFT}">${esc([slide.location, slide.stand ? `ESTANDE ${slide.stand}` : ""].filter(Boolean).join(" • ").toUpperCase())}</text>
    ${eventLogo(W - 304, H - 138, 240, c)}
    ${brandRibbon(W, H - 14)}`;
  } else {
    const nameLines = wrap(slide.eventName.toUpperCase(), 92, W - 200, 3);
    const nameBase = 470;
    let y = nameBase + nameLines.length * 100 + 60;
    body = `
    <g clip-path="url(#frame)">
      <rect width="${W}" height="${H}" fill="${PAPER}"/>
      <rect x="0" y="0" width="${W}" height="${620}" fill="url(#bg)"/>
      ${c.bgDataUri ? `<image x="0" y="0" width="${W}" height="${620}" preserveAspectRatio="xMidYMid slice" xlink:href="${c.bgDataUri}"/>
      <rect x="0" y="0" width="${W}" height="${620}" fill="${NAVY_DEEP}" opacity="0.3"/>` : ""}
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
  /** Imagem da aula enviada no editor: entra como hero atrás da foto. */
  heroDataUri?: string | null;
  sessions: SpeakerSession[];
  eventName: string;
  location: string;
  stand: string;
}

export function buildStorySvg(input: StoryInput): { svg: string; width: number; height: number } {
  const { width: W, height: H } = STORY;
  const artH = 760;
  const photoR = 138;
  const photoCx = 202;
  const photoCy = 682;
  const sessions = input.sessions.slice(0, 3);
  const footH = 220;

  const name = fit(input.speakerName.toUpperCase(), 620, 1, 38, 24);
  const pillX = 366;
  const pillY = photoCy - 42;
  const blocksTop = 850;
  const built = { svg: referenceDemoCards(sessions, blocksTop, H - footH - blocksTop - 34, true) };
  const headline = fit("TODA A TECNOLOGIA AO VIVO.", 600, 3, 76, 54);


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
    <rect x="0" y="0" width="${W}" height="${artH}" fill="url(#bg)"/>
    ${(input.heroDataUri || input.bgDataUri) ? `<image x="0" y="0" width="${W}" height="${artH}" preserveAspectRatio="xMidYMid slice" xlink:href="${input.heroDataUri || input.bgDataUri}"/>
    <rect x="0" y="0" width="${W}" height="${artH}" fill="${NAVY_DEEP}" opacity="0.3"/>` : ""}
    <rect x="0" y="${artH - 100}" width="${W}" height="100" fill="url(#artToPaper)"/>
  </g>
  <rect x="0" y="${artH}" width="${W}" height="${H - artH}" fill="${PAPER}"/>
  <image x="64" y="54" width="310" height="68" preserveAspectRatio="xMinYMid meet" xlink:href="${input.logoDataUri}"/>
  ${eventLogo(W - 382, 148, 318, input)}
  ${innovationTag(W, 58)}
  ${textBlock(headline.lines, 64, 226, headline.size, WHITE, 400, 0.98)}
  <text x="64" y="470" font-family="${FONT}" font-weight="400" font-size="27" fill="${WHITE}">VISITE NOSSO ESTANDE E PARTICIPE DAS DEMONSTRAÇÕES.</text>
  <defs><clipPath id="stPhoto"><circle cx="${photoCx}" cy="${photoCy}" r="${photoR}"/></clipPath></defs>
  <circle cx="${photoCx}" cy="${photoCy}" r="${photoR + 9}" fill="${WHITE}"/>
  ${input.photoDataUri
    ? `<g clip-path="url(#stPhoto)"><image x="${photoCx - photoR}" y="${photoCy - photoR}" width="${photoR * 2}" height="${photoR * 2}" preserveAspectRatio="xMidYMin slice" xlink:href="${input.photoDataUri}"/></g>`
    : `<circle cx="${photoCx}" cy="${photoCy}" r="${photoR}" fill="${CARD}"/>`}
  <rect x="${pillX}" y="${pillY}" width="${W - pillX - 58}" height="84" rx="14" fill="${INK}" stroke="${BLUE_LIGHT}" stroke-width="2"/>
  ${textBlock(name.lines, pillX + 28, pillY + 54, name.size, WHITE, 700, 1.1)}
  ${built.svg}
  <rect x="0" y="${H - footH}" width="${W}" height="${footH}" fill="${WHITE}"/>
  ${pin(90, H - footH + 34, 46, BLUE_LIGHT)}
  ${textBlock(footLine.lines, 156, H - footH + 72, footLine.size, INK, 700, 1.15)}
  ${textBlock(eventLine.lines, 156, H - footH + 122, eventLine.size, INK_SOFT, 400, 1.25)}
  ${brandRibbon(W, H - 18)}
</svg>`,
  };
}
