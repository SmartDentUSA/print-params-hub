// Mensagem de WhatsApp dos criativos: a IA escreve o corpo; o rodapé com
// cupom é sempre montado aqui para o código e a validade saírem corretos.
export type Coupon = { code: string; valid_until: string | null; active?: boolean };

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

export function couponFooter(c: Coupon | null): string {
  const lines: string[] = [];
  if (c) {
    lines.push("Para compras de resinas e insumos compre diretamente no site com desconto");
    lines.push(`Utilizando o cupom: *${c.code}*`);
    if (c.valid_until) lines.push(`Cupom válido até: ${formatDateBR(c.valid_until)}`);
  }
  lines.push("Para equipamentos só me chamar!");
  return lines.join("\n");
}

export function composeCreativeMessage(body: string, c: Coupon | null): string {
  return `${body.trim()}\n\n${couponFooter(c)}`;
}

export const CREATIVE_SYSTEM = `Você é copywriter de vendas da Smart Dent (odontologia digital). Olhe a imagem do criativo e escreva uma mensagem curta de WhatsApp, em português do Brasil, de alta conversão, com emojis relacionados ao que aparece na imagem. 3 a 6 linhas, tom próximo de vendedor para dentista, uma chamada para ação. NÃO invente preços, porcentagens, cupons, datas nem prazos; não escreva rodapé sobre cupom ou equipamentos (o sistema adiciona). Responda só com a mensagem.`;
