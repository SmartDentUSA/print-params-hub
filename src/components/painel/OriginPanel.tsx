import { PainelOrigemRow, fmtBRL, fmtDias, fmtNum, fmtPct } from "@/hooks/painel/usePainelComercial";
import { StatusBadge, statusFromData } from "./StatusBadge";
import { mergeOriginRows } from "@/lib/painel/originMerge";

function OriginTable({ rows }: { rows: PainelOrigemRow[] }) {
  const ordenadas = [...rows].sort((a, b) => (b.leads_gerados ?? 0) - (a.leads_gerados ?? 0));
  return (
    <div className="overflow-x-auto">
      <table className="pc-table">
        <thead>
          <tr>
            <th>Origem</th>
            <th>Campanha</th>
            <th className="pc-right">Leads</th>
            <th className="pc-right">Ativos</th>
            <th className="pc-right">Perdidos</th>
            <th className="pc-right">% perda</th>
            <th>Etapa maior perda</th>
            <th className="pc-right" title="Negócios fechados no mês (visão de caixa)">Ganhos</th>
            <th className="pc-right">Lead time</th>
            <th className="pc-right" title="Leads desta coorte que já converteram ÷ leads da coorte">
              Conversão
            </th>
            <th className="pc-right">Receita</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((r) => (
            <tr key={`${r.origem}::${r.campanha}`}>
              <td className="font-medium max-w-[15rem] truncate" title={r.origem}>{r.origem}</td>
              <td className="pc-dim max-w-[12rem] truncate" title={r.campanha}>{r.campanha}</td>
              <td className="pc-right">{fmtNum(r.leads_gerados)}</td>
              <td className="pc-right">{fmtNum(r.ativos)}</td>
              <td className="pc-right">{fmtNum(r.perdidos)}</td>
              <td className="pc-right">{fmtPct(r.pct_perda)}</td>
              <td className="pc-dim">{r.etapa_maior_perda ?? "—"}</td>
              <td className="pc-right pc-accent">{fmtNum(r.ganhos)}</td>
              <td className="pc-right pc-dim">{fmtDias(r.lead_time_dias)}</td>
              <td className="pc-right">{fmtPct(r.pct_conversao)}</td>
              <td className="pc-right">{fmtBRL(r.receita, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OriginPanel({ rows: rawRows }: { rows: PainelOrigemRow[] }) {
  // Junta origens/campanhas equivalentes (prefixos "# -", "Meta Ads —", typos, acentos)
  const rows = mergeOriginRows(rawRows);
  const completo = rows.some((r) => (r.ganhos ?? 0) > 0);
  const temTipo = rows.some((r) => r.tipo);

  // Fallback: sem o campo `tipo` (migration não aplicada) mantém uma tabela única.
  if (!temTipo) {
    return (
      <div className="pc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Origem dos leads</h2>
          <StatusBadge status={statusFromData(rows.length > 0, completo)} />
        </div>
        <OriginTable rows={rows} />
      </div>
    );
  }

  const inbound = rows.filter((r) => r.tipo === "Inbound");
  const outbound = rows.filter((r) => r.tipo === "Outbound");

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="pc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Origem dos leads — Inbound</h2>
          <StatusBadge status={statusFromData(inbound.length > 0, completo)} />
        </div>
        <OriginTable rows={inbound} />
      </div>
      <div className="pc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Origem dos leads — Outbound</h2>
          <StatusBadge status={statusFromData(outbound.length > 0, completo)} />
        </div>
        <OriginTable rows={outbound} />
      </div>
    </div>
  );
}