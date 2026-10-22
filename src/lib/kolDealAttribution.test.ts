import { test } from "node:test";
import assert from "node:assert/strict";
import { isKolFormDeal } from "./kolDealAttribution";

const names = ["# - INDICAÇÃO - exocad DentalCad RMS - Erick Souza", "# - INDICAÇÃO - Erick Souza"];
const deals = [
  { origin_name: names[0], value: 3580 },
  { origin_name: "Indicação/KOL", value: 3484, commission: 69.68 },
  { origin_name: names[1], value: 61070 },
  { origin_name: names[0], value: 3580 },
];

test("Erick's card excludes the generic KOL sale and matches portal revenue R$68,230", () => {
  const attributed = deals.filter((deal) => isKolFormDeal(deal, names));
  assert.equal(attributed.reduce((sum, deal) => sum + deal.value, 0), 68230);
  assert.equal(deals.reduce((sum, deal) => sum + deal.value, 0), 71714);
});

test("the excluded R$3,484 sale cannot contribute its R$69.68 commission", () => {
  const excluded = deals.filter((deal) => !isKolFormDeal(deal, names));
  assert.equal(excluded.reduce((sum, deal) => sum + (deal.commission ?? 0), 0), 69.68);
});

test("deleted deals are excluded even when the origin matches", () => {
  assert.equal(isKolFormDeal({ origin_name: names[0], is_deleted: true }, names), false);
});

test("origin matching normalizes accents and separators without accepting other professionals", () => {
  assert.equal(isKolFormDeal({ origin_name: "# INDICACAO Erick Souza" }, names), true);
  assert.equal(isKolFormDeal({ origin_name: "# - INDICAÇÃO - Danilo Henrique" }, names), false);
});