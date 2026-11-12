/** Divide o tempo restante (ms) em dias/horas/minutos/segundos para o cronômetro. */
export function countdownParts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    done: total === 0,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function countdownLabel(ms: number) {
  const p = countdownParts(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(p.hours)}h ${pad(p.minutes)}m ${pad(p.seconds)}s`;
  return p.days > 0 ? `${p.days}d ${clock}` : clock;
}
