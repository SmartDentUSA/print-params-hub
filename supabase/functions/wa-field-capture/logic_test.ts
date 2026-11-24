import { assertEquals } from "jsr:@std/assert@1";
import { parseCommand, extractFallback, opportunityName, fileName, captureRouting, captureFormPurpose } from "./logic.ts";

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

Deno.test("venda direta segue o formulário de leads do evento com o vendedor remetente", () => {
  assertEquals(parseCommand("4"), { kind: "type", type: "venda_direta" });
  assertEquals(parseCommand("Venda direta"), { kind: "type", type: "venda_direta" });
  const sender = { id: "vendedor-remetente", nome_completo: "Vendedor do evento" };
  assertEquals(captureRouting("venda_direta", sender), {
    formPurpose: "feira_evento",
    consultant: { event_consultant_team_member_id: "vendedor-remetente", proprietario_lead_crm: "Vendedor do evento" },
  });
  assertEquals(captureRouting("lead", sender), captureRouting("venda_direta", sender));
});

Deno.test("cadastro de distribuidores usa o fluxo de distribuição, não o de Vendas", () => {
  assertEquals(parseCommand("5"), { kind: "type", type: "distribuicao" });
  assertEquals(parseCommand("Distribuidores"), { kind: "type", type: "distribuicao" });
  assertEquals(captureRouting("distribuicao", { id: "remetente", nome_completo: "Vendedor" }), {
    formPurpose: "distribuicao", consultant: {},
  });
});

Deno.test("venda direta sem remetente não pode ser encaminhada por sorteio", () => {
  let rejected = false;
  try { captureRouting("venda_direta", null); } catch { rejected = true; }
  assertEquals(rejected, true);
});

Deno.test("opção 6 segue o mesmo formulário e fluxo do cadastro de leads de distribuição", () => {
  assertEquals(parseCommand("6"), { kind: "type", type: "oportunidade_distribuicao" });
  assertEquals(parseCommand("Oportunidade de distribuição"), { kind: "type", type: "oportunidade_distribuicao" });
  assertEquals(captureFormPurpose("oportunidade_distribuicao"), "distribuicao");
  assertEquals(captureFormPurpose("distribuicao"), "distribuicao");
  const sender = { id: "remetente", nome_completo: "Vendedor" };
  assertEquals(captureRouting("oportunidade_distribuicao", sender), { formPurpose: "distribuicao", consultant: {} });
  assertEquals(captureRouting("oportunidade_distribuicao", sender), captureRouting("distribuicao", sender));
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
  assertEquals(validateEdit("telefone", "(704) 308-9396", "Estados Unidos"), { value: "17043089396" });
  assertEquals("error" in validateEdit("telefone", "(704) 308-9396"), true); // DDD 70 não existe no Brasil
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

import { normalizeCapturePhone, pickPhones, formatPhone } from "./logic.ts";

Deno.test("telefone dos EUA ganha +1 pelo país do lead ou do evento", () => {
  assertEquals(normalizeCapturePhone("(704) 308-9396", "Estados Unidos"), "17043089396");
  assertEquals(normalizeCapturePhone("770.921.2131", "", "United States"), "17709212131");
  assertEquals(normalizeCapturePhone("+1 (585) 360-3035", "Brasil"), "15853603035");
  assertEquals(formatPhone("17043089396"), "+1 704 308 9396");
});

Deno.test("telefone brasileiro continua com 55 e código explícito é respeitado", () => {
  assertEquals(normalizeCapturePhone("(16) 99750-1531", "Brasil"), "5516997501531");
  assertEquals(normalizeCapturePhone("16 99750-1531", "", ""), "5516997501531");
  assertEquals(normalizeCapturePhone("+351 912 345 678", "Estados Unidos"), "351912345678");
});

Deno.test("dois números do cartão ficam separados, nunca colados", () => {
  const fb = extractFallback("Miami, FL 33134\n(786) 312-2709\n(786) 616-4236\nsteve.e@servi-dent.com");
  assertEquals(fb.telefones, ["(786) 312-2709", "(786) 616-4236"]);
  assertEquals(pickPhones(["78631227097866164236", ...fb.telefones], "Estados Unidos"), { telefone: "17863122709", outros: ["17866164236"] });
  assertEquals(normalizeCapturePhone("78631227097866164236", "Estados Unidos"), "");
});

Deno.test("correção do telefone aceita só um número e aplica o país", () => {
  assertEquals(validateEdit("telefone", "704 308 9396", "Estados Unidos"), { value: "17043089396" });
  assertEquals("error" in validateEdit("telefone", "(786) 312-2709 (786) 616-4236", "Estados Unidos"), true);
});
