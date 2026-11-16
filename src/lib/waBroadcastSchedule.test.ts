import { test } from "node:test";
import assert from "node:assert/strict";
import { planBroadcast, pushIntoWindow } from "./waBroadcastSchedule";

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
