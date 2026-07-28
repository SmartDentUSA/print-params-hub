/**
 * Meta Graph API — retry with exponential backoff honoring `Retry-After`.
 *
 * Why: the July outage (10 days of zero Meta ingestion) was caused by throttling
 * responses that aborted the whole pull cycle. Meta signals the required wait in
 * `Retry-After` (seconds or HTTP-date) and, for BUC throttles, in
 * `X-Business-Use-Case-Usage.estimated_time_to_regain_access` (minutes).
 * We now read both, retry short waits inline, and surface long waits so the
 * caller can park the function instead of hammering the endpoint.
 */

export interface RetryResult {
  response: Response | null;
  attempts: number;
  /** Seconds Meta asked us to wait before retrying (null when not signalled). */
  retryAfterSeconds: number | null;
  /** Last transport error, when all attempts failed without a response. */
  error?: unknown;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Waits above this are NOT slept inline; returned for a parked backoff. */
  maxInlineWaitMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  jitter?: () => number;
  onRetry?: (info: { attempt: number; delayMs: number; reason: string }) => void;
}

/** Parses `Retry-After`: delta-seconds or HTTP-date. Returns seconds or null. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null;
  const raw = value.trim();
  if (/^\d+$/.test(raw)) {
    const s = Number(raw);
    return Number.isFinite(s) && s >= 0 ? s : null;
  }
  const when = Date.parse(raw);
  if (!Number.isFinite(when)) return null;
  return Math.max(0, Math.ceil((when - now) / 1000));
}

/** Reads estimated_time_to_regain_access (minutes) from X-Business-Use-Case-Usage. */
export function parseRegainAccessSeconds(headerValue: string | null): number | null {
  if (!headerValue) return null;
  try {
    const parsed = JSON.parse(headerValue);
    let minutes = 0;
    for (const bizId of Object.keys(parsed || {})) {
      const entries = Array.isArray(parsed[bizId]) ? parsed[bizId] : [parsed[bizId]];
      for (const e of entries) {
        const v = Number(e?.estimated_time_to_regain_access);
        if (Number.isFinite(v) && v > minutes) minutes = v;
      }
    }
    return minutes > 0 ? minutes * 60 : null;
  } catch {
    return null;
  }
}

/** Wait Meta is asking for, from either header. */
export function retryDelaySeconds(headers: Headers, now: number = Date.now()): number | null {
  const ra = parseRetryAfter(headers.get("retry-after"), now);
  const regain = parseRegainAccessSeconds(headers.get("x-business-use-case-usage"));
  const candidates = [ra, regain].filter((v): v is number => typeof v === "number");
  return candidates.length ? Math.max(...candidates) : null;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchMetaWithRetry(url: string, opts: RetryOptions = {}): Promise<RetryResult> {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 8_000,
    maxInlineWaitMs = 5_000,
    fetchImpl = fetch,
    sleep = defaultSleep,
    jitter = Math.random,
    onRetry,
  } = opts;

  let attempts = 0;
  let lastError: unknown = null;

  while (attempts < maxRetries) {
    attempts++;
    let res: Response;
    try {
      res = await fetchImpl(url);
    } catch (err) {
      lastError = err;
      if (attempts >= maxRetries) return { response: null, attempts, retryAfterSeconds: null, error: err };
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempts - 1)) * (1 + jitter() * 0.25);
      onRetry?.({ attempt: attempts, delayMs: delay, reason: "network_error" });
      await sleep(delay);
      continue;
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable) return { response: res, attempts, retryAfterSeconds: null };

    const askedSeconds = retryDelaySeconds(res.headers);
    // Meta wants a long pause: hand it back so the caller parks the function.
    if (askedSeconds !== null && askedSeconds * 1000 > maxInlineWaitMs) {
      return { response: res, attempts, retryAfterSeconds: askedSeconds };
    }
    if (attempts >= maxRetries) return { response: res, attempts, retryAfterSeconds: askedSeconds };

    const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempts - 1)) * (1 + jitter() * 0.25);
    const delay = askedSeconds !== null ? Math.max(askedSeconds * 1000, backoff) : backoff;
    onRetry?.({ attempt: attempts, delayMs: delay, reason: `http_${res.status}` });
    await sleep(delay);
  }

  return { response: null, attempts, retryAfterSeconds: null, error: lastError };
}
