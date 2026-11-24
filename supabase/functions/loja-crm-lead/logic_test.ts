import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { recentCsWinOwner, LOJA_ORIGINS, isAbandoned, pickInterest, submissionKey, ABANDON_AFTER_MS } from "./logic.ts";

const catalog = [
  { name: "Resina 3D Smart Print Model Plus", product_category: "Resinas", product_subcategory: "Modelos" },
  { name: "SmartMake Seal Glaze", product_category: "Caracterização", product_subcategory: "Glaze" },
];

Deno.test("origens exatas", () => {
  assertEquals(LOJA_ORIGINS.carrinho, "[LOJA] - Carrinho abandonado");
  assertEquals(LOJA_ORIGINS.cancelado, "[LOJA] - Pedido cancelado");
});
Deno.test("mesmo pedido gera a mesma chave (conta uma vez)", () => {
  assertEquals(submissionKey("cancelado", 2978), submissionKey("cancelado", "2978"));
});
Deno.test("abandonado só após 2 h e ainda ativo", () => {
  const t = Date.parse("2026-11-24T10:00:00Z");
  assertEquals(ABANDON_AFTER_MS, 7_200_000);
  assertEquals(isAbandoned("2026-11-24T08:30:00Z", t, "active"), false);
  assertEquals(isAbandoned("2026-11-24T08:00:00Z", t, "active"), true);
  assertEquals(isAbandoned("2026-11-24T05:00:00Z", t, "converted"), false);
});
Deno.test("categoria e produto de maior valor", () => {
  const r = pickInterest([
    { nome: "SmartMake Seal Glaze", qty: 1, preco: 306 },
    { nome: "Resina 3D Smart Print Model Plus 1kg", qty: 1, preco: 199 },
  ], catalog);
  assertEquals(r.produto, "SmartMake Seal Glaze");
  assertEquals(r.categorias, ["Caracterização › Glaze", "Resinas › Modelos"]);
});

const NOW = Date.parse("2026-11-24T12:00:00Z");
Deno.test("ganho no CS há 10 dias fica com o mesmo vendedor", () => {
  assertEquals(recentCsWinOwner([{ owner_id: 77, closed_at: "2026-11-14T12:00:00Z" }], NOW), 77);
});
Deno.test("ganho no CS há 31 dias vai para sorteio", () => {
  assertEquals(recentCsWinOwner([{ owner_id: 77, closed_at: "2026-10-24T11:00:00Z" }], NOW), null);
});
Deno.test("vários ganhos: vale o mais recente", () => {
  assertEquals(recentCsWinOwner([{ owner_id: 1, closed_at: "2026-11-01T00:00:00Z" }, { owner_id: 2, closed_at: "2026-11-20T00:00:00Z" }], NOW), 2);
});
