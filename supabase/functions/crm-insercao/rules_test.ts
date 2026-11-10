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
