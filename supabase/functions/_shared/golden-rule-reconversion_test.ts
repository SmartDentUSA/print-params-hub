import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { findReconversionEarlyStageDeals } from "./golden-rule-guard.ts";

const V = 18784;
const deal = (stage_id: number, extra: Record<string, unknown> = {}) =>
  ({ id: stage_id, pipeline_id: V, status: 0, stage_id, ...extra });

for (const stage of [99293, 99294, 675815, 675813, 379942]) {
  Deno.test(`etapa inicial ${stage} com nova conversão gera reconversão`, () => {
    assertEquals(findReconversionEarlyStageDeals([deal(stage)], { newConversionConfirmed: true }).length, 1);
  });
}

Deno.test("etapa Apresentação/Visita preserva o deal", () => {
  assertEquals(findReconversionEarlyStageDeals([deal(99295)], { newConversionConfirmed: true }), []);
});

Deno.test("re-entrega sem nova conversão não toca o deal", () => {
  assertEquals(findReconversionEarlyStageDeals([deal(99293)], { newConversionConfirmed: false }), []);
});

Deno.test("CS e ganhos nunca entram", () => {
  const cs = { id: 1, pipeline_id: 83896, status: 0, stage_id: 99293 };
  const won = deal(99293, { status: 1 });
  assertEquals(findReconversionEarlyStageDeals([cs, won], { newConversionConfirmed: true }), []);
});

Deno.test("um deal Vendas avançado preserva todos", () => {
  assertEquals(findReconversionEarlyStageDeals([deal(99293), deal(99296)], { newConversionConfirmed: true }), []);
});
