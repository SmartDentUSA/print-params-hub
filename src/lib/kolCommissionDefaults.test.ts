import { test } from "node:test";
import assert from "node:assert/strict";
import { couponRuleFor, isKolRowCustomized, kolRowKey, mapTemplateItems } from "./kolCommissionDefaults";

const defaults = mapTemplateItems([
  { kind: "categoria", category: "1. SCAN", subcategory: null, percent: 5, coupon_discount_percent: 10 },
]);
const def = defaults.get(kolRowKey({ kind: "category", category: "1. SCAN", subcategory: null, product_id: "" }));

test("row equal to default is not customized", () => {
  assert.equal(isKolRowCustomized({ percent: 5, coupon_discount_percent: 10 }, def), false);
});

test("row with different KOL percent is customized", () => {
  assert.equal(isKolRowCustomized({ percent: 7, coupon_discount_percent: 10 }, def), true);
});

test("coupon rule prefers subcategory over category", () => {
  const rules = [
    { kind: "category", category: "2. CAD", subcategory: null, percent: 3 },
    { kind: "category", category: "2. CAD", subcategory: "2.1 Software", percent: 8 },
  ];
  assert.equal(couponRuleFor(rules, "2. CAD", "2.1 Software")?.percent, 8);
  assert.equal(couponRuleFor(rules, "2. CAD", null)?.percent, 3);
});
