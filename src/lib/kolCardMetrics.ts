export function activeKolCouponCodes(coupons: { code: string; active_from?: string | null; active_to?: string | null }[], today: string): string[] {
  return [...new Set(coupons.filter(c => (!c.active_from || c.active_from.slice(0, 10) <= today) && (!c.active_to || c.active_to.slice(0, 10) >= today)).map(c => c.code.trim().toUpperCase()).filter(Boolean))];
}
export function kolCardChannels(t: { receita: number; receitaCupons: number; comissao: number | null; comissaoLeads: number; comissaoCupons: number }) {
  return [
    { label: "Formulários", revenue: t.receita, commission: t.comissao == null ? null : t.comissaoLeads },
    { label: "Cupons", revenue: t.receitaCupons, commission: t.comissao == null ? null : t.comissaoCupons },
    { label: "Total", revenue: t.receita + t.receitaCupons, commission: t.comissao },
  ];
}
