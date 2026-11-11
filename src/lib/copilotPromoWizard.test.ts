import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDateBR, parseMoneyBR, matchOption } from "./copilotWizardParse.ts";
import { detectWizardIntent, WIZ_SKIP } from "./copilotWizard.ts";
import { promoTableWizard, type PromoDeps, type PromoState } from "./copilotPromoWizard.ts";

const P = "11111111-1111-4111-8111-111111111111";
const V = "22222222-2222-4222-8222-222222222222";
const SELLER = "33333333-3333-4333-8333-333333333333";
const deps: PromoDeps = {
  loadEvents: async () => [],
  loadDistributors: async () => [],
  loadSellers: async () => ({ sellers: [{ id: SELLER, label: "Ana" }], preselected: [] }),
  searchCatalog: async () => [{ productId: P, variationId: V, name: "Resina Vitality", variation: "1 kg", sku: "VIT1", price: 1000 }],
};

async function run(answers: string[]) {
  let s: PromoState = await promoTableWizard.init(deps, "2026-11-11");
  for (const a of answers) {
    const r = await promoTableWizard.answer(s, a, deps);
    if ("error" in r) throw new Error(`${s.step}: ${r.error}`);
    s = r.state;
  }
  return s;
}

test("datas e valores digitados em português", () => {
  assert.equal(parseDateBR("25/11/2026", "2026-11-11"), "2026-11-25");
  assert.equal(parseDateBR("31/02/2026", "2026-11-11"), null);
  assert.equal(parseMoneyBR("R$ 1.234,56"), 1234.56);
  assert.equal(parseMoneyBR("1.500"), 1500);
  assert.equal(parseMoneyBR("99.9"), 99.9);
  assert.equal(matchOption("2", [{ value: "a", label: "A" }, { value: "b", label: "B" }])?.value, "b");
});

test("pedido de criar tabela de preços abre o passo a passo; editar não", () => {
  assert.equal(detectWizardIntent("Preciso criar uma nova tabela de preços para Black Friday"), "tabela_promocional");
  assert.equal(detectWizardIntent("Quero editar a tabela promocional"), null);
});

test("perguntas seguem a ordem dos campos da tela", async () => {
  const s = await promoTableWizard.init(deps, "2026-11-11");
  const order: string[] = [];
  let cur = s;
  const answers = ["Black Friday 2026", "TABELA PROMOCIONAL", "none", "general", "BRL", "20/11/2026", "30/11/2026", "active", WIZ_SKIP, "yes", "no", "no"];
  for (const a of answers) {
    order.push(promoTableWizard.question(cur).where);
    const r = await promoTableWizard.answer(cur, a, deps);
    assert.ok(!("error" in r));
    cur = (r as any).state;
  }
  assert.deepEqual(order.map((w) => w.split(" › ").pop()), [
    "Nome interno", "Título no PDF", "Evento associado", "Uso", "Moeda", "Início", "Fim", "Status",
    "Observações e condições", "Incluir tabela Smart Dent (Loja Oficial)", "Vincular a tabela para KOLs", "Cupons de desconto",
  ]);
  assert.equal(cur.step, "combo_title");
});

test("data de fim antes do início é recusada", async () => {
  const s = await run(["Black Friday 2026", "TABELA PROMOCIONAL", "none", "general", "BRL", "20/11/2026"]);
  const r = await promoTableWizard.answer(s, "19/11/2026", deps);
  assert.ok("error" in r);
});

test("fluxo completo com cupom e produto do catálogo gera o pedido de gravação", async () => {
  const s = await run([
    "Black Friday 2026", "TABELA PROMOCIONAL", "none", "general", "BRL", "20/11/2026", "30/11/2026", "draft", "Pagamento em 10x", "yes", "no",
    "yes", "percent", "10", "20/11/2026", "30/11/2026", "BF26", WIZ_SKIP, "1", JSON.stringify([SELLER]),
    "Kit Resina", WIZ_SKIP, "catalog", "vitality", "0", "2", "1000", "800", "done", "no",
  ]);
  assert.equal(s.step, "review");
  const p: any = promoTableWizard.payload(s);
  assert.equal(p.status, "draft");
  assert.equal(p.coupon.discount_value, 10);
  assert.deepEqual(p.coupon.seller_ids, [SELLER]);
  assert.equal(p.sections[0].main_product_name, "Resina Vitality — 1 kg");
  assert.deepEqual(p.sections[0].items[0], { catalog_product_id: P, catalog_variation_id: V, name: undefined, description: undefined, quantity: 2, market_unit_price: 1000, promotional_unit_price: 800 });
});

test("preço promocional é sempre perguntado e cupom percentual não passa de 100", async () => {
  const s = await run(["Black Friday 2026", "TABELA PROMOCIONAL", "none", "general", "BRL", "20/11/2026", "30/11/2026", "active", WIZ_SKIP, "yes", "no", "yes", "percent"]);
  assert.ok("error" in (await promoTableWizard.answer(s, "120", deps)));
  const item = await run(["Black Friday 2026", "TABELA PROMOCIONAL", "none", "general", "BRL", "20/11/2026", "30/11/2026", "active", WIZ_SKIP, "yes", "no", "no", "Kit", WIZ_SKIP, "catalog", "vit", "0", "1", "1000"]);
  assert.equal(item.step, "item_promo");
  assert.ok("error" in (await promoTableWizard.answer(item, "", deps)));
});
