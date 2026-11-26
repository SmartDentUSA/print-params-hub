import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeMetricFields, progressiveMetrics } from "./progressiveMetrics";

test("um resultado pronto aparece antes do cálculo mais lento terminar", async () => {
  let finishSlow: ((value: number) => void) | undefined;
  const slow = new Promise<number>((resolve) => { finishSlow = resolve; });
  const shown: number[] = [];
  const pending = progressiveMetrics([() => slow, async () => 24], (value) => shown.push(value), () => {}, 2);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(shown, [24]);
  finishSlow?.(137);
  await pending;
  assert.deepEqual(shown, [24, 137]);
});

test("falha de um indicador não impede os outros e respeita concorrência limitada", async () => {
  let active = 0, peak = 0;
  const values: number[] = [], failures: number[] = [];
  const jobs = [0, 1, 2, 3, 4].map((value) => async () => {
    active++; peak = Math.max(peak, active);
    await Promise.resolve(); active--;
    if (value === 2) throw new Error("indisponível");
    return value;
  });
  await progressiveMetrics(jobs, (value) => values.push(value), (_, index) => failures.push(index), 2);
  assert.equal(peak, 2);
  assert.deepEqual(values.sort(), [0, 1, 3, 4]);
  assert.deepEqual(failures, [2]);
});

test("envios e vendas recebidos em momentos diferentes não apagam um ao outro", () => {
  assert.deepEqual(mergeMetricFields({ revenue: 49817.6, sends: 1669 }, { revenue: 0, sends: 2250 }, ["sends"]), { revenue: 49817.6, sends: 2250 });
});