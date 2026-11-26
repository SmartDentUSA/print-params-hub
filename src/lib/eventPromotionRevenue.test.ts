import { test } from "node:test";
import assert from "node:assert/strict";
import { consolidateEventProducts, eventPromotionRevenue } from "./eventPromotionRevenue";

test("total da promoção soma conversões consolidadas e pedidos pagos da loja", () => {
  assert.equal(eventPromotionRevenue(49817.60, 2023.07), 51840.67);
});

test("promoção sem conversões nem pedidos pagos totaliza zero", () => {
  assert.equal(eventPromotionRevenue(0, 0), 0);
});

test("consolidado inclui todos os produtos, inclusive depois dos dez primeiros", () => {
  const loja = Array.from({ length: 12 }, (_, index) => ({
    nome: `Produto ${index + 1}`,
    quantidade: 1,
    receita: 100,
  }));
  const crm = [{ nome: "Produto 12", quantidade: 2, receita: 50 }];

  const consolidado = consolidateEventProducts(crm, loja);

  assert.equal(consolidado.length, 12);
  assert.equal(consolidado.reduce((sum, product) => sum + product.quantidade, 0), 14);
  assert.equal(consolidado.reduce((sum, product) => sum + product.receita, 0), 1250);
  assert.deepEqual(
    consolidado.find((product) => product.nome === "Produto 12"),
    { nome: "Produto 12", quantidade: 3, receita: 150 },
  );
});