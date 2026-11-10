import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildDossierNote, calendarEventId, claimDecision, existingMeetLink, meetCodeFromUrl, pickMeetingSlot, piperunLocalToIso } from "./rules.ts";

const NOW = new Date("2026-11-10T18:00:00Z");

Deno.test("horário do PipeRun é lido como Brasília", () => {
  assertEquals(piperunLocalToIso("2026-11-10 15:29:00"), "2026-11-10T18:29:00.000Z");
});

Deno.test("sem reunião com horário → nenhum horário inventado", () => {
  assertEquals(pickMeetingSlot([{ activity_type_id: 54385, title: "Ligar", start_at: "2026-11-11 10:00:00" }], NOW), null);
  assertEquals(pickMeetingSlot([], NOW), null);
});

Deno.test("escolhe a próxima reunião aberta e ignora concluída", () => {
  const s = pickMeetingSlot([
    { id: 1, activity_type_id: 54384, status: 2, start_at: "2026-11-12 10:00:00" },
    { id: 2, activity_type_id: 54384, status: 1, start_at: "2026-11-13 09:00:00", duration: 45 },
    { id: 3, title: "Apresentação RayShape", status: 1, start_at: "2026-11-11 14:00:00", end_at: "2026-11-11 15:30:00" },
  ], NOW)!;
  assertEquals(s.activityId, 3);
  assertEquals(s.endIso, "2026-11-11T18:30:00.000Z");
});

Deno.test("duração padrão 60 min quando falta término", () => {
  const s = pickMeetingSlot([{ id: 9, activity_type_id: 54384, start_at: "2026-11-11 14:00:00" }], NOW)!;
  assertEquals(s.endIso, "2026-11-11T18:00:00.000Z");
});

Deno.test("mesmo negócio gera sempre o mesmo evento (sem duplicar)", () => {
  assertEquals(calendarEventId(65528480), "sdmeet65528480");
  assertEquals(/^[0-9a-v]{5,}$/.test(calendarEventId(65528480)), true);
});

Deno.test("link já gravado no campo 800593 é reaproveitado", () => {
  assertEquals(existingMeetLink([{ id: 800593, value: "https://meet.google.com/abc-defg-hij" }]), "https://meet.google.com/abc-defg-hij");
  assertEquals(existingMeetLink([{ id: 800593, value: "" }, { id: 1, value: "https://meet.google.com/abc-defg-hij" }]), null);
  assertEquals(meetCodeFromUrl("https://meet.google.com/bnv-qkip-uvt?x=1"), "bnv-qkip-uvt");
});

Deno.test("execução concorrente recente fica bloqueada; travada há 5+ min é retomada", () => {
  assertEquals(claimDecision("processing", "2026-11-10T17:58:00Z", NOW), "busy");
  assertEquals(claimDecision("processing", "2026-11-10T17:50:00Z", NOW), "take");
  assertEquals(claimDecision("created", "2026-11-10T10:00:00Z", NOW), "done");
  assertEquals(claimDecision("failed", "2026-11-10T17:59:00Z", NOW), "take");
});

Deno.test("dossiê não inventa campos ausentes", () => {
  const n = buildDossierNote({ lead: { nome: "Cliente Teste", especialidade: null }, deal: { id: 1, ownerName: "Ana" }, history: [], activities: [], meetUrl: null, slot: null });
  assertEquals(n.includes("Especialidade"), false);
  assertEquals(n.includes("aguardando data/hora"), true);
  assertEquals(n.includes("Vendedor responsável: Ana"), true);
});
