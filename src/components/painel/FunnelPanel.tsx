import { PainelFunilRow, fmtDias, fmtNum, fmtPct } from "@/hooks/painel/usePainelComercial";
import { StatusBadge, statusFromData } from "./StatusBadge";

/**
 * Funil em formato de tabela: ETAPA | VOLUME (barra + número) | HOJE | MED | PERDA,
 * com linha de "% passagem" entre etapas e destaque do maior gargalo.
 * Largura da barra = volume da etapa / volume da primeira etapa.
 */
export function FunnelPanel({ rows }: { rows: PainelFunilRow[] }) {
  const ordenadas = [...rows].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const volumes = ordenadas.map((r) => r.volume_acumulado ?? r.volume ?? 0);
  const topo = volumes[0] ?? 0;
  const hasTempo = ordenadas.some((r) => r.media_dias !== null && r.media_dias !== undefined);

  const passagens = volumes.map((v, i) =>
    i === 0 ? null : volumes[i - 1] > 0 ? (v / volumes[i - 1]) * 100 : null,
  );
  const validas = passagens.filter((p): p is number => p !== null);
  const menorPassagem = validas.length ? Math.min(...validas) : null;
  const idxGargalo = menorPassagem === null ? -1 : passagens.indexOf(menorPassagem);

  return (
    <div className="pc-panel">
      <div className="pc-panel-title">
        <span>Funil de conversão — etapa por etapa</span>
        <StatusBadge status={statusFromData(ordenadas.length > 0, hasTempo)} />
      </div>

      <div className="pc-funil">
        <div className="pc-funil-head">
          <span>Etapa</span>
          <span>Volume</span>
          <span className="ta-r">Hoje</span>
          <span className="ta-r">Méd</span>
          <span className="ta-r">Perda</span>
        </div>

        {ordenadas.map((r, i) => {
          const volume = volumes[i];
          const largura = topo > 0 ? Math.max(4, (volume / topo) * 100) : 100;
          const passagem = passagens[i];
          const gargalo = i === idxGargalo;
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
            <div key={`${r.etapa}-${r.ordem}`} className="pc-funil-group">
              {passagem !== null && (
                <div className={`pc-passagem${gargalo ? " is-gargalo" : ""}`}>
                  ↓ <b>{fmtPct(passagem)}</b> passagem{gargalo ? " — maior gargalo" : ""}
                </div>
              )}
              <div className="pc-funil-row" title={r.etapa ?? undefined}>
                <span className="fr-nome">{r.etapa ?? "—"}</span>
                <span className="fr-barwrap">
                  <span
                    className={`pc-funil-bar${isFinal ? " is-final" : ""}`}
                    data-ordem={r.ordem ?? i + 1}
                    style={{ width: `${largura}%` }}
                  >
                    <span className="fr-qtd-in">{fmtNum(volume)}</span>
                  </span>
                </span>
                <span className="fr-num">{fmtNum(r.atual)}</span>
                <span className="fr-num">{fmtDias(r.media_dias)}</span>
                <span className="fr-num">
                  <span className={`pc-perda${perdaClass}`}>{fmtPct(perda)}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}