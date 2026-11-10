import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildOriginName, isOpenVendasConflict, phoneVariants } from "./rules.ts";

Deno.test("Indicação Ativa gera origem INDICALEADKOL - Nome do Profissional", () => {
  assertEquals(buildOriginName("ativa", "Erick  Souza "), "# - INDICALEADKOL - Erick Souza");
});

Deno.test("Indicação Fria gera origem PROSPLEADKOL - Nome do Profissional", () => {
  assertEquals(buildOriginName("fria", "Henrique Tabuse"), "# - PROSPLEADKOL - Henrique Tabuse");
});

Deno.test("Deal aberto no Funil de vendas de outro vendedor bloqueia", () => {
  assertEquals(isOpenVendasConflict({ status: "aberta", pipeline_id: 18784, owner_id: 33626 }, 51616), true);
});

Deno.test("Deal aberto do próprio vendedor do KOL não bloqueia", () => {
  assertEquals(isOpenVendasConflict({ status: "aberta", pipeline_id: 18784, owner_id: 51616 }, 51616), false);
});

Deno.test("Deal de CS ou Estagnados de outro vendedor não bloqueia", () => {
  assertEquals(isOpenVendasConflict({ status: "aberta", pipeline_id: 83896, owner_id: 33626 }, 51616), false);
  assertEquals(isOpenVendasConflict({ status: "aberta", pipeline_id: 72938, owner_id: 33626 }, 51616), false);
});

Deno.test("Deal ganho no Funil de vendas não bloqueia", () => {
  assertEquals(isOpenVendasConflict({ status: "ganha", pipeline_id: 18784, owner_id: 33626 }, 51616), false);
});

Deno.test("Celular 55 + DDD + 9 dígitos busca com e sem o 9º dígito", () => {
  assertEquals(phoneVariants("5516997501531"), ["16997501531", "1697501531"]);
  assertEquals(phoneVariants("123"), []);
});

import { buildLeadSummary } from "./summary.ts";

Deno.test("Resumo conta negócios abertos, ganhos e perdidos com a soma dos ganhos", () => {
  const base = { lead_id: null, pipeline_id: 18784, pipeline_name: "Funil de vendas", stage_id: 1, stage_name: "C1", owner_id: 1, owner_name: "Ana", product: null, origin_name: "Form X", closed_at: null, fonte: "espelho" };
  const blocks = buildLeadSummary(null, [
    { ...base, deal_id: "1", status: "ganha", value: 1000, created_at: "2026-01-01" },
    { ...base, deal_id: "2", status: "perdida", value: 0, created_at: "2026-02-01" },
    { ...base, deal_id: "3", status: "aberta", value: 500, created_at: "2026-03-01" },
  ] as any, []);
  const hist = blocks.find((b) => b.title === "Histórico de negócios")!;
  assertEquals(hist.lines[0].startsWith("3 negócio(s) · 1 aberto(s) · 1 ganho(s) (R$"), true);
  assertEquals(hist.lines[0].endsWith("1 perdido(s)"), true);
  assertEquals(hist.lines[1].includes("#1"), true); // mais antigo primeiro
});
