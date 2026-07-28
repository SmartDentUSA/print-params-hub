import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fetchMetaWithRetry, parseRetryAfter, parseRegainAccessSeconds, retryDelaySeconds } from "../_shared/meta-retry.ts";

const res = (status: number, headers: Record<string, string> = {}) =>
  new Response("{}", { status, headers });

Deno.test("parseRetryAfter: delta-seconds", () => {
  assertEquals(parseRetryAfter("120"), 120);
});

Deno.test("parseRetryAfter: HTTP-date", () => {
  const now = Date.parse("2026-07-28T10:00:00Z");
  assertEquals(parseRetryAfter("Tue, 28 Jul 2026 10:05:00 GMT", now), 300);
});

Deno.test("parseRetryAfter: garbage/null -> null", () => {
  assertEquals(parseRetryAfter(null), null);
  assertEquals(parseRetryAfter("soon"), null);
});

Deno.test("parseRegainAccessSeconds: BUC minutes -> seconds", () => {
  const h = JSON.stringify({ "123": [{ call_count: 90, estimated_time_to_regain_access: 12 }] });
  assertEquals(parseRegainAccessSeconds(h), 720);
});

Deno.test("retryDelaySeconds: takes the longer of both headers", () => {
  const headers = new Headers({
    "retry-after": "60",
    "x-business-use-case-usage": JSON.stringify({ "1": [{ estimated_time_to_regain_access: 5 }] }),
  });
  assertEquals(retryDelaySeconds(headers), 300);
});

Deno.test("429 with short Retry-After is slept inline then retried", async () => {
  const slept: number[] = [];
  let calls = 0;
  const out = await fetchMetaWithRetry("u", {
    fetchImpl: () => { calls++; return Promise.resolve(calls === 1 ? res(429, { "retry-after": "2" }) : res(200)); },
    sleep: (ms) => { slept.push(ms); return Promise.resolve(); },
    jitter: () => 0,
  });
  assertEquals(calls, 2);
  assertEquals(slept, [2000]); // honored Retry-After, not the 500ms base backoff
  assertEquals(out.response?.status, 200);
});

Deno.test("429 with long Retry-After returns immediately for parked backoff", async () => {
  const slept: number[] = [];
  let calls = 0;
  const out = await fetchMetaWithRetry("u", {
    fetchImpl: () => { calls++; return Promise.resolve(res(429, { "retry-after": "1800" })); },
    sleep: (ms) => { slept.push(ms); return Promise.resolve(); },
    jitter: () => 0,
  });
  assertEquals(calls, 1);
  assertEquals(slept, []);
  assertEquals(out.retryAfterSeconds, 1800);
});

Deno.test("5xx without Retry-After uses exponential backoff", async () => {
  const slept: number[] = [];
  let calls = 0;
  const out = await fetchMetaWithRetry("u", {
    fetchImpl: () => { calls++; return Promise.resolve(calls < 3 ? res(500) : res(200)); },
    sleep: (ms) => { slept.push(ms); return Promise.resolve(); },
    jitter: () => 0,
  });
  assertEquals(slept, [500, 1000]);
  assertEquals(out.response?.status, 200);
});

Deno.test("network errors retry then give up with error", async () => {
  let calls = 0;
  const out = await fetchMetaWithRetry("u", {
    fetchImpl: () => { calls++; return Promise.reject(new Error("boom")); },
    sleep: () => Promise.resolve(),
    jitter: () => 0,
  });
  assertEquals(calls, 3);
  assertEquals(out.response, null);
  assertEquals((out.error as Error).message, "boom");
});

Deno.test("2xx and 4xx (non-429) never retry", async () => {
  for (const status of [200, 400, 404]) {
    let calls = 0;
    const out = await fetchMetaWithRetry("u", {
      fetchImpl: () => { calls++; return Promise.resolve(res(status)); },
      sleep: () => Promise.resolve(),
    });
    assertEquals(calls, 1);
    assertEquals(out.response?.status, status);
  }
});
