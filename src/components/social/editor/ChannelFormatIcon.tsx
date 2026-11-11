import { Instagram, Facebook, Youtube, Linkedin, Twitter, Image as ImageIcon, Store, Music2, Film, Clapperboard, Zap, Images, MessageSquare, Link as LinkIcon, PlaySquare, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export { CHANNEL_FORMAT_OPTIONS, type ChannelFormatKey, type ChannelFormatOption } from '@/lib/social/channelFormats';
import type { ChannelFormatOption } from '@/lib/social/channelFormats';

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
    case 'instagram-carousel':
      return <Images size={size} strokeWidth={2} />;
    case 'instagram-reels':
    case 'facebook-reels':
      return <Clapperboard size={size} strokeWidth={2} />;
    case 'facebook-feed':
    case 'facebook-stories':
      return <Facebook size={size} strokeWidth={2} />;
    case 'facebook-album':
      return <Images size={size} strokeWidth={2} />;
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
    case 'pinterest-video-pin':
      return <PlaySquare size={size} strokeWidth={2} />;
    case 'pinterest-idea-pin':
      return <Lightbulb size={size} strokeWidth={2} />;
    case 'gmb-update':
      return <Store size={size} strokeWidth={2} />;
    case 'gallery-media':
      return <ImageIcon size={size} strokeWidth={2} />;
    case 'tiktok-video':
      return <Music2 size={size} strokeWidth={2} fill="currentColor" />;
    case 'tiktok-carousel':
      return <Images size={size} strokeWidth={2} />;
    case 'reddit-text':
      return <MessageSquare size={size} strokeWidth={2} />;
    case 'reddit-link':
      return <LinkIcon size={size} strokeWidth={2} />;
    case 'reddit-image':
      return <ImageIcon size={size} strokeWidth={2} />;
    case 'linkedin-post':
      return <Linkedin size={size} strokeWidth={2} fill="currentColor" />;
  }
}