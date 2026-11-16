import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalogProductOptions } from "./catalogProductOptions";

const rows = [
  { id: "1", name: "Impressora 3D Elegoo Mars 5 Ultra", category: "product", active: true },
  { id: "2", name: "Dr. Fulano de Tal", category: "video_testimonial", active: true },
  { id: "3", name: "Impressão 3D", category: "category_config", active: true },
  { id: "4", name: "Smart Dent", category: "company_info", active: true },
  { id: "5", name: "Resina Vitality", category: "resin", active: true },
  { id: "6", name: "Produto antigo", category: "product", active: false },
];

test("mostra só produtos comerciais ativos, sem clientes, categorias ou dados da empresa", () => {
  const names = buildCatalogProductOptions(rows).map((o) => o.name);
  assert.deepEqual(names, ["Impressora 3D Elegoo Mars 5 Ultra", "Resina Vitality"]);
});

test("mantém visível um vínculo já salvo que saiu do catálogo, marcado como fora do catálogo", () => {
  const opts = buildCatalogProductOptions(rows, [rows[1]]);
  const linked = opts.find((o) => o.id === "2");
  assert.equal(linked?.outsideCatalog, true);
  assert.equal(opts.filter((o) => !o.outsideCatalog).length, 2);
});
