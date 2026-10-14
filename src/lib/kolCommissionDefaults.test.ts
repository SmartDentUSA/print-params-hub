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

test("template item 'indicacao' maps to referral row with its own key", () => {
  const m = mapTemplateItems([
    { kind: "indicacao", category: null, subcategory: null, percent: 4, coupon_discount_percent: null },
  ]);
  const row = m.get(kolRowKey({ kind: "referral", category: null, subcategory: null, product_id: "" }));
  assert.equal(row?.kind, "referral");
  assert.equal(row?.percent, 4);
  assert.notEqual(
    kolRowKey({ kind: "referral", category: null, subcategory: null, product_id: "" }),
    kolRowKey({ kind: "product", category: null, subcategory: null, product_id: "" }),
  );
});

test("same category in different channels has different keys", () => {
  const base = { kind: "category", category: "1. SCAN", subcategory: null, product_id: "" };
  assert.notEqual(kolRowKey({ ...base, channel: "indicacao" }), kolRowKey({ ...base, channel: "cupom" }));
  assert.notEqual(kolRowKey({ ...base, channel: "formulario" }), kolRowKey({ ...base, channel: "cupom" }));
});

test("coupon rule ignores referral-channel rules", () => {
  const rules = [{ kind: "category", channel: "indicacao", category: "1. SCAN", subcategory: null, percent: 9 }];
  assert.equal(couponRuleFor(rules, "1. SCAN", null), undefined);
});

test("row marked source=custom is customized even when equal to default", () => {
  assert.equal(isKolRowCustomized({ percent: 5, coupon_discount_percent: 10, source: "custom" }, def), true);
});
