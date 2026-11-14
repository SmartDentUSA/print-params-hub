import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isFreshInbound, parseEvolutionInbound } from "../_shared/evolution-inbound.ts";

const now = 1_794_640_185_000;
const base = (data: unknown, event = "messages.upsert") => ({ event, instance: "evo_cel_comercial_5516981596947", data });

Deno.test("mensagem direta com @lid usa o telefone real do senderPn", () => {
  const [m] = parseEvolutionInbound(base({
    key: { id: "A1", fromMe: false, remoteJid: "270900884713608@lid", senderPn: "5519992612348@s.whatsapp.net" },
    pushName: "Danilo Henrique",
    message: { conversation: "Olá" },
    messageTimestamp: now / 1000,
  }));
  assertEquals(m.phoneDigits, "5519992612348");
  assertEquals(m.lidDigits, "270900884713608");
  assertEquals(m.text, "Olá");
  assertEquals(m.instance, "evo_cel_comercial_5516981596947");
});

Deno.test("@lid sem número fica sem telefone (resolve pela tabela de LID)", () => {
  const [m] = parseEvolutionInbound(base({
    key: { id: "A2", fromMe: false, remoteJid: "270900884713608@lid" },
    message: { conversation: "Vc está me lendo?" },
    messageTimestamp: now / 1000,
  }));
  assertEquals(m.phoneDigits, null);
  assertEquals(m.lidDigits, "270900884713608");
});

Deno.test("número comum vem do remoteJid", () => {
  const [m] = parseEvolutionInbound(base({
    key: { id: "A3", fromMe: false, remoteJid: "5516999990000@s.whatsapp.net" },
    message: { extendedTextMessage: { text: "Quero saber da resina" } },
    messageTimestamp: now / 1000,
  }));
  assertEquals(m.phoneDigits, "5516999990000");
  assertEquals(m.text, "Quero saber da resina");
});

Deno.test("mensagens enviadas por nós, grupos, sem texto e outros eventos são ignoradas", () => {
  assertEquals(parseEvolutionInbound(base({ key: { id: "B1", fromMe: true, remoteJid: "5516999990000@s.whatsapp.net" }, message: { conversation: "oi" } })).length, 0);
  assertEquals(parseEvolutionInbound(base({ key: { id: "B2", fromMe: false, remoteJid: "1203630@g.us" }, message: { conversation: "oi" } })).length, 0);
  assertEquals(parseEvolutionInbound(base({ key: { id: "B3", fromMe: false, remoteJid: "5516999990000@s.whatsapp.net" }, message: { audioMessage: {} } })).length, 0);
  assertEquals(parseEvolutionInbound(base({ key: { id: "B4", fromMe: false, remoteJid: "5516999990000@s.whatsapp.net" }, message: { conversation: "oi" } }, "messages.update")).length, 0);
});

Deno.test("só responde mensagens dos últimos 2 minutos", () => {
  const [m] = parseEvolutionInbound(base({
    key: { id: "C1", fromMe: false, remoteJid: "5516999990000@s.whatsapp.net" },
    message: { conversation: "oi" },
    messageTimestamp: now / 1000,
  }));
  assertEquals(isFreshInbound(m, now + 60_000), true);
  assertEquals(isFreshInbound(m, now + 121_000), false);
});
