import { PainelProdutoRow, fmtBRL } from "@/hooks/painel/usePainelComercial";
import { StatusBadge, statusFromData } from "./StatusBadge";

/** 7 etapas do workflow, na ordem, com as subcategorias esperadas de cada uma. */
const STAGES: { key: string; n: number; label: string; subs: string[] }[] = [
  {
    key: "etapa_1_scanner",
    n: 1,
    label: "Captura Digital",
    subs: ["Scanner Intraoral", "Scanner Bancada", "Acessórios", "Notebook", "Peças/Partes"],
  },
  { key: "etapa_2_cad", n: 2, label: "CAD", subs: ["Software", "Créditos IA CAD", "Serviço"] },
  {
    key: "etapa_3_impressao",
    n: 3,
    label: "Impressão 3D",
    subs: ["Resinas", "Impressora", "Software", "Acessórios / Peças"],
  },
  {
    key: "etapa_4_pos_impressao",
    n: 4,
    label: "Pós-Impressão",
    subs: ["Equipamentos", "Limpeza/Acabamento"],
  },
  {
    key: "etapa_5_finalizacao",
    n: 5,
    label: "Finalização",
    subs: ["Caracterização", "Instalação", "Dentística/Orto"],
  },
  { key: "etapa_6_cursos", n: 6, label: "Cursos", subs: ["Presencial", "Online"] },
  {
    key: "etapa_7_fresagem",
    n: 7,
    label: "Fresagem",
    subs: ["Insumos", "Serviço", "Equipamentos / Software / Acessórios"],
  },
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function TopProductsGrid({ rows }: { rows: PainelProdutoRow[] }) {
  const porEtapa = new Map<string, Map<string, PainelProdutoRow[]>>();
  rows.forEach((r) => {
    const stage = porEtapa.get(r.workflow_stage) ?? new Map<string, PainelProdutoRow[]>();
    const sub = r.subcategory || "Outros";
    stage.set(sub, [...(stage.get(sub) ?? []), r]);
    porEtapa.set(r.workflow_stage, stage);
  });

  return (
    <div className="pc-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Top 5 produtos mais vendidos por etapa</h2>
        <StatusBadge status={statusFromData(rows.length > 0, false)} />
      </div>

      <div className="pc-stages-grid">
        {STAGES.map((stage) => {
          const dados = porEtapa.get(stage.key) ?? new Map<string, PainelProdutoRow[]>();
          const extras = Array.from(dados.keys()).filter(
            (s) => !stage.subs.some((exp) => norm(exp) === norm(s)),
          );
          const subs = [...stage.subs, ...extras];

          return (
            <div key={stage.key} className="pc-stage-col">
              <div className="pc-stage-head">
                <span className="pc-accent mr-1">{stage.n}</span>
                {stage.label}
              </div>
              {subs.map((sub) => {
                const itens = (
                  dados.get(sub) ??
                  Array.from(dados.entries()).find(([k]) => norm(k) === norm(sub))?.[1] ??
                  []
                )
                  .slice()
                  .sort((a, b) => a.posicao - b.posicao)
                  .slice(0, 5);

                return (
                  <div key={sub} className="pc-subcat-block">
                    <span className="pc-subcat-label">{sub}</span>
                    {itens.length === 0 ? (
                      <span className="pc-subcat-empty">sem venda no período</span>
                    ) : (
                      itens.map((i) => (
                        <div key={`${i.posicao}-${i.produto}`} className="pc-prod-item">
                          <span className="pc-prod-rank">{i.posicao}</span>
                          <span className="pc-prod-nome" title={i.produto}>
                            {i.produto}
                          </span>
                          <span className="pc-prod-val">{fmtBRL(i.receita, true)}</span>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}