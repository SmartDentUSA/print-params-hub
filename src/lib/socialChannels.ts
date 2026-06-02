// Channel metadata for Social Publisher
export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'pinterest' | 'reddit';

export const SOCIAL_CHANNELS: Record<SocialPlatform, { label: string; handle: string; emoji: string; colorClass: string; formats: string[] }> = {
  instagram: { label: 'Instagram', handle: '@smartdentoficial', emoji: '📸', colorClass: 'bg-social-instagram', formats: ['Feed', 'Reels', 'Stories', 'Carrossel'] },
  facebook:  { label: 'Facebook',  handle: 'smartdentoficial',  emoji: '👥', colorClass: 'bg-social-facebook',  formats: ['Post', 'Reels', 'Stories', 'Álbum'] },
  tiktok:    { label: 'TikTok',    handle: '@smartdentoficial', emoji: '🎵', colorClass: 'bg-social-tiktok',    formats: ['Vídeo', 'Carrossel'] },
  youtube:   { label: 'YouTube',   handle: '@smartdentcadcam',  emoji: '▶️', colorClass: 'bg-social-youtube',   formats: ['Vídeo', 'Shorts'] },
  pinterest: { label: 'Pinterest', handle: '@smartdentcadcam',  emoji: '📌', colorClass: 'bg-social-pinterest', formats: ['Image Pin', 'Video Pin', 'Idea Pin'] },
  reddit:    { label: 'Reddit',    handle: '@smartdent',        emoji: '🔴', colorClass: 'bg-social-reddit',    formats: ['Texto', 'Link', 'Imagem'] },
};

export function normalizePlatform(p?: string | null): SocialPlatform | null {
  if (!p) return null;
  const k = p.toLowerCase().trim();
  if (k.startsWith('ig') || k === 'instagram') return 'instagram';
  if (k.startsWith('fb') || k === 'facebook') return 'facebook';
  if (k.startsWith('tt') || k === 'tiktok') return 'tiktok';
  if (k.startsWith('yt') || k === 'youtube') return 'youtube';
  if (k.startsWith('pt') || k === 'pinterest' || k.startsWith('pin')) return 'pinterest';
  if (k.startsWith('rd') || k === 'reddit') return 'reddit';
  return null;
}

export function isVerticalFormat(format?: string | null): boolean {
  if (!format) return false;
  const k = format.toLowerCase();
  return k.includes('reel') || k.includes('stor') || k.includes('short') || k.includes('vídeo') || k.includes('video');
}