import { PainelFunilRow, fmtDias, fmtNum, fmtPct } from "@/hooks/painel/usePainelComercial";
import { StatusBadge, statusFromData } from "./StatusBadge";

/**
 * Funil visual: barras centralizadas que afunilam de cima para baixo.
 * A largura é proporcional ao volume acumulado da etapa; entre as etapas
 * mostramos o % de passagem e destacamos o maior gargalo.
 */
export function FunnelPanel({ rows }: { rows: PainelFunilRow[] }) {
  const ordenadas = [...rows].sort((a, b) => a.ordem - b.ordem);
  const topo = Math.max(1, ...ordenadas.map((r) => r.acumulado ?? r.atual));
  const hasTempo = ordenadas.some((r) => r.media_dias !== null);

  const passagens = ordenadas.map((r, i) => {
    if (i === 0) return null;
    const antes = ordenadas[i - 1].acumulado ?? ordenadas[i - 1].atual;
    const agora = r.acumulado ?? r.atual;
    return antes > 0 ? (agora / antes) * 100 : null;
  });
  const menorPassagem = Math.min(
    ...passagens.filter((p): p is number => p !== null),
  );

  return (
    <div className="pc-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Funil de conversão — etapa por etapa</h2>
        <StatusBadge status={statusFromData(ordenadas.length > 0, hasTempo)} />
      </div>

      <div className="pc-funnel">
        {ordenadas.map((r, i) => {
          const volume = r.acumulado ?? r.atual;
          const largura = Math.max(24, Math.round((volume / topo) * 100));
          const hue = 232 - Math.round((i / Math.max(1, ordenadas.length - 1)) * 80);
          const passagem = passagens[i];
          const gargalo = passagem !== null && passagem === menorPassagem;
          const perdaAlta = (r.pct_perda ?? 0) >= 30;

          return (
            <div key={r.etapa} className="w-full flex flex-col items-center">
              {passagem !== null && (
                <div className="pc-funnel-gap" data-gargalo={gargalo}>
                  ↓ {fmtPct(passagem)} passagem{gargalo ? " — maior gargalo" : ""}
                </div>
              )}
              <div className="pc-funnel-row">
                <div
                  className="pc-funnel-bar"
                  style={{
                    width: `${largura}%`,
                    background: `linear-gradient(90deg, hsl(${hue} 70% 42%), hsl(${hue} 78% 56%))`,
                  }}
                  title={r.etapa}
                >
                  <span className="pc-fn-name">{r.etapa}</span>
                  <span className="pc-fn-meta">
                    atual: {fmtNum(r.atual)} · {fmtDias(r.media_dias)}
                  </span>
                  <span className="pc-fn-chip" data-alto={perdaAlta}>
                    perda {fmtPct(r.pct_perda)}
                  </span>
                </div>
                <span className="pc-fn-total">{fmtNum(volume)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}