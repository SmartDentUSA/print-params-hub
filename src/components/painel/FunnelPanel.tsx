import { PainelFunilRow, fmtDias, fmtNum, fmtPct } from "@/hooks/painel/usePainelComercial";
import { StatusBadge, statusFromData } from "./StatusBadge";

/**
 * Funil visual: barras centralizadas que afunilam de cima para baixo.
 * Volume da etapa = leads que efetivamente alcançaram a etapa (vindo do
 * banco em `volume`); fallback = soma-sufixo de `atual`. Entre as etapas
 * mostramos o % de passagem e destacamos o maior gargalo.
 */
export function FunnelPanel({ rows }: { rows: PainelFunilRow[] }) {
  const ordenadas = [...rows].sort((a, b) => a.ordem - b.ordem);
  const temVolume = ordenadas.some((r) => (r.volume ?? 0) > 0);
  const volumes = ordenadas.map((r, i) =>
    temVolume
      ? r.volume ?? 0
      : ordenadas.slice(i).reduce((acc, x) => acc + (x.atual ?? 0), 0),
  );
  const topo = Math.max(1, ...volumes);
  const hasTempo = ordenadas.some((r) => r.media_dias !== null);

  const passagens = volumes.map((v, i) =>
    i === 0 ? null : volumes[i - 1] > 0 ? (v / volumes[i - 1]) * 100 : null,
  );
  const validas = passagens.filter((p): p is number => p !== null);
  const menorPassagem = validas.length ? Math.min(...validas) : null;

  return (
    <div className="pc-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Funil de conversão — etapa por etapa</h2>
        <StatusBadge status={statusFromData(ordenadas.length > 0, hasTempo)} />
      </div>

      <div className="pc-funnel">
        {ordenadas.map((r, i) => {
          const volume = volumes[i];
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