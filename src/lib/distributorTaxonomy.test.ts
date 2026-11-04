import { test } from "node:test";
import assert from "node:assert/strict";
import { distributorTaxonomyCategory, uniqueDistributorSubcategories } from "./distributorTaxonomy";

test("3D resins belong to resins rather than printers", () => {
  assert.equal(distributorTaxonomyCategory("3. IMPRESSÃO 3D", "3.1 RESINAS 3D - BIOCOMPATÍVEIS"), "RESINAS 3D");
});
test("direct composites remain separate from 3D resins", () => {
  assert.equal(distributorTaxonomyCategory("6. DENTÍSTICA, ESTÉTICA E ORTODONTIA", "6.3 RESINAS COMPOSTAS"), "DENTÍSTICA, ESTÉTICA E ORTODONTIA");
});
test("dentistry and orthodontics do not belong to characterization", () => {
  assert.equal(distributorTaxonomyCategory("5. CARACTERIZAÇÃO", "5.3 Dentística/Orto"), "DENTÍSTICA, ESTÉTICA E ORTODONTIA");
});
test("equivalent subcategories deduplicate without replacing canonical submitted values or brands", () => {
  assert.deepEqual(uniqueDistributorSubcategories(["5.1 Caracterização", "CARACTERIZAÇÃO", "5.1 CARACTERIZAÇÃO SMARTMAKE"]),
    ["5.1 Caracterização", "5.1 CARACTERIZAÇÃO SMARTMAKE"]);
});