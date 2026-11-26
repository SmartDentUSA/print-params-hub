/** Publish each finished calculation immediately; one failure never holds other results. */
export async function progressiveMetrics<T>(jobs: (() => Promise<T>)[], onResult: (result: T, index: number) => void, onError: (error: unknown, index: number) => void, concurrency = 4) {
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const index = next++;
      try { onResult(await jobs[index](), index); }
      catch (error) { onError(error, index); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), jobs.length) }, worker));
}

export function mergeMetricFields<T extends object>(current: T, patch: T, fields: (keyof T)[]): T {
  const result = { ...current };
  for (const field of fields) result[field] = patch[field];
  return result;
}