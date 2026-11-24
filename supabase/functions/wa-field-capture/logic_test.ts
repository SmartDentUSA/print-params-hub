import { assertEquals } from "jsr:@std/assert@1";
import { parseCommand, extractFallback, opportunityName, fileName, captureRouting, captureFormPurpose, needsSubtype, parseYesNo, subtypeFromAnswer, captureLabel } from "./logic.ts";
import { distributionOrigin } from "../_shared/kol-expansion.ts";

Deno.test("FIM fecha a captura; texto comum é anotação", () => {
  assertEquals(parseCommand("fim"), { kind: "end" });
  assertEquals(parseCommand("Fim."), { kind: "end" });
  assertEquals(parseCommand("fim da conversa"), null);
});

Deno.test("menu de 4 tipos: 1 lead, 2 kol, 3 oportunidade, 4 distribuidor", () => {
  assertEquals(parseCommand("1"), { kind: "type", type: "lead" });
  assertEquals(parseCommand("LEAD"), { kind: "type", type: "lead" });
  assertEquals(parseCommand("2"), { kind: "type", type: "kol" });
  assertEquals(parseCommand("3"), { kind: "type", type: "oportunidade" });
  assertEquals(parseCommand("4"), { kind: "type", type: "distribuicao" });
  assertEquals(parseCommand("Distribuidor"), { kind: "type", type: "distribuicao" });
  assertEquals(parseCommand("CANCELAR"), { kind: "cancel" });
});

Deno.test("5 e 6 deixam de ser comando", () => {
  assertEquals(parseCommand("5"), null);
  assertEquals(parseCommand("6"), null);
});

Deno.test("aliases legados por texto já definem o subtipo", () => {
  assertEquals(parseCommand("Venda direta"), { kind: "type", type: "lead", subtype: "venda_direta" });
  assertEquals(parseCommand("Oportunidade de distribuição"), { kind: "type", type: "distribuicao", subtype: "oportunidade" });
  assertEquals(parseCommand("OPORTUNIDADES DE DISTRIBUICAO"), { kind: "type", type: "distribuicao", subtype: "oportunidade" });
});

Deno.test("lead e venda direta seguem o cadastro de visitantes com o vendedor remetente", () => {
  const sender = { id: "vendedor-remetente", nome_completo: "Vendedor do evento" };
  assertEquals(captureRouting("lead", sender), {
    formPurpose: "feira_evento",
    consultant: { event_consultant_team_member_id: "vendedor-remetente", proprietario_lead_crm: "Vendedor do evento" },
  });
  assertEquals(captureRouting("venda_direta", sender), captureRouting("lead", sender));
  let rejected = false;
  try { captureRouting("lead", null); } catch { rejected = true; }
  assertEquals(rejected, true);
});

Deno.test("distribuidor e legado de oportunidade de distribuição usam o fluxo de distribuição", () => {
  const sender = { id: "remetente", nome_completo: "Vendedor" };
  assertEquals(captureRouting("distribuicao", sender), { formPurpose: "distribuicao", consultant: {} });
  assertEquals(captureRouting("oportunidade_distribuicao", sender), { formPurpose: "distribuicao", consultant: {} });
  assertEquals(captureFormPurpose("kol"), "kol_expansao");
  assertEquals(captureFormPurpose("oportunidade"), "oportunidade_evento");
});

Deno.test("subtipo: só lead e distribuidor perguntam; SIM/S/NÃO/NAO/N", () => {
  assertEquals(needsSubtype("lead", null), true);
  assertEquals(needsSubtype("distribuicao", null), true);
  assertEquals(needsSubtype("kol", null), false);
  assertEquals(needsSubtype("oportunidade", null), false);
  assertEquals(needsSubtype("lead", "padrao"), false);
  assertEquals(needsSubtype("venda_direta", null), false);
  for (const y of ["SIM", "sim", "S"]) assertEquals(parseYesNo(y), true);
  for (const n of ["NÃO", "nao", "N"]) assertEquals(parseYesNo(n), false);
  assertEquals(parseYesNo("1"), null);
  assertEquals(subtypeFromAnswer("lead", true), "venda_direta");
  assertEquals(subtypeFromAnswer("lead", false), "padrao");
  assertEquals(subtypeFromAnswer("distribuicao", true), "distribuidor");
  assertEquals(subtypeFromAnswer("distribuicao", false), "oportunidade");
});

Deno.test("rótulos das capturas", () => {
  assertEquals(captureLabel("lead", "padrao"), "Lead do evento");
  assertEquals(captureLabel("lead", "venda_direta"), "Lead do evento — venda direta");
  assertEquals(captureLabel("venda_direta"), "Lead do evento — venda direta");
  assertEquals(captureLabel("kol"), "KOL do evento");
  assertEquals(captureLabel("oportunidade"), "Outra oportunidade do evento");
  assertEquals(captureLabel("distribuicao", "distribuidor"), "Distribuidor do evento");
  assertEquals(captureLabel("oportunidade_distribuicao"), "Distribuidor do evento — oportunidade de abrir distribuição");
});

Deno.test("origem de distribuição", () => {
  assertEquals(distributionOrigin("Dentsply Show 2026"), "[DISTRIBUIÇÃO] - Dentsply Show 2026");
  assertEquals(distributionOrigin(""), "[DISTRIBUIÇÃO]");
  assertEquals(distributionOrigin("x".repeat(300)).length, 190);
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
