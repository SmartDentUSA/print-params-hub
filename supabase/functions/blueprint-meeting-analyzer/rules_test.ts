import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dueState, googleDocStamp, pickNotesDoc } from "./rules.ts";

const START = "2026-11-10T21:27:00.000Z";
const END = "2026-11-10T22:27:00.000Z";

Deno.test("procura 15 min após o início; desiste 3 dias após o fim", () => {
  assertEquals(dueState(START, END, new Date("2026-11-10T21:35:00Z")), "wait");
  assertEquals(dueState(START, END, new Date("2026-11-10T21:45:00Z")), "search");
  assertEquals(dueState(START, END, new Date("2026-11-14T22:40:00Z")), "give_up");
});

Deno.test("carimbo do nome do documento em Brasília", () => {
  assertEquals(googleDocStamp("2026-11-10T21:27:00.000Z"), "2026/11/10 18:27");
});

Deno.test("anexo do evento tem prioridade", () => {
  const r = pickNotesDoc({ attachments: [{ fileId: "A", title: "x - Anotações do Gemini", mimeType: "application/vnd.google-apps.document" }], folderDocs: [{ id: "B", name: "Apresentação Smart Dent · Danilo - Anotações do Gemini" }], eventSummary: "Apresentação Smart Dent · Danilo" });
  assertEquals(r?.id, "A");
});

Deno.test("na pasta, só aceita documento com o título do evento (nunca outra reunião)", () => {
  const docs = [
    { id: "X", name: "Reunião iniciada às 2026/11/10 18:30 GMT-03:00 - Anotações do Gemini" },
    { id: "Y", name: "Apresentação Smart Dent · Outro Cliente - 2026/11/10 18:27 - Anotações do Gemini" },
  ];
  assertEquals(pickNotesDoc({ attachments: [], folderDocs: docs, eventSummary: "Apresentação Smart Dent · Danilo Henrique" }), null);
  const ok = pickNotesDoc({ attachments: [], folderDocs: [...docs, { id: "Z", name: "Apresentação Smart Dent · Danilo Henrique · RMS - 2026/11/10 18:27 GMT-03:00 - Anotações do Gemini" }], eventSummary: "Apresentação Smart Dent · Danilo Henrique · RMS" });
  assertEquals(ok?.id, "Z");
});
