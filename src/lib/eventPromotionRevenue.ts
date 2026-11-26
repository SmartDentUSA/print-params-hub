/** Channel and coupon breakdowns are subsets, not additional revenue. */
export function eventPromotionRevenue(crmWon: number, storePaid: number): number {
  return Math.round((crmWon + storePaid) * 100) / 100;
}

export type EventProductRevenue = {
  nome: string;
  quantidade: number;
  receita: number;
};

/** Consolida todos os itens recebidos; a apresentação nunca limita o cálculo aos primeiros resultados. */
export function consolidateEventProducts(...groups: EventProductRevenue[][]): EventProductRevenue[] {
  const acc = new Map<string, EventProductRevenue>();
  for (const product of groups.flat()) {
    const nome = product.nome.trim();
    const key = nome.toLocaleLowerCase("pt-BR");
    const current = acc.get(key) ?? { nome, quantidade: 0, receita: 0 };
    current.quantidade += product.quantidade;
    current.receita += product.receita;
    acc.set(key, current);
  }
  return [...acc.values()]
    .map((product) => ({ ...product, receita: Math.round(product.receita * 100) / 100 }))
    .sort((a, b) => b.receita - a.receita);
}
