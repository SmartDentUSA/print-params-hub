import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { pickPhoneMatch, escapeLike } from "./phone-match.ts";

const old = { id: "old", email: "import_1772131468408_110@placeholder.local" };
const real = { id: "real", email: "DrSergio@gmail.com" };

Deno.test("mesmo telefone: escolhe o cadastro que já tem o e-mail enviado", () => {
  assertEquals(pickPhoneMatch([old, real], "drsergio@gmail.com")?.id, "real");
});
Deno.test("mesmo telefone sem e-mail correspondente: mantém o mais antigo", () => {
  assertEquals(pickPhoneMatch([old, real], "outro@gmail.com")?.id, "old");
  assertEquals(pickPhoneMatch([old, real], "")?.id, "old");
});
Deno.test("nenhum cadastro com o telefone", () => {
  assertEquals(pickPhoneMatch([], "x@y.com"), null);
});
Deno.test("escapa curingas do e-mail", () => {
  assertEquals(escapeLike("a_b%c@x.com"), "a\\_b\\%c@x.com");
});
