import { resolveAssetUrl } from '@/utils/assetUrl';

export type LandingAttendanceMedia = { url: string; kind: 'image' | 'video' | 'embed' };

/** Only the published landing's configured hero is eligible; never invent a fallback. */
export function landingAttendanceMedia(landing: { status: string; hero_image_url: string | null } | null): LandingAttendanceMedia | null {
  const raw = landing?.hero_image_url?.trim();
  if (landing?.status !== 'published' || !raw) return null;
  const url = resolveAssetUrl(raw);
  let parsed: URL;
  try { parsed = new URL(url, 'https://www.smartdent.com.br'); } catch { return null; }
  if (!['https:', 'http:'].includes(parsed.protocol)) return null;
  const isPanda = /(^|\.)pandavideo\.com(\.br)?$/i.test(parsed.hostname);
  const kind = isPanda || /player-vz-/i.test(parsed.hostname) || /\/embed\/?\?v=/i.test(url)
    ? 'embed'
    : /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url) ? 'video' : 'image';
  return { url, kind };
}