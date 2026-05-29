// Centralized America/Sao_Paulo timezone helpers for WhatsApp scheduling.
// Uses Intl.DateTimeFormat to derive the correct offset (handles eventual DST returns)
// instead of hardcoding +3.

export const SP_TZ = 'America/Sao_Paulo'

const PARTS_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: SP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function spParts(d: Date) {
  const o: Record<string, string> = {}
  for (const p of PARTS_FMT.formatToParts(d)) {
    if (p.type !== 'literal') o[p.type] = p.value
  }
  return {
    year: Number(o.year),
    month: Number(o.month),
    day: Number(o.day),
    hour: Number(o.hour === '24' ? '0' : o.hour),
    minute: Number(o.minute),
    second: Number(o.second),
  }
}

// Offset in minutes between SP local time and UTC at instant `d` (e.g. -180 for BRT).
function spOffsetMinutes(d: Date): number {
  const p = spParts(d)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - d.getTime()) / 60000)
}

// Returns the UTC instant for `YYYY-MM-DD HH:MM` (SP local time),
// where the date portion comes from `base` interpreted in SP.
export function spDateTimeToUtc(base: Date, hh: number, mm: number): Date {
  const p = spParts(base)
  // First UTC guess assuming SP=UTC (will be off by the offset).
  const guess = new Date(Date.UTC(p.year, p.month - 1, p.day, hh, mm, 0))
  const offsetMin = spOffsetMinutes(guess)
  // local = utc + offset  =>  utc = local - offset
  return new Date(guess.getTime() - offsetMin * 60000)
}

// Day-of-week (0=Sun..6=Sat) in SP timezone.
export function spWeekday(d: Date): number {
  const p = spParts(d)
  // Use UTC date built from SP parts so getUTCDay reflects SP weekday.
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
}

// Returns the UTC instant of 00:00 SP for the SP day containing `d`.
export function spStartOfDay(d: Date = new Date()): Date {
  return spDateTimeToUtc(d, 0, 0)
}

// Adds N calendar days in SP, preserving the SP wall-clock hh:mm.
export function addDaysSp(base: Date, days: number): Date {
  const p = spParts(base)
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + days))
  return spDateTimeToUtc(shifted, p.hour, p.minute)
}