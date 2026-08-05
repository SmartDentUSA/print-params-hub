import { PainelAtividadeRow, fmtNum } from "@/hooks/painel/usePainelComercial";
import { StatusBadge, statusFromData } from "./StatusBadge";

export function ActivityTable({ rows, periodo }: { rows: PainelAtividadeRow[]; periodo?: string }) {
  const completo = rows.some((r) => r.media_interacoes_fechar !== null);

  return (
    <div className="pc-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold">Atividades por vendedor</h2>
          <p className="pc-label mt-0.5">{periodo ? `no mês — ${periodo}` : "no mês selecionado"}</p>
        </div>
        <StatusBadge status={statusFromData(rows.length > 0, completo)} />
      </div>
      <div className="overflow-x-auto">
        <table className="pc-table">
          <thead>
            <tr>
              <th>Vendedor</th>
              <th className="pc-right">WhatsApp</th>
              <th className="pc-right">Tent. ligação</th>
              <th className="pc-right">Ligação</th>
              <th className="pc-right">Atividade</th>
              <th className="pc-right">Reunião</th>
              <th className="pc-right">E-mail</th>
              <th className="pc-right">Lembrete</th>
              <th className="pc-right">Total</th>
              <th className="pc-right">Fechados</th>
              <th className="pc-right">Interações / fecham.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.vendedor}>
                <td className="font-medium">{r.vendedor}</td>
                <td className="pc-right">{fmtNum(r.fop_whatsapp)}</td>
                <td className="pc-right">{fmtNum(r.tentativa_ligacao)}</td>
                <td className="pc-right">{fmtNum(r.ligacao)}</td>
                <td className="pc-right">{fmtNum(r.atividade)}</td>
                <td className="pc-right">{fmtNum(r.reuniao)}</td>
                <td className="pc-right">{fmtNum(r.email)}</td>
                <td className="pc-right">{fmtNum(r.lembrete)}</td>
                <td className="pc-right pc-num-sm">{fmtNum(r.total)}</td>
                <td className="pc-right pc-accent">{fmtNum(r.fechados)}</td>
                <td className="pc-right">
                  {r.media_interacoes_fechar === null ? "—" : r.media_interacoes_fechar.toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}