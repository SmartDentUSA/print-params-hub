import { test } from "node:test";
import assert from "node:assert/strict";
import { eventPromotionRevenue } from "./eventPromotionRevenue";

test("total da promoção soma conversões consolidadas e pedidos pagos da loja", () => {
  assert.equal(eventPromotionRevenue(49817.60, 2023.07), 51840.67);
});

test("promoção sem conversões nem pedidos pagos totaliza zero", () => {
  assert.equal(eventPromotionRevenue(0, 0), 0);
});