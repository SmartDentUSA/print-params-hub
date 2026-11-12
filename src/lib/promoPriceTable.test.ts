import { test } from "node:test";
import assert from "node:assert/strict";
import { planOfficialSync, promoRowFromOfficial } from "./promoPriceTable";

test("exclusive table starts from the Loja Oficial selling price with 0% campaign discount", () => {
  const row = promoRowFromOfficial({ name: "Resina", sku: "R1", price_base: 500, discount_pct: 20, price_dealer: 400 }, "list", 0);
  assert.equal(row.price_base, 400);
  assert.equal(row.discount_pct, 0);
  assert.equal(row.price_dealer, 400);
});

test("syncing from Loja Oficial keeps the campaign discount already applied", () => {
  const { updates, inserts } = planOfficialSync(
    [{ id: "a", name: "Resina", sku: "R1", price_base: 400, discount_pct: 10, price_dealer: 360 }],
    [{ name: "Resina", sku: "R1", price_base: 600, discount_pct: 25, price_dealer: 450 }],
    "list",
  );
  assert.equal(inserts.length, 0);
  assert.equal(updates[0].patch.price_base, 450);
  assert.equal(updates[0].patch.price_dealer, 405);
});

test("new Loja Oficial items enter the exclusive table and inactive ones are skipped", () => {
  const { inserts } = planOfficialSync([], [
    { name: "Novo", sku: "N1", price_base: 100, price_dealer: 90 },
    { name: "Inativo", sku: "I1", price_base: 100, price_dealer: 90, is_active: false },
  ], "list");
  assert.deepEqual(inserts.map((row) => row.sku), ["N1"]);
});
