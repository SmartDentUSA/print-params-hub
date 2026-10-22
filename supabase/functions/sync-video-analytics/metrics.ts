/** Panda counters are snapshots, never increments; invalid responses must not erase history. */
export function pandaCounters(general: unknown) {
  const total = (general as { total?: Record<string, unknown> } | null)?.total;
  if (!total || typeof total.view !== 'number' || !Number.isFinite(total.view) || total.view < 0) return null;
  const number = (key: string) => typeof total[key] === 'number' && Number.isFinite(total[key]) && Number(total[key]) >= 0 ? Math.floor(Number(total[key])) : 0;
  return { views: number('view'), unique_views: number('unique_view'), plays: number('play'), unique_plays: number('unique_play') };
}

export function pandaRetention(data: unknown): number | null {
  const retention = (data as { retention?: Record<string, number> } | null)?.retention;
  if (!retention || !Object.keys(retention).length) return null;
  const values = Object.values(retention).filter(v => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  if (!values.length) return null;
  const first = retention['0'] || values[0];
  return first > 0 ? Number(Math.min(100, values.reduce((a, b) => a + b, 0) / values.length / first * 100).toFixed(2)) : 0;
}