// Mensagem de WhatsApp dos criativos da campanha.
// O administrador prepara o MODELO no editor da tabela promocional (IA lê a
// imagem e escreve o corpo; o rodapé com variáveis é sempre este aqui).
// Na Agenda o modelo é preenchido no servidor com o cupom do vendedor logado,
// para código e validade saírem sempre corretos.
export type Coupon = { code: string; valid_until: string | null; active?: boolean };

export const VARS = { cupom: "{cupom}", validade: "{validade_cupom}", vendedor: "{vendedor}" } as const;

export const COUPON_BLOCK = [
  "Para compras de resinas e insumos compre diretamente no site com desconto 👇",
  `Utilizando o cupom: *${VARS.cupom}*`,
  `Cupom válido até: ${VARS.validade}`,
].join("\n");
export const EQUIPMENT_LINE = "Para equipamentos só me chamar! 😉";

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
  return `${body.trim()}\n\n${COUPON_BLOCK}\n\n${EQUIPMENT_LINE}`;
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

export const CREATIVE_SYSTEM = `Você é copywriter de vendas da Smart Dent (odontologia digital). Olhe a imagem do criativo e escreva uma mensagem curta de WhatsApp, em português do Brasil, de alta conversão, com emojis relacionados ao que aparece na imagem. 3 a 6 linhas, tom próximo de vendedor para dentista, uma chamada para ação. NÃO invente preços, porcentagens, cupons, datas nem prazos; não escreva rodapé sobre cupom, site ou equipamentos (o sistema adiciona). Responda só com a mensagem.`;
