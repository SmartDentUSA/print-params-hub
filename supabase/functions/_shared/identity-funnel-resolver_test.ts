import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decide, pickActiveSeller, classifyDeal } from "./identity-funnel-resolver.ts";

const d = (o: Partial<Record<string, unknown>>) => ({ id: 1, source: "person" as const, ...o } as never);

Deno.test("vendas aberto -> enrich_only", () => {
  const r = decide([d({ id: 10, pipeline_name: "Funil de Vendas", status: 1 })]);
  assertEquals(r.action, "enrich_only");
  assertEquals(r.deal_to_enrich, 10);
});

Deno.test("CS -> abre novo em vendas, CS intocado", () => {
  const r = decide([d({ id: 11, pipeline_name: "CS Onboarding", status: 1, owner_id: 5 })]);
  assertEquals(r.action, "open_new_vendas_keep_cs");
  assertEquals(r.deals_to_close, []);
  assertEquals(r.previous_owner_ids, [5]);
});

Deno.test("perdido -> fecha e abre novo", () => {
  const r = decide([d({ id: 12, pipeline_name: "Funil de Vendas", status: 3, owner_id: 7 })]);
  assertEquals(r.action, "close_estagnado_and_open_new");
  assertEquals(r.deals_to_close, [12]);
});

Deno.test("nada -> create_all_new", () => {
  assertEquals(decide([]).action, "create_all_new");
});

Deno.test("2 vendas abertos -> revisao humana", () => {
  const r = decide([
    d({ id: 1, pipeline_name: "Vendas", status: 1 }),
    d({ id: 2, pipeline_name: "Vendas", status: 1 }),
  ]);
  assertEquals(r.action, "needs_human_review");
});

Deno.test("dedupe person/company", () => {
  const r = decide([
    d({ id: 3, pipeline_name: "Vendas", status: 1, source: "company" }),
    d({ id: 3, pipeline_name: "Vendas", status: 1, source: "person" }),
  ]);
  assertEquals(r.action, "enrich_only");
  assertEquals(r.classified.length, 1);
});

Deno.test("ganho nao conta como vendas aberto", () => {
  assertEquals(classifyDeal(d({ pipeline_name: "Vendas", status: 2 })), "other");
});

Deno.test("sorteio exclui dono anterior", () => {
  const p = pickActiveSeller([{ piperun_owner_id: 1 }, { piperun_owner_id: 2 }], [1]);
  assertEquals(p.seller?.piperun_owner_id, 2);
  assertEquals(p.fell_back, false);
});

Deno.test("exclusao que esvazia pool cai de volta no pool completo", () => {
  const p = pickActiveSeller([{ piperun_owner_id: 1 }], [1]);
  assertEquals(p.seller?.piperun_owner_id, 1);
  assertEquals(p.fell_back, true);
});
