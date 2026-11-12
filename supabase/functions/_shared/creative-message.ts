// Mensagem de WhatsApp dos criativos da campanha.
// O administrador prepara o MODELO no editor da tabela promocional (IA lê a
// imagem e escreve o corpo; o rodapé com variáveis é sempre este aqui).
// Na Agenda o modelo é preenchido no servidor com o cupom do vendedor logado,
// para código e validade saírem sempre corretos.
export type Coupon = { code: string; valid_until: string | null; active?: boolean };

export const VARS = { cupom: "{cupom}", validade: "{validade_cupom}", vendedor: "{vendedor}" } as const;

export const COUPON_BLOCK = [
  "🛒 Para compras de *resinas e insumos*, compre diretamente no site com desconto 👇",
  "🌐 https://loja.smartdent.com.br/",
  `🎟️ Utilizando o cupom: *${VARS.cupom}*`,
  `📅 Cupom válido até: *${VARS.validade}*`,
].join("\n");
export const EQUIPMENT_LINE = "🦷 Para *equipamentos*, só me chamar! 😉";

const GREETING = /^\s*(?:ol[aá]|oi|bom dia|boa tarde|boa noite|prezad[oa](?:\(a\))?)(?=[\s,!.])(?:[\s,]+(?:doutor(?:\(a\)|a)?|dra?\.?(?:\(a\))?|dentista|tudo bem\??))*\s*[!,.]*\s*/i;

/** Limpa o texto da IA: tira saudação inicial, rodapé repetido e espaços sobrando. */
export function cleanAiBody(text: string): string {
  let t = text.replace(/\r\n/g, "\n").trim().replace(/^```[a-z]*\n?|```$/g, "").trim();
  t = t.replace(GREETING, "").trim();
  // A IA às vezes repete o rodapé: corta a partir de cupom/equipamentos.
  t = t.split("\n").filter((l) => !/cupom|equipamentos? só me chamar/i.test(l)).join("\n");
  t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Escolhe o cupom ativo de validade mais longa (sem validade = mais longo). */
export function pickCoupon(coupons: Coupon[], nowMs = Date.now()): Coupon | null {
  const ok = coupons.filter((c) => c.code && (!c.valid_until || new Date(c.valid_until).getTime() >= nowMs - 86_400_000));
  ok.sort((a, b) => (b.valid_until ? new Date(b.valid_until).getTime() : Infinity) - (a.valid_until ? new Date(a.valid_until).getTime() : Infinity));
  return ok[0] ?? null;
}

export function formatDateBR(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Modelo padrão: corpo escrito pela IA + bloco do cupom + convite para equipamentos. */
export function buildCreativeTemplate(body: string): string {
  return `${cleanAiBody(body)}\n\n${COUPON_BLOCK}\n\n${EQUIPMENT_LINE}`;
}

/**
 * Preenche o modelo para um vendedor.
 * Sem cupom: o parágrafo que contém {cupom} ou {validade_cupom} sai inteiro.
 * Cupom sem validade: só a linha de {validade_cupom} sai.
 */
export function renderCreativeMessage(template: string, coupon: Coupon | null, sellerName = ""): string {
  if (!template.trim()) return "";
  const has = (s: string) => s.includes(VARS.cupom) || s.includes(VARS.validade);
  let paragraphs = template.replace(/\r\n/g, "\n").split(/\n[ \t]*\n/);
  if (!coupon) paragraphs = paragraphs.filter((p) => !has(p));
  else if (!coupon.valid_until) paragraphs = paragraphs.map((p) => p.split("\n").filter((l) => !l.includes(VARS.validade)).join("\n"));
  const first = sellerName.trim().split(/\s+/)[0] ?? "";
  return paragraphs
    .map((p) => p.split(VARS.cupom).join(coupon?.code ?? "")
      .split(VARS.validade).join(coupon?.valid_until ? formatDateBR(coupon.valid_until) : "")
      .split(VARS.vendedor).join(first))
    .filter((p) => p.trim())
    .join("\n\n")
    .trim();
}

export const CREATIVE_SYSTEM = `Você é copywriter de vendas da Smart Dent (odontologia digital). Escreva o corpo de uma mensagem de WhatsApp em português do Brasil, de alta conversão, com emojis relacionados ao criativo.

Passo 1 (interno, não escreva): leia TODO o texto impresso na imagem — nome da campanha, produtos/linhas, cada faixa de datas e o desconto de cada faixa, prazos e condições. A mensagem tem de contar exatamente a oferta da arte.

Formato obrigatório (visual limpo de WhatsApp, nunca um bloco corrido):
1ª linha: título curto em negrito com *asteriscos* e 1 emoji, com o nome da campanha da arte. Ex.: 🔥 *Black 26 Smart Dent chegou!*
linha em branco
1 linha dizendo o que está em promoção (ex.: toda a linha de *insumos e resinas*).
linha em branco
Se a arte tiver faixas de datas/descontos: uma linha por faixa, na ordem da arte, ex.: 📅 *16 a 20/11* → *25% OFF*
linha em branco
1 linha de urgência coerente com a arte (ex.: quanto antes, maior o desconto).
1 linha final de chamada para ação.

Regras:
- NÃO comece com saudação (sem "Olá", "Oi", "Doutor(a)", "Bom dia"); já comece pelo título.
- Datas, porcentagens e prazos: use SOMENTE os que estão escritos na imagem, copiados exatamente (mesmos números, mesma ordem). Nunca invente, arredonde nem complete números que não estão na arte.
- NÃO escreva valores em R$.
- Ignore endereços, logos de parceiros e certificações do rodapé da arte.
- Frases curtas, no máximo ~70 caracteres por linha. Negrito só em palavras-chave, datas e descontos.
- NÃO escreva nada sobre cupom, site ou equipamentos (o sistema adiciona o rodapé). Responda só com a mensagem.`;
