// Fluxos do Instagram com cupom por fase: o texto da DM troca conforme a validade
// dos cupons cadastrados em promotional_coupons (fonte única das datas).
export type PhaseCoupon = {
  code: string;
  discount_type: string | null;
  discount_value: number | null;
  valid_from: string | null; // YYYY-MM-DD
  valid_until: string | null; // YYYY-MM-DD
  active: boolean | null;
};

/** Data de hoje em São Paulo (YYYY-MM-DD). */
export function saoPauloToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Cupom vigente hoje; "ended" quando todos já venceram; "not_started" antes do primeiro. */
export function pickCouponPhase(coupons: PhaseCoupon[], today: string):
  { status: "active"; coupon: PhaseCoupon } | { status: "ended" | "not_started" | "none" } {
  const list = coupons.filter((c) => c.active !== false && c.code);
  if (!list.length) return { status: "none" };
  const current = list
    .filter((c) => (!c.valid_from || c.valid_from <= today) && (!c.valid_until || c.valid_until >= today))
    .sort((a, b) => String(b.valid_from ?? "").localeCompare(String(a.valid_from ?? "")))[0];
  if (current) return { status: "active", coupon: current };
  const lastEnd = list.map((c) => c.valid_until ?? "9999-12-31").sort().at(-1)!;
  return { status: lastEnd < today ? "ended" : "not_started" };
}

function br(d: string | null): string {
  if (!d) return "";
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

/** Preenche {cupom}, {desconto} e {validade} do modelo da DM. */
export function fillCouponTemplate(template: string, c: PhaseCoupon): string {
  const off = c.discount_type === "percent" ? `${Number(c.discount_value)}%` : `R$ ${Number(c.discount_value)}`;
  return template
    .replaceAll("{cupom}", c.code.toUpperCase())
    .replaceAll("{desconto}", off)
    .replaceAll("{validade}", br(c.valid_until));
}
