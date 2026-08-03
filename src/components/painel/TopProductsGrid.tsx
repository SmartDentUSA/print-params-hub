import { PainelProdutoRow, fmtBRL } from "@/hooks/painel/usePainelComercial";
import { StatusBadge, statusFromData } from "./StatusBadge";

const STAGE_LABEL: Record<string, string> = {
  etapa_1_scanner: "1. Captura digital",
  etapa_2_cad: "2. CAD",
  etapa_3_impressao: "3. Impressão 3D",
  etapa_4_pos_impressao: "4. Pós-impressão",
  etapa_5_finalizacao: "5. Finalização",
  etapa_6_cursos: "6. Cursos",
  etapa_7_fresagem: "7. Fresagem",
  nao_classificado: "Não classificado",
};

export function TopProductsGrid({ rows }: { rows: PainelProdutoRow[] }) {
  const grupos = new Map<string, PainelProdutoRow[]>();
  rows.forEach((r) => {
    const key = `${r.workflow_stage}||${r.subcategory}`;
    grupos.set(key, [...(grupos.get(key) ?? []), r]);
  });
  const entries = Array.from(grupos.entries()).sort(
    (a, b) =>
      (b[1][0]?.receita ?? 0) - (a[1][0]?.receita ?? 0)
  );

  return (
    <div className="pc-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Top produtos por etapa do workflow</h2>
        <StatusBadge status={statusFromData(rows.length > 0)} />
      </div>
      {entries.length === 0 ? (
        <p className="pc-dim text-sm">Sem faturamento de produtos no período.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {entries.map(([key, itens]) => {
            const [stage, sub] = key.split("||");
            return (
              <div key={key} className="rounded-xl p-3" style={{ background: "hsl(var(--pc-surface-2))" }}>
                <div className="pc-label">{STAGE_LABEL[stage] ?? stage}</div>
                <div className="text-xs font-semibold mb-2">{sub}</div>
                <ol className="space-y-1">
                  {itens.map((i) => (
                    <li key={i.posicao} className="flex justify-between gap-2 text-[0.72rem]">
                      <span className="truncate" title={i.produto}>
                        {i.posicao}. {i.produto}
                      </span>
                      <span className="pc-accent whitespace-nowrap">{fmtBRL(i.receita, true)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}