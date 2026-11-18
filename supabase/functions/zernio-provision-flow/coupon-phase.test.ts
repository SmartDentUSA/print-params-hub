import { expect, test } from "bun:test";
import { fillCouponTemplate, pickCouponPhase, saoPauloToday, type PhaseCoupon } from "./coupon-phase";

const C = (code: string, v: number, from: string, until: string): PhaseCoupon =>
  ({ code, discount_type: "percent", discount_value: v, valid_from: from, valid_until: until, active: true });
const black = [C("BLACKBD25", 25, "2026-11-13", "2026-11-20"), C("BLACKBD15", 15, "2026-11-21", "2026-11-25"), C("BLACKBD10", 10, "2026-11-26", "2026-11-30")];
const code = (d: string) => { const r = pickCouponPhase(black, d); return r.status === "active" ? r.coupon.code : r.status; };

test("16 a 20/11 envia BLACKBD25", () => { expect(code("2026-11-16")).toBe("BLACKBD25"); expect(code("2026-11-20")).toBe("BLACKBD25"); });
test("21 a 25/11 envia BLACKBD15", () => { expect(code("2026-11-21")).toBe("BLACKBD15"); expect(code("2026-11-25")).toBe("BLACKBD15"); });
test("26 a 30/11 envia BLACKBD10", () => { expect(code("2026-11-26")).toBe("BLACKBD10"); expect(code("2026-11-30")).toBe("BLACKBD10"); });
test("depois de 30/11 a promoção termina", () => { expect(code("2026-12-01")).toBe("ended"); });
test("cupom desativado não é enviado", () => {
  const r = pickCouponPhase([black[0], { ...black[1], active: false }, black[2]], "2026-11-22");
  expect(r.status).toBe("not_started");
});
test("a troca acontece à meia-noite de São Paulo, não de Londres", () => {
  expect(saoPauloToday(new Date("2026-11-21T02:30:00Z"))).toBe("2026-11-20");
  expect(saoPauloToday(new Date("2026-11-21T03:00:00Z"))).toBe("2026-11-21");
});
test("modelo recebe código, desconto e validade", () => {
  expect(fillCouponTemplate("{cupom} {desconto} até {validade}", black[0])).toBe("BLACKBD25 25% até 20/11");
});
