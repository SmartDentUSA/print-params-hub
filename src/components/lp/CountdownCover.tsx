import { useEffect, useState } from "react";
import { coverState, splitRemaining, type CountdownCover as Cover } from "@/lib/lp/countdownCover";

/** Capa viva do card da Bio: mesma abertura da landing, com o cronômetro da fase atual em tempo real. */
export function CountdownCover({ cover }: { cover: Cover }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const state = coverState(cover, now);
  const t = splitRemaining(state.remainingMs);
  const phase = state.status === "active" ? cover.phases[state.phaseIndex] : null;
  const total = cover.phases.length;

  return (
    <div className="countdown-cover">
      <div className="cc-inner">
        <div className="cc-brand">
          {cover.logo_url && <img className="cc-logo" src={cover.logo_url} alt="Smart Dent" loading="lazy" decoding="async" />}
          {cover.wordmark_url && <img className="cc-wordmark" src={cover.wordmark_url} alt={cover.wordmark_alt ?? ""} loading="lazy" decoding="async" />}
          <p className="cc-headline">
            {cover.headline} {cover.highlight && <span className="cc-hot">{cover.highlight}</span>}
          </p>
          {cover.lead && <p className="cc-lead">{cover.lead}</p>}
        </div>

        <div className="cc-clock" role="timer" aria-live="off">
          <p className="cc-kicker">
            {phase ? `Fase ${state.phaseIndex + 1} de ${total} · ${phase.label}` : state.status === "before" ? "Começa em breve" : "Campanha encerrada"}
          </p>
          <p className="cc-title">
            {phase ? (<><em>{phase.pct}% OFF</em> termina em:</>) : state.status === "before" ? "Os descontos começam em:" : "Obrigado por participar!"}
          </p>
          {state.status !== "ended" && (
            <div className="cc-cells">
              {([["d", "dias"], ["h", "horas"], ["m", "min"], ["s", "seg"]] as const).map(([k, label]) => (
                <div key={k} className="cc-cell"><b>{t[k]}</b><small>{label}</small></div>
              ))}
            </div>
          )}
          <div className="cc-steps">
            {cover.phases.map((p, i) => (
              <div key={p.end} className={`cc-step${i === state.phaseIndex ? " is-active" : ""}${state.status === "active" && i < state.phaseIndex ? " is-past" : ""}`}>
                <strong>{p.pct}<sup>%</sup></strong>
                <span>OFF</span>
                <small>{p.short ?? p.label}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
