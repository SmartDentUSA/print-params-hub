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

import { parseConfirmChoice, validateEdit, applyEdits, hasContact, confirmSummary } from "./logic.ts";

Deno.test("conferência: 1 nome, 2 telefone, 3 e-mail, 4 dados corretos", () => {
  assertEquals(parseConfirmChoice("1"), { kind: "edit", field: "nome" });
  assertEquals(parseConfirmChoice("2"), { kind: "edit", field: "telefone" });
  assertEquals(parseConfirmChoice("3"), { kind: "edit", field: "email" });
  assertEquals(parseConfirmChoice("4"), { kind: "ok" });
  assertEquals(parseConfirmChoice("Dados corretos"), { kind: "ok" });
  assertEquals(parseConfirmChoice("5"), null);
});

Deno.test("conferência: valida o que o vendedor digita", () => {
  assertEquals(validateEdit("telefone", "(704) 308-9396"), { value: "7043089396" });
  assertEquals("error" in validateEdit("telefone", "12345"), true);
  assertEquals(validateEdit("email", " MDGuerra@SmartDentUSA.com "), { value: "mdguerra@smartdentusa.com" });
  assertEquals("error" in validateEdit("email", "mdguerra@"), true);
  assertEquals(validateEdit("nome", "  Marcelo   Del Guerra "), { value: "Marcelo Del Guerra" });
});

Deno.test("conferência: correção do vendedor prevalece sobre a leitura", () => {
  const l = applyEdits({ nome: "Marcelo", telefone: "7043089396", email: "x@y.com" }, { email: "md@smartdentusa.com" });
  assertEquals(l.email, "md@smartdentusa.com");
  assertEquals(l.nome, "Marcelo");
  assertEquals(hasContact({ nome: "A", telefone: "", email: "" }), false);
  assertEquals(confirmSummary("Lead do evento", { nome: "A", telefone: "", email: "" }).includes("Falta telefone ou e-mail"), true);
});

Deno.test("AUTO abre a captura; saudação não", () => {
  assertEquals(parseCommand("auto"), { kind: "start" });
  assertEquals(parseCommand("Auto."), { kind: "start" });
  assertEquals(parseCommand("Oie"), null);
});

import { contactCard } from "./logic.ts";

Deno.test("cartão de contato usa o telefone conferido e só existe com telefone", () => {
  const card = contactCard({ nome: "Marcelo Del Guerra", telefone: "1 (704) 308-9396", email: "MDGuerra@smartdentusa.com" }, "Marcelo Del Guerra - Smart Dent");
  assertEquals(card?.phones, [{ phone: "+17043089396", type: "CELL" }]);
  assertEquals(card?.name, { formatted_name: "Marcelo Del Guerra - Smart Dent", first_name: "Marcelo", last_name: "Del Guerra" });
  assertEquals(card?.emails, [{ email: "mdguerra@smartdentusa.com", type: "WORK" }]);
  assertEquals(contactCard({ nome: "Sem Telefone", email: "a@b.com" }, "Sem Telefone"), null);
});
