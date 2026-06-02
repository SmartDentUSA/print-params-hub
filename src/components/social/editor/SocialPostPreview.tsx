import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SOCIAL_CHANNELS } from '@/lib/socialChannels';
import type { PostInput } from '@/lib/social/postSchema';

export function SocialPostPreview({ value }: { value: PostInput }) {
  const firstChannel = value.channels[0];
  const meta = firstChannel ? SOCIAL_CHANNELS[firstChannel.platform] : SOCIAL_CHANNELS.instagram;
  const isStories = firstChannel?.format?.toLowerCase().includes('stor');
  const isReels = firstChannel?.format?.toLowerCase().match(/reel|short/);
  const vertical = isStories || isReels;
  const media = value.media_items[0];

  return (
    <Card className="overflow-hidden sticky top-4">
      <div className="flex items-center gap-2 p-3 border-b">
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm', meta.colorClass)}>
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate">{meta.handle}</div>
          <div className="text-[10px] text-muted-foreground">{meta.label} · {firstChannel?.format ?? '—'}</div>
        </div>
      </div>

      <div className={cn('relative bg-muted', vertical ? 'aspect-[9/16]' : 'aspect-square')}>
        {media ? (
          media.type === 'video' ? (
            <video src={media.url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
          ) : (
            <img src={media.url} className="w-full h-full object-cover" alt="" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            Preview da mídia
          </div>
        )}
        {value.media_items.length > 1 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] bg-black/60 text-white">
            1/{value.media_items.length}
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-3 text-foreground">
          <Heart className="w-5 h-5" />
          <MessageCircle className="w-5 h-5" />
          <Send className="w-5 h-5" />
          <Bookmark className="w-5 h-5 ml-auto" />
        </div>
        <div className="text-xs">
          <span className="font-semibold">{meta.handle.replace('@', '')}</span>{' '}
          <span className="whitespace-pre-wrap">
            {value.caption || <span className="italic text-muted-foreground">sua legenda aparece aqui</span>}
          </span>
        </div>
        {value.hashtags.length > 0 && (
          <div className="text-xs text-primary line-clamp-2">{value.hashtags.map((h) => `#${h}`).join(' ')}</div>
        )}
      </div>
    </Card>
  );
}