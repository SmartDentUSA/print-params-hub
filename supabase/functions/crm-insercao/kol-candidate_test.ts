import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildKolCandidateNote, buildKolCandidateOrigin, buildKolInviteMessage, classifySearchInput,
  groupParticipants, KOL_CANDIDATE_OWNER_PIPERUN_ID, KOL_PIPELINE_ID, KOL_STAGE_INTERESSADOS, parseGroupJid,
} from "./kol-candidate.ts";

Deno.test("Candidato a KOL entra no funil KOL 107400, etapa Interessados, proprietário 104356", () => {
  assertEquals(KOL_PIPELINE_ID, 107400);
  assertEquals(KOL_STAGE_INTERESSADOS, 694355);
  assertEquals(KOL_CANDIDATE_OWNER_PIPERUN_ID, 104356);
});

Deno.test("Origem do deal é Indicação - nome do vendedor que indicou", () => {
  assertEquals(buildKolCandidateOrigin(" Evandro  Silva "), "Indicação - Evandro Silva");
});

Deno.test("Busca aceita celular ou ID do CRM", () => {
  assertEquals(classifySearchInput("(16) 99750-1531").kind, "phone");
  assertEquals(classifySearchInput("5516997501531").kind, "phone");
  assertEquals(classifySearchInput("65663044").kind, "crm_id");
  assertEquals(classifySearchInput("12").kind, "invalid");
});

Deno.test("Grupo tem vendedor e KOL; o número da Beatriz cria o grupo e não é repetido", () => {
  assertEquals(groupParticipants("16 99111-2222", "5511988887777", "5516997501531"), ["5516991112222", "5511988887777"]);
  assertEquals(groupParticipants("5516997501531", "11988887777", "5516997501531"), ["5511988887777"]);
  // Vendedor que se indica como candidato: um único participante além da Beatriz.
  assertEquals(groupParticipants("5516981596947", "16981596947", "5516997501531"), ["5516981596947"]);
});

Deno.test("Mensagem do grupo cita profissional, vendedor e link do portal", () => {
  const m = buildKolInviteMessage({ professional: "Danilo Henrique", seller: "Evandro Silva", portalUrl: "https://www.smartdent.com.br/portal-cursos/abc" });
  assert(m.startsWith("Olá, Danilo! Tudo bem? 😊\nAqui é a Beatriz, do Marketing da Smart Dent."));
  assert(m.includes("O(a) Evandro Silva, do nosso time comercial, indicou você para uma possível parceria como KOL da Smart Dent!"));
  assert(m.includes("👉 https://www.smartdent.com.br/portal-cursos/abc"));
});

Deno.test("JID do grupo é lido de respostas aninhadas", () => {
  assertEquals(parseGroupJid({ message: "success", data: { JID: "120363401234567890@g.us" } }), "120363401234567890@g.us");
  assertEquals(parseGroupJid({ data: { id: "5516@s.whatsapp.net" } }), null);
});

Deno.test("Nota deixa a origem explícita e omite campos vazios", () => {
  const html = buildKolCandidateNote({ origin: "Indicação - Evandro Silva", sections: [{ title: "Candidato", rows: [["Nome", "Ana"], ["E-mail", ""]] }] });
  assert(html.includes("<b>Origem do lead:</b> Indicação - Evandro Silva"));
  assert(html.includes("<b>Nome:</b> Ana"));
  assert(!html.includes("E-mail"));
});
