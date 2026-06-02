// Channel metadata for Social Publisher
export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'pinterest'
  | 'reddit'
  | 'twitter'
  | 'linkedin'
  | 'gmb'
  | 'gallery';

export const SOCIAL_CHANNELS: Record<SocialPlatform, { label: string; handle: string; emoji: string; colorClass: string; formats: string[] }> = {
  instagram: { label: 'Instagram', handle: '@smartdentoficial', emoji: '📸', colorClass: 'bg-social-instagram', formats: ['Feed', 'Reels', 'Stories', 'Carrossel'] },
  facebook:  { label: 'Facebook',  handle: 'smartdentoficial',  emoji: '👥', colorClass: 'bg-social-facebook',  formats: ['Post', 'Reels', 'Stories', 'Álbum'] },
  tiktok:    { label: 'TikTok',    handle: '@smartdentoficial', emoji: '🎵', colorClass: 'bg-social-tiktok',    formats: ['Vídeo', 'Carrossel'] },
  youtube:   { label: 'YouTube',   handle: '@smartdentcadcam',  emoji: '▶️', colorClass: 'bg-social-youtube',   formats: ['Vídeo', 'Shorts'] },
  pinterest: { label: 'Pinterest', handle: '@smartdentcadcam',  emoji: '📌', colorClass: 'bg-social-pinterest', formats: ['Image Pin', 'Video Pin', 'Idea Pin'] },
  reddit:    { label: 'Reddit',    handle: '@smartdent',        emoji: '🔴', colorClass: 'bg-social-reddit',    formats: ['Texto', 'Link', 'Imagem'] },
  twitter:   { label: 'X / Twitter', handle: '@smartdent',     emoji: '𝕏',  colorClass: 'bg-social-twitter',   formats: ['Post'] },
  linkedin:  { label: 'LinkedIn',  handle: 'smart-dent',        emoji: '💼', colorClass: 'bg-social-linkedin',  formats: ['Post'] },
  gmb:       { label: 'Google Meu Negócio', handle: 'Smart Dent', emoji: '🏪', colorClass: 'bg-social-gmb',     formats: ['Update'] },
  gallery:   { label: 'Galeria',   handle: 'mídia interna',     emoji: '🖼️', colorClass: 'bg-social-gallery',   formats: ['Mídia'] },
};

// Brand HEX colors — exceção semântica: cores de marca de redes sociais são fixas
// e usadas apenas em ícones/badges de marca via style={{ color }} ou borderColor.
export const SOCIAL_BRAND_HEX: Record<SocialPlatform, string> = {
  instagram: '#E1306C',
  facebook:  '#1877F2',
  tiktok:    '#000000',
  youtube:   '#FF0000',
  pinterest: '#E60023',
  reddit:    '#FF4500',
  twitter:   '#000000',
  linkedin:  '#0A66C2',
  gmb:       '#4285F4',
  gallery:   '#6B7280',
};

export type SocialFormat = 'feed' | 'image' | 'reel' | 'story' | 'video' | 'carousel' | 'short' | 'pin' | 'text';

export function classifyFormat(format?: string | null): SocialFormat {
  if (!format) return 'feed';
  const k = format.toLowerCase();
  if (k.includes('carro') || k.includes('carousel') || k.includes('álbum') || k.includes('album')) return 'carousel';
  if (k.includes('reel'))   return 'reel';
  if (k.includes('stor'))   return 'story';
  if (k.includes('short'))  return 'short';
  if (k.includes('idea pin') || k.includes('pin')) return 'pin';
  if (k.includes('vídeo') || k.includes('video')) return 'video';
  if (k.includes('text'))   return 'text';
  if (k.includes('image') || k.includes('feed') || k.includes('post')) return 'feed';
  return 'feed';
}

/** Retorna a aspect ratio CSS apropriada para um formato. */
export function aspectRatioFor(format?: string | null): string {
  switch (classifyFormat(format)) {
    case 'reel':
    case 'story':
    case 'short':
      return '9 / 16';
    case 'video':
      return '16 / 9';
    case 'pin':
      return '2 / 3';
    case 'carousel':
    case 'feed':
    case 'image':
    default:
      return '1 / 1';
  }
}

export function normalizePlatform(p?: string | null): SocialPlatform | null {
  if (!p) return null;
  const k = p.toLowerCase().trim();
  if (k.startsWith('ig') || k === 'instagram') return 'instagram';
  if (k.startsWith('fb') || k === 'facebook') return 'facebook';
  if (k.startsWith('tt') || k === 'tiktok') return 'tiktok';
  if (k.startsWith('yt') || k === 'youtube') return 'youtube';
  if (k.startsWith('pt') || k === 'pinterest' || k.startsWith('pin')) return 'pinterest';
  if (k.startsWith('rd') || k === 'reddit') return 'reddit';
  if (k === 'x' || k.startsWith('tw') || k === 'twitter') return 'twitter';
  if (k === 'in' || k.startsWith('li') || k === 'linkedin') return 'linkedin';
  if (k === 'gmb' || k.includes('google')) return 'gmb';
  if (k === 'gallery' || k === 'galeria') return 'gallery';
  return null;
}

export function isVerticalFormat(format?: string | null): boolean {
  if (!format) return false;
  const k = format.toLowerCase();
  return k.includes('reel') || k.includes('stor') || k.includes('short') || k.includes('vídeo') || k.includes('video');
}