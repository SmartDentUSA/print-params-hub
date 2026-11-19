import { assertEquals } from "jsr:@std/assert@1";
import { parseCommand, extractFallback, opportunityName, fileName } from "./logic.ts";

Deno.test("FIM fecha a captura; texto comum é anotação", () => {
  assertEquals(parseCommand("fim"), { kind: "end" });
  assertEquals(parseCommand("Fim."), { kind: "end" });
  assertEquals(parseCommand("fim da conversa"), null);
});

Deno.test("tipos: 1/LEAD, 2/KOL, 3/OPORTUNIDADE", () => {
  assertEquals(parseCommand("1"), { kind: "type", type: "lead" });
  assertEquals(parseCommand("kol"), { kind: "type", type: "kol" });
  assertEquals(parseCommand("Oportunidade"), { kind: "type", type: "oportunidade" });
  assertEquals(parseCommand("CANCELAR"), { kind: "cancel" });
});

Deno.test("fallback lê e-mail e telefone do texto", () => {
  const r = extractFallback("Dr. João joao@clinica.com.br (16) 99750-1531");
  assertEquals(r.email, "joao@clinica.com.br");
  assertEquals(r.telefone, "16997501531");
});

Deno.test("nome da oportunidade e dos arquivos", () => {
  assertEquals(opportunityName("João Silva", "Clínica Sorriso", ""), "João Silva - Clínica Sorriso");
  assertEquals(opportunityName("", "", "5516997501531"), "Contato 1531");
  assertEquals(fileName("João Silva", 1, "image/jpeg"), "João Silva - 01.jpg");
});
