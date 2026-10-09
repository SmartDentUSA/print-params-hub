import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveClientDot } from "./useLeadCardSignals";

const now = new Date("2026-10-09T12:00:00Z").getTime();
const monthsAgo = (m: number) => new Date(now - m * 30.4375 * 86400000).toISOString();

test("não cliente = branca", () => assert.equal(resolveClientDot(null, false, now), "nao_cliente"));
test("compra há 2 meses = verde", () => assert.equal(resolveClientDot(monthsAgo(2), true, now), "verde"));
test("compra há 5 meses = amarela", () => assert.equal(resolveClientDot(monthsAgo(5), true, now), "amarelo"));
test("compra há 8 meses = amarela", () => assert.equal(resolveClientDot(monthsAgo(8), true, now), "amarelo"));
test("compra há 10 meses = vermelha", () => assert.equal(resolveClientDot(monthsAgo(10), true, now), "vermelho"));
