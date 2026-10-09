import { test } from "node:test";
import assert from "node:assert/strict";
import { activeKolCouponCodes, kolCardChannels } from "./kolCardMetrics";
test("separates forms/coupons and sums the total", () => {
  assert.deepEqual(kolCardChannels({ receita: 71714, receitaCupons: 2000, comissaoLeads: 1022, comissaoCupons: 100, comissao: 1122 }).map(r => [r.revenue, r.commission]), [[71714, 1022], [2000, 100], [73714, 1122]]);
});
test("missing commission remains null", () => {
  assert.deepEqual(kolCardChannels({ receita: 100, receitaCupons: 20, comissao: null, comissaoLeads: 0, comissaoCupons: 0 }).map(r => r.commission), [null, null, null]);
});
test("active coupons include validity boundaries, not expired/future", () => {
  assert.deepEqual(activeKolCouponCodes([{ code: " erick ", active_from: "2026-10-08", active_to: "2026-10-08" }, { code: "OLD", active_to: "2026-10-07" }, { code: "NEW", active_from: "2026-10-09" }, { code: "ERICK" }], "2026-10-08"), ["ERICK"]);
});
