// Cronômetro de campanha em e-mail. O e-mail não roda script, então o cronômetro é uma
// imagem animada gerada na hora em que o e-mail é aberto (função email-countdown), com as
// mesmas fases e textos da landing (CONFIG.start / CONFIG.phases / CONFIG.campaign).

export type CountdownKind = "tier" | "fixed" | "end";

export interface CountdownConfig {
  /** início da campanha (ms) */
  start: number;
  /** fim de cada fase (ms), em ordem */
  ends: number[];
  /** desconto de cada fase (%), mesma ordem de ends */
  pcts: number[];
  campaign: string;
}

export interface CountdownState {
  label: string;
  next: string;
  /** instante que o cronômetro mostra (ms); 0 quando acabou */
  end: number;
  over: boolean;
}

const MAX_PHASES = 6;

/** Lê o CONFIG da landing (start, phases [{pct,end}], campaign). */
export function parseLandingCountdownConfig(html: string): CountdownConfig | null {
  const src = String(html || "");
  const start = Date.parse(src.match(/\bstart\s*:\s*['"]([^'"]+)['"]/)?.[1] || "");
  const block = src.match(/\bphases\s*:\s*\[([\s\S]*?)\]/)?.[1] || "";
  const ends: number[] = [];
  const pcts: number[] = [];
  const re = /\{[^{}]*?\bpct\s*:\s*(\d{1,2})[^{}]*?\bend\s*:\s*['"]([^'"]+)['"][^{}]*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) && ends.length < MAX_PHASES) {
    const end = Date.parse(m[2]);
    if (!Number.isFinite(end)) return null;
    pcts.push(Number(m[1]));
    ends.push(end);
  }
  const campaign = (src.match(/\bcampaign\s*:\s*['"]([^'"]{1,24})['"]/)?.[1] || "").trim();
  if (!Number.isFinite(start) || !ends.length) return null;
  for (let i = 0; i < ends.length; i++) if (ends[i] <= (i ? ends[i - 1] : start)) return null;
  return { start, ends, pcts, campaign };
}

/** Data dd/mm em Brasília (UTC-3) do último dia válido antes de `ms`. */
export function lastDayLabel(ms: number): string {
  const d = new Date(ms - 1 - 3 * 3600e3);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Mesma lógica dos cronômetros dos cards da landing. */
export function countdownState(now: number, cfg: CountdownConfig, kind: CountdownKind, fixedPct = 0): CountdownState {
  const n = cfg.ends.length;
  const tEnd = cfg.ends[n - 1];
  const until = lastDayLabel(tEnd);
  let ph = n + 1;
  if (now < cfg.start) ph = 0;
  else { for (let i = 0; i < n; i++) if (now < cfg.ends[i]) { ph = i + 1; break; } }
  if (ph === n + 1) return { label: "Oferta encerrada", next: "A campanha terminou. Fale com um consultor.", end: 0, over: true };
  if (ph === 0) return { label: "Começa em", next: `A primeira fase será de ${cfg.pcts[0]}% OFF.`, end: cfg.start, over: false };
  if (kind === "tier") {
    return {
      label: `Fase ${ph} · ${cfg.pcts[ph - 1]}% OFF termina em`,
      next: ph < n
        ? `Depois disso o desconto cai para ${cfg.pcts[ph]}% OFF (fase ${ph + 1}).`
        : `Última fase. Depois de ${until} o preço volta ao normal.`,
      end: cfg.ends[ph - 1],
      over: false,
    };
  }
  if (kind === "fixed") {
    return {
      label: `${fixedPct > 0 ? `${fixedPct}% OFF fixo` : "Desconto fixo"} termina em`,
      next: `Desconto fixo até ${until}, sem mudar de fase.`,
      end: tEnd,
      over: false,
    };
  }
  return {
    label: `Condição ${cfg.campaign || "especial"} termina em`,
    next: `Válido até ${until} dentro da campanha.`,
    end: tEnd,
    over: false,
  };
}

export function countdownParts(ms: number): { d: number; h: number; m: number; s: number } {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.min(99, Math.floor(t / 86400)), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

/** Endereço da imagem do cronômetro (a própria URL carrega as fases; nada é lido do banco). */
export function countdownImageUrl(baseUrl: string, cfg: CountdownConfig, kind: CountdownKind, fixedPct = 0): string {
  const q = new URLSearchParams();
  q.set("k", kind);
  q.set("s", String(Math.round(cfg.start / 1000)));
  q.set("e", cfg.ends.map((e) => Math.round(e / 1000)).join("-"));
  q.set("p", cfg.pcts.join("-"));
  if (cfg.campaign) q.set("c", cfg.campaign);
  if (kind === "fixed" && fixedPct > 0) q.set("f", String(fixedPct));
  return `${baseUrl.replace(/\/+$/, "")}/functions/v1/email-countdown?${q.toString()}`;
}

export function parseCountdownParams(params: URLSearchParams):
  { cfg: CountdownConfig; kind: CountdownKind; fixedPct: number } | null {
  const kindRaw = params.get("k") || "tier";
  if (kindRaw !== "tier" && kindRaw !== "fixed" && kindRaw !== "end") return null;
  const num = (s: string) => (/^\d{1,12}$/.test(s) ? Number(s) : NaN);
  const start = num(params.get("s") || "") * 1000;
  const ends = (params.get("e") || "").split("-").filter(Boolean).map((s) => num(s) * 1000);
  const pcts = (params.get("p") || "").split("-").filter(Boolean).map((s) => (/^\d{1,2}$/.test(s) ? Number(s) : NaN));
  const campaign = (params.get("c") || "").replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 24);
  const f = params.get("f") || "";
  const fixedPct = /^\d{1,2}$/.test(f) ? Number(f) : 0;
  if (!Number.isFinite(start) || !ends.length || ends.length > MAX_PHASES || pcts.length !== ends.length) return null;
  if (ends.some((e) => !Number.isFinite(e)) || pcts.some((p) => !Number.isFinite(p))) return null;
  for (let i = 0; i < ends.length; i++) if (ends[i] <= (i ? ends[i - 1] : start)) return null;
  return { cfg: { start, ends, pcts, campaign }, kind: kindRaw, fixedPct };
}
