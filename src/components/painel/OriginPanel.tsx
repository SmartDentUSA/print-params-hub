import { PainelOrigemRow, fmtBRL, fmtDias, fmtNum, fmtPct } from "@/hooks/painel/usePainelComercial";
import { StatusBadge, statusFromData } from "./StatusBadge";

const isInbound = (origem: string) =>
  /meta|face|insta|orgânic|organic|whatsapp|e-commerce|ecommerce|site|google|form/i.test(origem);

function OriginTable({ rows }: { rows: PainelOrigemRow[] }) {
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
            <th className="pc-right">Ganhos</th>
            <th className="pc-right">Lead time</th>
            <th className="pc-right">Conversão</th>
            <th className="pc-right">Receita</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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

export function OriginPanel({ rows }: { rows: PainelOrigemRow[] }) {
  const inbound = rows.filter((r) => isInbound(r.origem)).slice(0, 12);
  const outbound = rows.filter((r) => !isInbound(r.origem)).slice(0, 12);
  const completo = rows.some((r) => (r.ganhos ?? 0) > 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <div className="pc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Origem inbound</h2>
          <StatusBadge status={statusFromData(inbound.length > 0, completo)} />
        </div>
        <OriginTable rows={inbound} />
      </div>
      <div className="pc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Origem outbound e base</h2>
          <StatusBadge status={statusFromData(outbound.length > 0, completo)} />
        </div>
        <OriginTable rows={outbound} />
      </div>
    </div>
  );
}