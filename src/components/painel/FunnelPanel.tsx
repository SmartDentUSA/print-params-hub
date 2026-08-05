import { PainelFunilRow, fmtDias, fmtNum, fmtPct } from "@/hooks/painel/usePainelComercial";
import { StatusBadge, statusFromData } from "./StatusBadge";

/**
 * Funil visual em CSS puro: barras centralizadas que afunilam de cima para
 * baixo, com % de passagem entre etapas e destaque do maior gargalo.
 * Largura da barra = volume da etapa / volume da primeira etapa.
 */
export function FunnelPanel({ rows }: { rows: PainelFunilRow[] }) {
  const ordenadas = [...rows].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const volumes = ordenadas.map((r) => r.volume ?? 0);
  const topo = volumes[0] ?? 0;
  const hasTempo = ordenadas.some((r) => r.media_dias !== null && r.media_dias !== undefined);

  const passagens = volumes.map((v, i) =>
    i === 0 ? null : volumes[i - 1] > 0 ? (v / volumes[i - 1]) * 100 : null,
  );
  const validas = passagens.filter((p): p is number => p !== null);
  const menorPassagem = validas.length ? Math.min(...validas) : null;

  return (
    <div className="pc-panel">
      <div className="pc-panel-title">
        <span>Funil de conversão — etapa por etapa</span>
        <StatusBadge status={statusFromData(ordenadas.length > 0, hasTempo)} />
      </div>

      <div className="pc-funil">
        {ordenadas.map((r, i) => {
          const volume = volumes[i];
          const largura = topo > 0 ? Math.max(34, (volume / topo) * 100) : 100;
          const passagem = passagens[i];
          const gargalo = passagem !== null && passagem === menorPassagem;
          const perda = r.pct_perda;
          const perdaClass =
            perda === null || perda === undefined
              ? ""
              : perda > 40
                ? " pc-perda--critico"
                : perda > 15
                  ? " pc-perda--alerta"
                  : "";
          const isFinal = i === ordenadas.length - 1;

          return (
            <div key={`${r.etapa}-${r.ordem}`} className="w-full flex flex-col items-center">
              {passagem !== null && (
                <div className={`pc-passagem${gargalo ? " is-gargalo" : ""}`}>
                  ↓ <b>{fmtPct(passagem)}</b> passagem{gargalo ? " — maior gargalo" : ""}
                </div>
              )}
              <div
                className={`pc-funil-bar${isFinal ? " is-final" : ""}`}
                data-ordem={r.ordem ?? i + 1}
                style={{ width: `${largura}%` }}
                title={r.etapa}
              >
                <span className="fb-nome">{r.etapa ?? "—"}</span>
                <span className="fb-sub">
                  atual: {fmtNum(r.atual)} · {fmtDias(r.media_dias)}
                </span>
                <span className={`pc-perda${perdaClass}`}>perda {fmtPct(perda)}</span>
                <span className="fb-qtd">{fmtNum(volume)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}