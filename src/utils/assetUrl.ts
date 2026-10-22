/** Lovable CDN assets (/__l5e/...) are only proxied on Lovable-managed hosts; the public www site needs the admin origin. */
export const ASSET_ORIGIN = 'https://admin.smartdent.com.br';

type BrowserLocation = { hostname: string } | undefined;

function currentHost(): string | undefined {
  return (globalThis as { location?: BrowserLocation }).location?.hostname;
}

export function resolveAssetUrl(url: string): string {
  const host = currentHost()?.toLowerCase();
  if (!host || !url || !url.startsWith('/__l5e/')) return url;
  const onLovableHost =
    host === 'admin.smartdent.com.br' ||
    host.endsWith('.lovable.app') ||
    host === 'localhost' ||
    host === '127.0.0.1';
  return onLovableHost ? url : `${ASSET_ORIGIN}${url}`;
}
