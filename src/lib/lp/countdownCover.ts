/** Capa da Bio com contagem regressiva por fases (apenas apresentação; datas vêm da landing). */
export type CoverPhase = { pct: number; end: string; label: string; short?: string };
export type CountdownCover = {
  type: "countdown";
  logo_url?: string | null;
  wordmark_url?: string | null;
  wordmark_alt?: string | null;
  headline: string;
  highlight?: string | null;
  lead?: string | null;
  start: string;
  phases: CoverPhase[];
};

export function parseCountdownCover(raw: unknown): CountdownCover | null {
  const r = raw as any;
  if (!r || r.type !== "countdown" || !Array.isArray(r.phases)) return null;
  const phases = r.phases
    .map((p: any) => ({ pct: Number(p?.pct), end: String(p?.end ?? ""), label: String(p?.label ?? ""), short: p?.short ? String(p.short) : undefined }))
    .filter((p: CoverPhase) => Number.isFinite(p.pct) && !Number.isNaN(Date.parse(p.end)))
    .sort((a: CoverPhase, b: CoverPhase) => Date.parse(a.end) - Date.parse(b.end));
  if (!phases.length || Number.isNaN(Date.parse(r.start)) || !r.headline) return null;
  return {
    type: "countdown",
    logo_url: r.logo_url ?? null,
    wordmark_url: r.wordmark_url ?? null,
    wordmark_alt: r.wordmark_alt ?? null,
    headline: String(r.headline),
    highlight: r.highlight ?? null,
    lead: r.lead ?? null,
    start: String(r.start),
    phases,
  };
}

export type CoverState =
  | { status: "before"; remainingMs: number; phaseIndex: -1 }
  | { status: "active"; remainingMs: number; phaseIndex: number }
  | { status: "ended"; remainingMs: 0; phaseIndex: -1 };

/** Fase vigente e tempo até o fim dela (ou até o início, antes da campanha). */
export function coverState(cover: CountdownCover, nowMs: number): CoverState {
  const start = Date.parse(cover.start);
  if (nowMs < start) return { status: "before", remainingMs: start - nowMs, phaseIndex: -1 };
  const idx = cover.phases.findIndex((p) => nowMs < Date.parse(p.end));
  if (idx === -1) return { status: "ended", remainingMs: 0, phaseIndex: -1 };
  return { status: "active", remainingMs: Date.parse(cover.phases[idx].end) - nowMs, phaseIndex: idx };
}

export function splitRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    d: pad(Math.floor(total / 86400)),
    h: pad(Math.floor((total % 86400) / 3600)),
    m: pad(Math.floor((total % 3600) / 60)),
    s: pad(total % 60),
  };
}
