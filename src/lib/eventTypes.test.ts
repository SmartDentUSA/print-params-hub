import { test } from "node:test";
import assert from "node:assert/strict";
import { eventNarrative, eventTypeLabel, eventUsesVenue, normalizeEventType } from "./eventTypes";

test("os três tipos de evento existem com os nomes pedidos", () => {
  assert.equal(eventTypeLabel("feira_congresso"), "Feiras e congressos");
  assert.equal(eventTypeLabel("presencial_parceiros"), "Eventos presenciais com parceiros");
  assert.equal(eventTypeLabel("campanha_promocional"), "Campanhas promocionais");
});

test("evento sem tipo continua como feira/congresso", () => {
  assert.equal(normalizeEventType(null), "feira_congresso");
  assert.equal(normalizeEventType("outro"), "feira_congresso");
});

test("Black Friday como campanha promocional não usa narrativa de estande nem CTA de congresso", () => {
  const n = eventNarrative("campanha_promocional", "Black Friday 2026", false);
  assert.match(n.header, /CAMPANHA PROMOCIONAL/);
  assert.doesNotMatch(n.cta, /CONGRESSO/);
  assert.doesNotMatch(n.structure.join(" "), /Visite o Estande/);
  assert.equal(eventUsesVenue("campanha_promocional"), false);
});

test("feira/congresso mantém o convite ao estande", () => {
  const n = eventNarrative("feira_congresso", "CIPRO", false);
  assert.match(n.cta, /CONGRESSO/);
  assert.match(n.structure.join(" "), /Visite o Estande/);
});
