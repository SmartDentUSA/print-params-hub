// Interpretação das respostas digitadas no passo a passo do Copilot.
// Puro (sem rede) para poder ser testado.

export type WizardOption = { value: string; label: string; hint?: string };

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Aceita 25/11/2026, 25/11, 2026-11-25, "hoje" e "amanhã". Devolve AAAA-MM-DD ou null. */
export function parseDateBR(raw: string, today: string): string | null {
  const t = String(raw || "").trim().toLowerCase();
  if (!t) return null;
  const base = new Date(`${today}T12:00:00`);
  if (t === "hoje") return today;
  if (t === "amanha" || t === "amanhã") { base.setDate(base.getDate() + 1); return isoDate(base); }
  let y: number, m: number, d: number;
  let mt = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mt) { y = +mt[1]; m = +mt[2]; d = +mt[3]; }
  else {
    mt = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
    if (!mt) return null;
    d = +mt[1]; m = +mt[2];
    y = mt[3] ? (mt[3].length === 2 ? 2000 + +mt[3] : +mt[3]) : base.getFullYear();
    if (!mt[3] && `${y}-${pad(m)}-${pad(d)}` < today) y += 1;
  }
  const dt = new Date(y, m - 1, d, 12);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export const formatDateBR = (iso: string | null | undefined) =>
  iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—";

/** Aceita "R$ 1.234,56", "1234,5", "1234.56", "1.234". Devolve número ou null. */
export function parseMoneyBR(raw: string): number | null {
  let t = String(raw || "").replace(/r\$|us\$|€|\$|\s/gi, "");
  if (!t || !/^-?[\d.,]+$/.test(t)) return null;
  const lastComma = t.lastIndexOf(","), lastDot = t.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    t = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastComma > -1) {
    t = (t.match(/,/g) || []).length > 1 ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (lastDot > -1) {
    const dots = (t.match(/\./g) || []).length;
    if (dots > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function parseQuantity(raw: string): number | null {
  const n = parseMoneyBR(raw);
  return n !== null && n > 0 ? n : null;
}

export const money = (v: number, cur = "BRL") => {
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur }).format(v || 0); } catch { return (v || 0).toFixed(2); }
};

export const discountPct = (market: number, promo: number) =>
  market > 0 ? Math.round(((market - promo) / market) * 1000) / 10 : 0;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Resposta digitada numa pergunta de escolha: aceita o número da opção ou o texto do botão. */
export function matchOption(raw: string, options: WizardOption[]): WizardOption | null {
  const t = norm(raw);
  if (!t) return null;
  const idx = Number(t);
  if (Number.isInteger(idx) && idx >= 1 && idx <= options.length) return options[idx - 1];
  return options.find((o) => norm(o.label) === t || o.value === raw.trim())
    ?? options.find((o) => norm(o.label).startsWith(t))
    ?? null;
}

const YES = new Set(["sim", "s", "yes", "quero", "pode", "ok", "isso"]);
const NO = new Set(["nao", "não", "n", "no", "nenhum", "nenhuma"]);
export function parseYesNo(raw: string): boolean | null {
  const t = norm(raw).replace(/[.!]/g, "");
  if (YES.has(t)) return true;
  if (NO.has(t) || NO.has(t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) return false;
  return null;
}
