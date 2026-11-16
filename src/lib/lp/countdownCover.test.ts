import { test } from "node:test";
import assert from "node:assert/strict";
import { coverState, parseCountdownCover, splitRemaining } from "./countdownCover";

const cover = parseCountdownCover({
  type: "countdown",
  headline: "Aproveite descontos",
  start: "2026-11-16T00:00:00-03:00",
  phases: [
    { pct: 15, end: "2026-11-26T00:00:00-03:00", label: "21 a 25/11" },
    { pct: 25, end: "2026-11-21T00:00:00-03:00", label: "16 a 20/11" },
    { pct: 10, end: "2026-12-01T00:00:00-03:00", label: "26 a 30/11" },
  ],
})!;
const at = (iso: string) => Date.parse(iso);

test("16/11 às 15:38 de Brasília: fase 1 de 25% termina em 4 dias e 08:21:..", () => {
  const s = coverState(cover, at("2026-11-16T15:38:03-03:00"));
  assert.equal(s.status, "active");
  assert.equal(cover.phases[s.phaseIndex].pct, 25);
  assert.deepEqual(splitRemaining(s.remainingMs), { d: "04", h: "08", m: "21", s: "57" });
});

test("à meia-noite de 21/11 (Brasília) entra a fase de 15%", () => {
  const s = coverState(cover, at("2026-11-21T00:00:00-03:00"));
  assert.equal(cover.phases[s.phaseIndex].pct, 15);
});

test("26/11 entra a fase de 10% e a campanha termina em 01/12 00:00", () => {
  assert.equal(cover.phases[coverState(cover, at("2026-11-26T09:00:00-03:00")).phaseIndex].pct, 10);
  assert.equal(coverState(cover, at("2026-12-01T00:00:00-03:00")).status, "ended");
});

test("antes de 16/11 conta o tempo até o início", () => {
  const s = coverState(cover, at("2026-11-15T23:00:00-03:00"));
  assert.equal(s.status, "before");
  assert.deepEqual(splitRemaining(s.remainingMs), { d: "00", h: "01", m: "00", s: "00" });
});

test("capa sem fases válidas é ignorada", () => {
  assert.equal(parseCountdownCover({ type: "countdown", headline: "x", start: "2026-11-16", phases: [] }), null);
  assert.equal(parseCountdownCover(null), null);
});
