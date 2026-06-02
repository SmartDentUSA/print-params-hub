import { Instagram, Facebook, Youtube, Linkedin, Twitter, Image as ImageIcon, Store, Music2, Film, Clapperboard, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SocialPlatform } from '@/lib/socialChannels';

export type ChannelFormatKey =
  | 'instagram-feed'
  | 'instagram-stories'
  | 'instagram-reels'
  | 'facebook-feed'
  | 'facebook-stories'
  | 'facebook-reels'
  | 'twitter-post'
  | 'youtube-video'
  | 'youtube-shorts'
  | 'pinterest-pin'
  | 'gmb-update'
  | 'gallery-media'
  | 'tiktok-video'
  | 'linkedin-post';

export interface ChannelFormatOption {
  key: ChannelFormatKey;
  platform: SocialPlatform;
  format: string;
  label: string;        // tooltip
  brandHex: string;
}

// Lista ordenada exatamente como no mLabs (esquerda → direita).
export const CHANNEL_FORMAT_OPTIONS: ChannelFormatOption[] = [
  { key: 'instagram-feed',    platform: 'instagram', format: 'Feed',    label: 'Instagram Feed',    brandHex: '#E1306C' },
  { key: 'instagram-stories', platform: 'instagram', format: 'Stories', label: 'Instagram Stories', brandHex: '#E1306C' },
  { key: 'instagram-reels',   platform: 'instagram', format: 'Reels',   label: 'Instagram Reels',   brandHex: '#E1306C' },
  { key: 'facebook-feed',     platform: 'facebook',  format: 'Post',    label: 'Facebook Feed',     brandHex: '#1877F2' },
  { key: 'facebook-stories',  platform: 'facebook',  format: 'Stories', label: 'Facebook Stories',  brandHex: '#1877F2' },
  { key: 'facebook-reels',    platform: 'facebook',  format: 'Reels',   label: 'Facebook Reels',    brandHex: '#1877F2' },
  { key: 'twitter-post',      platform: 'twitter',   format: 'Post',    label: 'X / Twitter',       brandHex: '#000000' },
  { key: 'youtube-video',     platform: 'youtube',   format: 'Vídeo',   label: 'YouTube Vídeo',     brandHex: '#FF0000' },
  { key: 'youtube-shorts',    platform: 'youtube',   format: 'Shorts',  label: 'YouTube Shorts',    brandHex: '#FF0000' },
  { key: 'pinterest-pin',     platform: 'pinterest', format: 'Image Pin', label: 'Pinterest',       brandHex: '#E60023' },
  { key: 'gmb-update',        platform: 'gmb',       format: 'Update',  label: 'Google Meu Negócio', brandHex: '#4285F4' },
  { key: 'gallery-media',     platform: 'gallery',   format: 'Mídia',   label: 'Galeria',           brandHex: '#6B7280' },
  { key: 'tiktok-video',      platform: 'tiktok',    format: 'Vídeo',   label: 'TikTok',            brandHex: '#000000' },
  { key: 'linkedin-post',     platform: 'linkedin',  format: 'Post',    label: 'LinkedIn',          brandHex: '#0A66C2' },
];

interface Props {
  option: ChannelFormatOption;
  active: boolean;
  onClick: () => void;
}

/**
 * Botão de ícone canal+formato no estilo mLabs.
 * - Inativo: cinza (text-muted-foreground).
 * - Ativo: colorido com a cor da marca (brandHex).
 * - Stories: anel pontilhado ao redor.
 */
export function ChannelFormatIcon({ option, active, onClick }: Props) {
  const color = active ? option.brandHex : 'hsl(var(--muted-foreground) / 0.55)';
  const isStories = option.format === 'Stories';

  return (
    <button
      type="button"
      onClick={onClick}
      title={option.label}
      aria-label={option.label}
      aria-pressed={active}
      className={cn(
        'relative inline-flex items-center justify-center w-9 h-9 rounded-full transition-all',
        'hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isStories && 'p-[3px]',
      )}
      style={
        isStories
          ? { boxShadow: `inset 0 0 0 2px ${color}`, borderRadius: '9999px' }
          : undefined
      }
    >
      <span
        className={cn(
          'inline-flex items-center justify-center transition-colors',
          isStories && 'w-7 h-7 rounded-full',
        )}
        style={{ color }}
      >
        <Glyph option={option} />
      </span>
    </button>
  );
}

function Glyph({ option }: { option: ChannelFormatOption }) {
  const size = 22;
  switch (option.key) {
    case 'instagram-feed':
    case 'instagram-stories':
      return <Instagram size={size} strokeWidth={2} />;
    case 'instagram-reels':
    case 'facebook-reels':
      return <Clapperboard size={size} strokeWidth={2} />;
    case 'facebook-feed':
    case 'facebook-stories':
      return <Facebook size={size} strokeWidth={2} />;
    case 'twitter-post':
      // X / Twitter — usa o ícone do lucide (estilo retrô) por ora.
      return <Twitter size={size} strokeWidth={2} fill="currentColor" />;
    case 'youtube-video':
      return <Youtube size={size} strokeWidth={2} />;
    case 'youtube-shorts':
      return <Zap size={size} strokeWidth={2.4} fill="currentColor" />;
    case 'pinterest-pin':
      return (
        <span className="font-bold text-[18px] leading-none" style={{ fontFamily: 'Georgia, serif' }}>P</span>
      );
    case 'gmb-update':
      return <Store size={size} strokeWidth={2} />;
    case 'gallery-media':
      return <ImageIcon size={size} strokeWidth={2} />;
    case 'tiktok-video':
      return <Music2 size={size} strokeWidth={2} fill="currentColor" />;
    case 'linkedin-post':
      return <Linkedin size={size} strokeWidth={2} fill="currentColor" />;
  }
}