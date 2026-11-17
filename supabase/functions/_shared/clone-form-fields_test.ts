import { assertEquals } from "jsr:@std/assert@1";
import { cloneFormFields } from "./clone-form-fields.ts";

Deno.test("cópia remapeia condições para as perguntas da própria cópia", () => {
  let n = 0;
  const rows = cloneFormFields([
    { id: "a", label: "Contato com 3D?", conditions: null, created_at: "x" },
    { id: "b", label: "Qual impressora?", conditions: { show_if: { logic: "AND", rules: [{ field_id: "a", op: "not_equals", value: "NÃO, NUNCA TIVE" }] } } },
  ], "novo-form", () => `n${++n}`);
  assertEquals(rows[0].id, "n1");
  assertEquals(rows[1].form_id, "novo-form");
  assertEquals(rows[1].conditions.show_if.rules[0].field_id, "n1");
  assertEquals("created_at" in rows[0], false);
});

Deno.test("regra que aponta para pergunta de fora não é alterada", () => {
  const rows = cloneFormFields([
    { id: "a", conditions: { show_if: { logic: "AND", rules: [{ field_id: "fora", op: "is_not_empty" }] } } },
  ], "f", () => "n1");
  assertEquals(rows[0].conditions.show_if.rules[0].field_id, "fora");
});
