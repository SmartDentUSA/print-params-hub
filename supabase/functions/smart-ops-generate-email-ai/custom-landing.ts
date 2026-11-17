// Landing pages enviadas como HTML próprio (custom_html) não usam o conteúdo
// estruturado do modelo padrão (que pode estar desatualizado). Para o e-mail,
// extraímos só o texto visível e a primeira imagem pública da própria página.
// Valores em R$ e percentuais são removidos: e-mails gerados nunca citam preços.

export interface CustomLandingContext {
  title: string;
  text: string;
  imageUrl: string | null;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
};

function decode(s: string): string {
  return s
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
}

export function stripCommercialValues(s: string): string {
  return s
    .replace(/R\$\s*[\d.,]+(\s*(mil|k))?/gi, "")
    .replace(/\b\d{1,3}(?:[.,]\d+)?\s*%/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function extractCustomLandingText(html: string, maxChars = 6000): CustomLandingContext {
  const src = String(html || "");
  const titleMatch = src.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const clean = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const title = stripCommercialValues(clean(h1Match?.[1] || titleMatch?.[1] || ""));

  let imageUrl: string | null = null;
  const imgRe = /<img\b[^>]*\bsrc\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(src))) {
    if (!/\.svg(\?|$)/i.test(m[2])) { imageUrl = m[2]; break; }
  }

  const body = src
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|noscript|template|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/div|\/section|\/article|\/button|\/a)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const seen = new Set<string>();
  const lines: string[] = [];
  let total = 0;
  for (const raw of decode(body).split(/\n+/)) {
    const line = stripCommercialValues(raw.replace(/\s+/g, " ").trim());
    if (line.length < 3 || seen.has(line.toLowerCase())) continue;
    seen.add(line.toLowerCase());
    if (total + line.length > maxChars) break;
    lines.push(line);
    total += line.length + 1;
  }
  return { title, text: lines.join("\n"), imageUrl };
}
