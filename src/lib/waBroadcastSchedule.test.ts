import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCost, fillTokens, planBroadcast, pushIntoWindow } from "./waBroadcastSchedule";

const now = new Date("2026-11-20T12:00:00Z"); // 09:00 em São Paulo

test("250 leads, 100 por hora: 3 lotes de hora em hora", () => {
  const p = planBroadcast({ leads: 250, perHour: 100, scheduledAtIso: "2026-11-20T13:00:00.000Z", now });
  assert.equal(p.slots, 3);
  assert.equal(p.lastAt.toISOString(), "2026-11-20T15:00:00.000Z");
  assert.equal(p.durationHours, 3);
});

test("agendamento às 22:00 de São Paulo começa às 07:30 do dia seguinte", () => {
  assert.equal(pushIntoWindow(new Date("2026-11-21T01:00:00Z")).toISOString(), "2026-11-21T10:30:00.000Z");
  const p = planBroadcast({ leads: 10, perHour: null, scheduledAtIso: "2026-11-21T01:00:00.000Z", now });
  assert.equal(p.startAt.toISOString(), "2026-11-21T10:30:00.000Z");
  assert.equal(p.movedByWindow, true);
});

test("envio agora sem limite por hora não é agendado", () => {
  const p = planBroadcast({ leads: 500, perHour: null, scheduledAtIso: null, now });
  assert.equal(p.scheduled, false);
  assert.equal(p.slots, 1);
});

test("máximo 250 por dia: 600 leads viram 3 lotes, um a cada 24 h", () => {
  const p = planBroadcast({ leads: 600, perHour: null, perDay: 250, scheduledAtIso: "2026-11-20T12:00:00.000Z", now: new Date("2026-11-20T10:00:00Z") });
  assert.deepEqual(p.batches.map((b) => [b.at.toISOString(), b.count]), [
    ["2026-11-20T12:00:00.000Z", 250], ["2026-11-21T12:00:00.000Z", 250], ["2026-11-22T12:00:00.000Z", 100]]);
  assert.equal(p.days, 3);
});

test("250 por dia e 100 por hora: igual ao servidor", () => {
  const p = planBroadcast({ leads: 400, perHour: 100, perDay: 250, scheduledAtIso: "2026-11-20T13:00:00.000Z", now });
  assert.deepEqual(p.batches.map((b) => [b.at.toISOString(), b.count]), [
    ["2026-11-20T13:00:00.000Z", 100], ["2026-11-20T14:00:00.000Z", 100], ["2026-11-20T15:00:00.000Z", 50],
    ["2026-11-21T13:00:00.000Z", 100], ["2026-11-21T14:00:00.000Z", 50]]);
});

test("público até 250 sem data sai agora", () => {
  const p = planBroadcast({ leads: 200, perHour: null, perDay: 250, scheduledAtIso: null, now });
  assert.equal(p.scheduled, false);
  assert.equal(p.slots, 1);
});

test("custo: 600 mensagens a R$ 0,35 = R$ 210,00", () => {
  assert.equal(estimateCost(600, 0.35), 210);
});

test("texto livre troca campos do sistema", () => {
  const get = (k: string) => (k === "primeiro_nome" ? "" : k === "empresa" ? "Clínica X" : null);
  assert.equal(fillTokens("Oi {primeiro_nome}, oferta para {empresa}!", get), "Oi colega, oferta para Clínica X!");
});
