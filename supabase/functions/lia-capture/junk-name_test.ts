import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cleanPersonName } from "../_shared/piperun-field-map.ts";

Deno.test("nome-lixo do Zapier com data no início é descartado", () => {
  assertEquals(cleanPersonName("22/8/2023 6:52 Zapier: Smart Dent | Plug & Play"), null);
});

Deno.test("nome real é mantido", () => {
  assertEquals(cleanPersonName("Danilo Henrique"), "Danilo Henrique");
});
