import { test } from "node:test";
import assert from "node:assert/strict";
import { groupKolCatalogCategories, kolPortfolioStage } from "./kolPortfolioGroups";

test("organizes catalog categories into seven portfolio stages", () => {
  assert.deepEqual([
    "1. SCAN", "2. CAD", "3. IMPRESSÃO 3D", "4. PÓS-IMPRESSÃO",
    "5. CARACTERIZAÇÃO", "6. Cursos", "7. Fresagem",
  ].map(kolPortfolioStage), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(groupKolCatalogCategories([]).length, 7);
});

test("dentistry belongs to finalization, not courses", () => {
  assert.equal(kolPortfolioStage("6. DENTÍSTICA, ESTÉTICA E ORTODONTIA"), 5);
});

test("grouping preserves commission identifiers and unmapped items", () => {
  const categories = [
    { cat: "1. SCAN", subs: ["1.2 Scanner Bancada", "1.2 SCANNER BANCADA"] },
    { cat: "SOLUÇÔES", subs: [] },
  ];
  const groups = groupKolCatalogCategories(categories);
  assert.strictEqual(groups[0].categories[0], categories[0]);
  assert.deepEqual(groups[0].categories[0].subs, categories[0].subs);
  assert.strictEqual(groups[7].categories[0], categories[1]);
});