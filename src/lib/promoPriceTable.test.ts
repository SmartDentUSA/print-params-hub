import { test } from "node:test";
import assert from "node:assert/strict";
import { planOfficialSync, promoRowFromOfficial } from "./promoPriceTable";

test("exclusive table starts from the Loja Oficial 'Preço tabela (Unit)', not the dealer price", () => {
  const row = promoRowFromOfficial({ name: "Resina", sku: "R1", price_base: 1859, discount_pct: 10, price_dealer: 1673.1 }, "list", 0);
  assert.equal(row.price_base, 1859);
  assert.equal(row.discount_pct, 0);
  assert.equal(row.price_dealer, 1859);
});

test("syncing from Loja Oficial keeps the campaign discount already applied", () => {
  const { updates, inserts } = planOfficialSync(
    [{ id: "a", name: "Resina", sku: "R1", price_base: 400, discount_pct: 10, price_dealer: 360 }],
    [{ name: "Resina", sku: "R1", price_base: 600, discount_pct: 25, price_dealer: 450 }],
    "list",
  );
  assert.equal(inserts.length, 0);
  assert.equal(updates[0].patch.price_base, 600);
  assert.equal(updates[0].patch.price_dealer, 540);
});

test("new Loja Oficial items enter the exclusive table and inactive ones are skipped", () => {
  const { inserts } = planOfficialSync([], [
    { name: "Novo", sku: "N1", price_base: 100, price_dealer: 90 },
    { name: "Inativo", sku: "I1", price_base: 100, price_dealer: 90, is_active: false },
  ], "list");
  assert.deepEqual(inserts.map((row) => row.sku), ["N1"]);
});

test("cloning another promotion keeps its prices and campaign discounts", async () => {
  const { clonedPromoRows } = await import("./promoPriceTable");
  const rows = clonedPromoRows([
    { name: "Resina", sku: "R1", price_base: 400, discount_pct: 15, price_dealer: 340 },
    { name: "Oculto", sku: "O1", price_base: 100, discount_pct: 0, price_dealer: 100, is_active: false },
  ], "target");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price_list_id, "target");
  assert.equal(rows[0].price_base, 400);
  assert.equal(rows[0].discount_pct, 15);
  assert.equal(rows[0].price_dealer, 340);
});
