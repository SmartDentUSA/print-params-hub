import { PainelVendedorRow, fmtBRL, fmtDias, fmtNum, fmtPct } from "@/hooks/painel/usePainelComercial";
import { StatusBadge, statusFromData } from "./StatusBadge";

export function SellerPerformanceTable({ rows }: { rows: PainelVendedorRow[] }) {
  const temReceita = rows.some((r) => (r.total_vendas ?? 0) > 0);

  return (
    <div className="pc-card p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Performance por vendedor</h2>
        <StatusBadge status={statusFromData(rows.length > 0, temReceita)} />
      </div>
      <div className="overflow-x-auto">
        <table className="pc-table">
          <thead>
            <tr>
              <th>Vendedor</th>
              <th className="pc-right">Leads</th>
              <th className="pc-right">Mês ant.</th>
              <th className="pc-right">No funil</th>
              <th className="pc-right">Pedidos</th>
              <th className="pc-right">Abandono <StatusBadge status="ok" /></th>
              <th className="pc-right">Qualif. <StatusBadge status="ok" /></th>
              <th className="pc-right">Negoc.</th>
              <th className="pc-right">Fecham.</th>
              <th className="pc-right">Apresent. <StatusBadge status="parcial" /></th>
              <th className="pc-right">Conv. apresent. <StatusBadge status="ok" /></th>
              <th className="pc-right">Insumos <StatusBadge status="ok" /></th>
              <th className="pc-right">Insumos LTV <StatusBadge status="ok" /></th>
              <th className="pc-right">Insumos novos <StatusBadge status="parcial" /></th>
              <th className="pc-right">Equip.</th>
              <th className="pc-right">Upsell <StatusBadge status="ok" /></th>
              <th className="pc-right">Total <StatusBadge status="ok" /></th>
              <th className="pc-right">% Meta <StatusBadge status="gap" /></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.vendedor}>
                <td className="font-medium">{r.vendedor}</td>
                <td className="pc-right">{fmtNum(r.leads_novos)}</td>
                <td className="pc-right pc-dim">{fmtNum(r.leads_mes_anterior)}</td>
                <td className="pc-right">{fmtNum(r.funil_atual)}</td>
                <td className="pc-right pc-accent">{fmtNum(r.pedidos)}</td>
                <td className="pc-right">
                  {(r.leads_novos ?? 0) === 0 ? <span className="pc-dim italic">sem pool</span> : fmtPct(r.pct_abandono)}
                </td>
                <td className="pc-right pc-dim">{fmtDias(r.t_medio_qualif)}</td>
                <td className="pc-right pc-dim">{fmtDias(r.t_medio_negoc)}</td>
                <td className="pc-right pc-dim">{fmtDias(r.t_medio_fecham)}</td>
                <td className="pc-right">{fmtNum(r.apresentacoes)}</td>
                <td className="pc-right">
                  {(r.apresentacoes ?? 0) === 0 ? (
                    <span className="pc-dim italic">sem apres.</span>
                  ) : (
                    fmtPct(r.conversao_apresent)
                  )}
                </td>
                <td className="pc-right">{fmtBRL(r.receita_insumos, true)}</td>
                <td className="pc-right">{fmtBRL(r.receita_insumos_ltv, true)}</td>
                <td className="pc-right">{fmtBRL(r.receita_insumos_novos, true)}</td>
                <td className="pc-right">{fmtBRL(r.receita_equip, true)}</td>
                <td className="pc-right">{fmtBRL(r.receita_upsell, true)}</td>
                <td className="pc-right pc-num-sm">{fmtBRL(r.total_vendas, true)}</td>
                <td className="pc-right pc-dim">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}