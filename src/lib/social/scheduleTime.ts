// Conversões entre o campo "datetime-local" (hora de parede) e o instante real (ISO/UTC),
// sempre respeitando o fuso escolhido no post — nunca o fuso do navegador.

const pad = (n: number) => String(n).padStart(2, '0');

function tzParts(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

function tzOffsetMs(date: Date, tz: string) {
  const p = tzParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** "2026-09-10T11:33" + "America/Sao_Paulo" -> ISO UTC do instante correspondente */
export function localInputToIso(value: string | null | undefined, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? '');
  if (!m) return null;
  const zone = tz || 'America/Sao_Paulo';
  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  let ts = naive - tzOffsetMs(new Date(naive), zone);
  ts = naive - tzOffsetMs(new Date(ts), zone); // segunda passada resolve bordas de horário de verão
  return new Date(ts).toISOString();
}

/** ISO UTC -> "2026-09-10T08:33" na hora de parede do fuso informado */
export function isoToLocalInput(iso: string | null | undefined, tz: string): string {
  if (!iso) return '';
  const p = tzParts(new Date(iso), tz || 'America/Sao_Paulo');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Hora de parede atual (no fuso informado) deslocada em minutos */
export function nowLocalInput(tz: string, offsetMinutes = 0): string {
  return isoToLocalInput(new Date(Date.now() + offsetMinutes * 60_000).toISOString(), tz);
}
