import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { allowedSoFar, DAILY_CAP, remainingNow, roundRobin } from "./batches.ts";

const m = (h: number, mi = 0) => h * 60 + mi;

Deno.test("antes das 07:30 nada sai", () => {
  assertEquals(allowedSoFar(m(7, 29)), 0);
});
Deno.test("lote das 07:30 libera 100", () => {
  assertEquals(allowedSoFar(m(7, 30)), 100);
  assertEquals(allowedSoFar(m(11, 59)), 100);
});
Deno.test("lote das 12:00 libera mais 100", () => {
  assertEquals(allowedSoFar(m(12)), 200);
});
Deno.test("lote das 15:00 libera mais 100", () => {
  assertEquals(allowedSoFar(m(15)), 300);
});
Deno.test("lote das 17:30 libera mais 99 (total 399)", () => {
  assertEquals(allowedSoFar(m(17, 30)), 399);
  assertEquals(DAILY_CAP, 399);
});
Deno.test("com 100 já enviados, às 11h espera o próximo lote", () => {
  assertEquals(remainingNow(m(11), 100), 0);
  assertEquals(remainingNow(m(12), 100), 100);
});
Deno.test("rodízio entre campanhas respeita o limite", () => {
  assertEquals(roundRobin([["a1", "a2", "a3"], ["b1"]], 3), ["a1", "b1", "a2"]);
  assertEquals(roundRobin([["a1"], []], 5), ["a1"]);
});
