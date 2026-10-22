/** Lovable CDN assets (/__l5e/...) are only proxied on Lovable-managed hosts; the public www site needs the admin origin. */
export const ASSET_ORIGIN = 'https://admin.smartdent.com.br';

export function resolveAssetUrl(url: string): string {
  if (typeof window === 'undefined' || !url || !url.startsWith('/__l5e/')) return url;
  const host = window.location.hostname.toLowerCase();
  const onLovableHost =
    host === 'admin.smartdent.com.br' ||
    host.endsWith('.lovable.app') ||
    host === 'localhost' ||
    host === '127.0.0.1';
  return onLovableHost ? url : `${ASSET_ORIGIN}${url}`;
}
