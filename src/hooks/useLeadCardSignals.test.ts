import { describe, it, expect } from "vitest";
import { resolveClientDot } from "./useLeadCardSignals";

const now = new Date("2026-10-09T12:00:00Z").getTime();
const monthsAgo = (m: number) => new Date(now - m * 30.4375 * 86400000).toISOString();

describe("resolveClientDot", () => {
  it("não cliente = branca", () => expect(resolveClientDot(null, false, now)).toBe("nao_cliente"));
  it("compra há 2 meses = verde", () => expect(resolveClientDot(monthsAgo(2), true, now)).toBe("verde"));
  it("compra há 5 meses = amarela", () => expect(resolveClientDot(monthsAgo(5), true, now)).toBe("amarelo"));
  it("compra há 8 meses = amarela", () => expect(resolveClientDot(monthsAgo(8), true, now)).toBe("amarelo"));
  it("compra há 10 meses = vermelha", () => expect(resolveClientDot(monthsAgo(10), true, now)).toBe("vermelho"));
});
