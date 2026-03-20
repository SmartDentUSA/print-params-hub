import React from 'react';

// ─── Types ───
type Layer = 'ativo' | 'conc' | 'sdr' | 'mapeamento' | 'vazio';

interface PortfolioCell {
  label: string;
  layer: Layer;
  hits?: number;
  product_key?: string;
}

interface PortfolioSummary {
  n_ativo: number;
  n_conc: number;
  n_sdr: number;
  n_mapeamento?: number;
}

export interface Portfolio {
  [stageKey: string]: { [field: string]: PortfolioCell } | PortfolioSummary;
  summary: PortfolioSummary;
}

// ─── Stage definitions ───
const STAGES = [
  { key: 'etapa_1_scanner', label: '1 · Captura Digital', cols: [
    { field: 'scanner_intraoral', label: 'Scanner\nIntraoral' },
    { field: 'scanner_bancada',   label: 'Scanner\nBancada'   },
    { field: 'notebook',          label: 'Notebook'           },
    { field: 'acessorios',        label: 'Acessórios'         },
    { field: 'pecas_partes',      label: 'Peças/\nPartes'     },
  ]},
  { key: 'etapa_2_cad', label: '2 · CAD', cols: [
    { field: 'software',    label: 'Software'        },
    { field: 'creditos_ia', label: 'Créditos\nIA CAD' },
    { field: 'servico',     label: 'Serviço'          },
  ]},
  { key: 'etapa_3_impressao', label: '3 · Impressão 3D', cols: [
    { field: 'resina',       label: 'Resina'     },
    { field: 'software_imp', label: 'Software'   },
    { field: 'impressora',   label: 'Impressora' },
    { field: 'acessorios',   label: 'Acessórios' },
    { field: 'pecas_partes', label: 'Peças/\nPartes' },
  ]},
  { key: 'etapa_4_pos_impressao', label: '4 · Pós-Imp.', cols: [
    { field: 'equipamentos',       label: 'Equipa-\nmentos'  },
    { field: 'limpeza_acabamento', label: 'Limpeza/\nAcabam.' },
  ]},
  { key: 'etapa_5_finalizacao', label: '5 · Finalização', cols: [
    { field: 'caracterizacao',  label: 'Carac-\nterização' },
    { field: 'instalacao',      label: 'Instala-\nção'      },
    { field: 'dentistica_orto', label: 'Dentíst/\nOrto'     },
  ]},
  { key: 'etapa_6_cursos', label: '6 · Cursos', cols: [
    { field: 'presencial', label: 'Presencial' },
    { field: 'online',     label: 'Online'     },
  ]},
  { key: 'etapa_7_fresagem', label: '7 · Fresagem', cols: [
    { field: 'equipamentos', label: 'Equipa-\nmentos' },
    { field: 'software',     label: 'Software'        },
    { field: 'servico',      label: 'Serviço'          },
    { field: 'acessorios',   label: 'Acessórios'       },
    { field: 'pecas_partes', label: 'Peças/\nPartes'   },
  ]},
];

const ROW_LAYERS: Layer[] = ['sdr', 'conc', 'ativo', 'mapeamento'];
const ROW_LABELS = ['SDR /\nInteresse', 'Mapea-\nmento', 'Ativos\nSmartDent', 'Mapea-\nForms'];

const LAYER_STYLES: Record<Layer, { bg: string; text: string }> = {
  ativo:      { bg: '#0d2a1a', text: '#4ade80' },
  conc:       { bg: '#2a1a02', text: '#fbbf24' },
  sdr:        { bg: '#031020', text: '#60a5fa' },
  mapeamento: { bg: '#7c3aed', text: '#a78bfa' },
  vazio:      { bg: 'transparent', text: '#3a3a3a' },
};

const LEGEND = [
  { color: '#4ade80', label: 'Ativo SmartDent' },
  { color: '#fbbf24', label: 'Concorrente mapeado' },
  { color: '#60a5fa', label: 'Interesse SDR' },
  { color: '#a78bfa', label: 'Mapeamento (forms)' },
  { color: '#333',    label: 'Sem sinal', border: '1px solid #555' },
];

interface WorkflowPortfolioProps {
  portfolio: Portfolio;
}

