/** Embed IDs and Panda API IDs can differ; match the exact saved embed URL. */
export function pandaEmbedIdentity(raw: string | null | undefined): { origin: string; embedId: string } | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !/(^|\.)pandavideo\.com(\.br)?$/i.test(url.hostname)) return null;
    const embedId = url.searchParams.get('v');
    return embedId ? { origin: url.origin, embedId } : null;
  } catch { return null; }
}

/** Official Panda postMessage contract, restricted to this iframe and origin. */
export function isPandaPlayMessage(event: { origin: string; source: unknown; data: unknown }, expectedOrigin: string, frameWindow: unknown): boolean {
  return Boolean(frameWindow) && event.origin === expectedOrigin && event.source === frameWindow &&
    typeof event.data === 'object' && event.data !== null && (event.data as { message?: string }).message === 'panda_play';
}