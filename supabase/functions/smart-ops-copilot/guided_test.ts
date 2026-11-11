import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validatePromoInput, validateWaInput, buildFlowNodes, discountPct, stripActionMarkers, renderPendingBlock } from "./guided.ts";

const P = "11111111-1111-4111-8111-111111111111";
const today = "2026-11-11";
const basePromo = {
  name: "Black Friday 2026", valid_from: "2026-11-20", valid_until: "2026-11-30",
  sections: [{ title: "Combo 1", items: [{ catalog_product_id: P, promotional_unit_price: 90 }] }],
};

Deno.test("tabela nova exige nome, vigência e ao menos um combo com itens", () => {
  const r = validatePromoInput({}, today, false);
  assert(r.errors.includes("Informe o nome da tabela."));
  assert(r.errors.includes("Informe a vigência (início e fim)."));
  assert(r.errors.includes("Adicione pelo menos um combo com itens."));
  assertEquals(validatePromoInput(basePromo, today, false).errors, []);
});

Deno.test("preço promocional é obrigatório em todo item (nunca inventado)", () => {
  const r = validatePromoInput({ ...basePromo, sections: [{ title: "C", items: [{ catalog_product_id: P }] }] }, today, false);
  assert(r.errors.some((e) => e.includes("informe o preço promocional")));
});

Deno.test("item personalizado precisa de nome e preço de mercado", () => {
  const r = validatePromoInput({ ...basePromo, sections: [{ title: "C", items: [{ promotional_unit_price: 10 }] }] }, today, false);
  assert(r.errors.some((e) => e.includes("precisa de nome")));
  assert(r.errors.some((e) => e.includes("preço de mercado")));
});

Deno.test("vigência: fim antes do início e tabela já vencida são bloqueados", () => {
  assert(validatePromoInput({ ...basePromo, valid_from: "2026-11-30", valid_until: "2026-11-20" }, today, false).errors.includes("A data de fim é anterior à de início."));
  assert(validatePromoInput({ ...basePromo, valid_from: "2026-10-01", valid_until: "2026-10-10" }, today, false).errors.includes("A vigência já terminou."));
});

Deno.test("cupom percentual não passa de 100% e precisa de valor > 0", () => {
  assert(validatePromoInput({ ...basePromo, coupon: { discount_type: "percent", discount_value: 120 } }, today, false).errors.includes("Cupom: percentual acima de 100%."));
  assert(validatePromoInput({ ...basePromo, coupon: { discount_type: "fixed", discount_value: 0 } }, today, false).errors.some((e) => e.includes("maior que zero")));
});

Deno.test("desconto calculado sobre o preço de mercado", () => {
  assertEquals(discountPct(100, 70), 30);
  assertEquals(discountPct(0, 10), 0);
});

const G = "22222222-2222-4222-8222-222222222222";
const now = Date.parse("2026-11-11T12:00:00Z");
Deno.test("campanha de grupos exige nome, grupo e mensagem real", () => {
  const r = validateWaInput({ steps: [{ type: "wait", days: 1 }] }, now, false);
  assert(r.errors.includes("Informe o nome da campanha."));
  assert(r.errors.includes("Selecione pelo menos um grupo."));
  assert(r.errors.some((e) => e.includes("ao menos uma mensagem")));
  assertEquals(validateWaInput({ name: "BF", group_ids: [G], steps: [{ type: "msg", text: "Oi" }] }, now, false).errors, []);
});

Deno.test("campanha de grupos: início e espera absolutos precisam ser futuros; espera relativa > 0", () => {
  const past = "2026-11-10T12:00:00Z";
  assert(validateWaInput({ name: "BF", group_ids: [G], start_at: past, steps: [{ type: "msg", text: "x" }] }, now, false).errors.some((e) => e.includes("O início deve ser futuro")));
  assert(validateWaInput({ name: "BF", group_ids: [G], steps: [{ type: "msg", text: "x" }, { type: "wait", absolute_at: past }] }, now, false).errors.some((e) => e.includes("deve ser futura")));
  assert(validateWaInput({ name: "BF", group_ids: [G], steps: [{ type: "msg", text: "x" }, { type: "wait", days: 0 }] }, now, false).errors.some((e) => e.includes("(>0)")));
});

Deno.test("limites padrão: 20 por dia, 30 s entre grupos, 30 dias anti-repetição", () => {
  assertEquals(validateWaInput({ name: "BF", group_ids: [G], steps: [{ type: "msg", text: "x" }] }, now, false).limits, { daily_limit: 20, delay_seconds: 30, dedupe_window_days: 30 });
});

Deno.test("nós gerados no formato aceito pelo construtor de campanhas", () => {
  let i = 0;
  const nodes = buildFlowNodes([{ type: "msg", text: " Oi " }, { type: "wait", hours: 2 }, { type: "link", title: "T", url: "https://x" }], () => `n${i++}`);
  assertEquals(nodes[0], { id: "n0", type: "msg", text: "Oi", mention_all: false });
  assertEquals(nodes[1], { id: "n1", type: "wait", mode: "relative", days: 0, hours: 2, minutes: 0, time: "09:00", weekdays_only: false });
  assertEquals(nodes[2], { id: "n2", type: "link", title: "T", description: "", url: "https://x" });
});

Deno.test("marcadores de confirmação escritos pelo modelo são removidos", () => {
  const block = renderPendingBlock({ id: "abc", type: "promo_table", title: "t", summary: "Resumo" });
  assert(block.includes("```copilot-action"));
  assertEquals(stripActionMarkers("Texto\n" + block.replace("Resumo\n\n", "")), "Texto");
});