export function WorkflowPortfolio({ portfolio }: WorkflowPortfolioProps) {
  const { n_ativo = 0, n_conc = 0, n_sdr = 0, n_mapeamento = 0 } = portfolio.summary || {};

  const cellBase: React.CSSProperties = {
    fontSize: 8, textAlign: 'center', borderRadius: 4, padding: '3px 2px',
    minWidth: 38, lineHeight: '1.3', verticalAlign: 'middle',
  };

  return (
    <div>
      {/* Title */}
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#666', marginBottom: 10 }}>
        Workflow Portfolio — 7 Etapas × Subcategorias × 3 Camadas
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        {LEGEND.map(({ color, label, border }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#888' }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: color, border: border || 'none', flexShrink: 0, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 2, minWidth: 700, width: '100%' }}>
          <thead>
            {/* Stage headers */}
            <tr>
              <td style={{ width: 68 }} />
              {STAGES.map((st, i) => (
                <React.Fragment key={st.key}>
                  <td colSpan={st.cols.length} style={{
                    background: '#1e1e1e', color: '#888', fontSize: 9, fontWeight: 600,
                    textAlign: 'center', padding: '5px 3px', borderRadius: 4,
                  }}>
                    {st.label}
                  </td>
                  {i < STAGES.length - 1 && <td style={{ width: 4 }} />}
                </React.Fragment>
              ))}
            </tr>
            {/* Sub-column headers */}
            <tr>
              <td />
              {STAGES.map((st, i) => (
                <React.Fragment key={st.key}>
                  {st.cols.map(col => (
                    <td key={col.field} style={{
                      background: '#1e1e1e', color: '#444', fontSize: 7.5, textAlign: 'center',
                      padding: 2, borderRadius: 3, lineHeight: '1.2', whiteSpace: 'pre-line',
                    }}>
                      {col.label}
                    </td>
                  ))}
                  {i < STAGES.length - 1 && <td />}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROW_LAYERS.map((rowLayer, rowIdx) => (
              <tr key={rowLayer}>
                <td style={{
                  fontSize: 9, color: '#888', fontWeight: 600, textAlign: 'left', padding: '3px 6px',
                  whiteSpace: 'pre-line', verticalAlign: 'middle', background: '#1a1a1a', borderRadius: 4,
                }}>
                  {ROW_LABELS[rowIdx]}
                </td>

                {STAGES.map((st, stIdx) => (
                  <React.Fragment key={st.key}>
                    {st.cols.map(col => {
                      const stageData = portfolio[st.key] as { [k: string]: PortfolioCell } | undefined;
                      const cell: PortfolioCell = stageData?.[col.field] ?? { label: '—', layer: 'vazio' };
                      const isActive = cell.layer === rowLayer && cell.layer !== 'vazio';
                      const colors = isActive ? LAYER_STYLES[cell.layer] : LAYER_STYLES.vazio;

                      return (
                        <td key={col.field} style={{ ...cellBase, background: colors.bg, color: colors.text }}>
                          {isActive ? (
                            <>
                              <span>{cell.label.slice(0, 16)}</span>
                              {cell.hits != null && cell.hits > 0 && (
                                <span style={{ fontSize: 7, opacity: 0.7, display: 'block', marginTop: 1 }}>
                                  {cell.hits} hit{cell.hits > 1 ? 's' : ''}
                                </span>
                              )}
                            </>
                          ) : '—'}
                        </td>
                      );
                    })}
                    {stIdx < STAGES.length - 1 && <td />}
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, padding: '7px 10px',
        background: '#1a1a1a', borderRadius: 7,
      }}>
        <span style={{ fontSize: 11, color: '#888' }}>
          <strong style={{ color: '#4ade80', fontSize: 14, fontWeight: 700 }}>{n_ativo}</strong>{' '}ativos SmartDent
        </span>
        <span style={{ fontSize: 11, color: '#888' }}>
          <strong style={{ color: '#fbbf24', fontSize: 14, fontWeight: 700 }}>{n_conc}</strong>{' '}concorrentes mapeados
        </span>
        <span style={{ fontSize: 11, color: '#888' }}>
          <strong style={{ color: '#60a5fa', fontSize: 14, fontWeight: 700 }}>{n_sdr}</strong>{' '}interesses SDR
        </span>
        {n_mapeamento > 0 && (
          <span style={{ fontSize: 11, color: '#888' }}>
            <strong style={{ color: '#a78bfa', fontSize: 14, fontWeight: 700 }}>{n_mapeamento}</strong>{' '}mapeados (forms)
          </span>
        )}
        {n_ativo === 0 && n_conc === 0 && n_sdr === 0 && n_mapeamento === 0 && (
          <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>
            Sem sinais identificados — aguarda interação
          </span>
        )}
      </div>
    </div>
  );
}
