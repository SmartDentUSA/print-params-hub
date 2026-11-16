import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtSaoPaulo, planBroadcast, saoPauloLocalToIso } from "./waBroadcastSchedule.ts";

test("horário digitado é de São Paulo (UTC-3)", () => {
  assert.equal(saoPauloLocalToIso("2026-11-20T09:00"), "2026-11-20T12:00:00.000Z");
  assert.equal(fmtSaoPaulo(new Date("2026-11-20T12:00:00Z")), "20/11 09:00");
});

test("1.000 leads a 250 por hora: 4 lotes, último 3 h depois do início", () => {
  const p = planBroadcast({ leads: 1000, perHour: 250, scheduledAtIso: "2026-11-20T12:00:00.000Z", now: new Date("2026-11-20T10:00:00Z") });
  assert.equal(p.slots, 4);
  assert.equal(p.durationHours, 4);
  assert.equal(p.lastAt.toISOString(), "2026-11-20T15:00:00.000Z");
});

test("sem limite e sem data: envio imediato, não agendado", () => {
  const p = planBroadcast({ leads: 1000, perHour: null, scheduledAtIso: null, now: new Date("2026-11-20T10:00:00Z") });
  assert.equal(p.scheduled, false);
  assert.equal(p.slots, 1);
});
