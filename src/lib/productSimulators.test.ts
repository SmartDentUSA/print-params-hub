import { test } from "node:test";
import assert from "node:assert/strict";
import { groupProductSimulators, productIdFromSimulator, productSimulatorId, productSimulatorUrl } from "./productSimulators";

const ELEGOO = "e3e1e4cd-0000-4000-8000-000000000001";
const FORM = "e0467abe-8628-4f12-894f-90e1439cf682";

test("o link do produto abre o simulador do mesmo formulário com o produto já escolhido", () => {
  const u = new URL(productSimulatorUrl({ formId: FORM, productId: ELEGOO, base: "https://www.smartdent.com.br", origin: "email" }));
  assert.equal(u.pathname, "/embed/dra-lia");
  assert.equal(u.searchParams.get("form"), FORM);
  assert.equal(u.searchParams.get("pid"), ELEGOO);
  assert.equal(u.searchParams.get("sim"), `p-${ELEGOO}`);
  assert.equal(u.searchParams.get("utm_term"), "email");
});

test("o identificador do simulador cabe no limite de 80 caracteres e volta para o produto", () => {
  assert.ok(productSimulatorId(ELEGOO).length <= 80);
  assert.equal(productIdFromSimulator(productSimulatorId(ELEGOO)), ELEGOO);
  assert.equal(productIdFromSimulator("geral-topo"), null);
});

test("todos os produtos comerciais ativos entram, clientes e inativos ficam fora", () => {
  const groups = groupProductSimulators([
    { id: ELEGOO, name: "Impressora 3D Elegoo Mars 5 Ultra", category: "product", active: true, product_category: "3. IMPRESSÃO 3D" },
    { id: "b", name: "Scanner X", category: "product", active: true, product_category: "1. SCAN" },
    { id: "c", name: "Dr. Cliente", category: "video_testimonial", active: true, product_category: null },
    { id: "d", name: "Antigo", category: "product", active: false, product_category: "1. SCAN" },
  ]);
  assert.deepEqual(groups.map((g) => g.category), ["SCAN", "IMPRESSÃO 3D"]);
  assert.deepEqual(groups.flatMap((g) => g.items.map((i) => i.name)), ["Scanner X", "Impressora 3D Elegoo Mars 5 Ultra"]);
});

test("campanha comercial lista o simulador de todos os produtos, mesmo sem movimento, sem repetir", async () => {
  const { withAllProductSimulators } = await import("./productSimulators");
  const rows = withAllProductSimulators(
    [{ simulator_id: `p-${ELEGOO}`, label: `p-${ELEGOO}`, views: 3, leads: 1, conversions: 0, revenue: 0 }],
    [{ id: ELEGOO, name: "Elegoo Mars 5" }, { id: "b0000000-0000-4000-8000-000000000002", name: "Scanner X" }],
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { simulator_id: `p-${ELEGOO}`, label: "Produto: Elegoo Mars 5", views: 3, leads: 1, conversions: 0, revenue: 0 });
  assert.equal(rows[1].simulator_id, "p-b0000000-0000-4000-8000-000000000002");
  assert.equal(rows[1].views, 0);
});
