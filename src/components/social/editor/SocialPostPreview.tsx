import { useState } from 'react';
import { Heart, MessageCircle, Send, Bookmark, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SOCIAL_CHANNELS, SOCIAL_BRAND_HEX, type SocialPlatform } from '@/lib/socialChannels';
import type { PostInput } from '@/lib/social/postSchema';

function aspectFor(platform: SocialPlatform, format?: string): string {
  const f = (format ?? '').toLowerCase();
  if (platform === 'youtube') return f.includes('short') ? '9 / 16' : '16 / 9';
  if (platform === 'pinterest') return '2 / 3';
  if (platform === 'facebook') return f.includes('reel') || f.includes('stor') ? '9 / 16' : '1.91 / 1';
  if (platform === 'tiktok') return '9 / 16';
  if (platform === 'reddit') return '1.91 / 1';
  // instagram
  if (f.includes('reel') || f.includes('stor') || f.includes('short')) return '9 / 16';
  return '1 / 1';
}

function missingFor(c: any): string[] {
  const out: string[] = [];
  if (c.platform === 'youtube' && !c.title?.trim()) out.push('título');
  if (c.platform === 'pinterest' && !c.title?.trim()) out.push('título');
  if (c.platform === 'pinterest' && !c.pinterest_board?.trim()) out.push('board');
  if (c.platform === 'reddit' && !c.subreddit?.trim()) out.push('subreddit');
  if (c.platform === 'reddit' && !c.title?.trim()) out.push('título');
  return out;
}

export function SocialPostPreview({ value }: { value: PostInput }) {
  const channels = value.channels.length ? value.channels : [{ platform: 'instagram' as const, format: 'Feed' }];
  const [tabPlatform, setTabPlatform] = useState<SocialPlatform>(channels[0].platform);
  const active = channels.find((c) => c.platform === tabPlatform) ?? channels[0];
  const meta = SOCIAL_CHANNELS[active.platform];
  const brandHex = SOCIAL_BRAND_HEX[active.platform];
  const media = (value.per_channel_media?.[active.platform]?.[0]) ?? value.media_items[0];
  const aspect = aspectFor(active.platform, active.format);
  const isReddit = active.platform === 'reddit';

  return (
    <Card className="overflow-hidden sticky top-4">
      {channels.length > 1 && (
        <div className="flex gap-1 p-2 border-b overflow-x-auto">
          {channels.map((c) => {
            const isActive = c.platform === tabPlatform;
            const missing = missingFor(c);
            return (
              <button
                key={c.platform}
                type="button"
                onClick={() => setTabPlatform(c.platform)}
                className={cn(
                  'relative w-9 h-9 rounded-full flex items-center justify-center text-white text-sm transition-all',
                  isActive ? 'ring-2 ring-offset-2 ring-offset-background scale-105' : 'opacity-60 hover:opacity-100',
                )}
                style={{ backgroundColor: SOCIAL_BRAND_HEX[c.platform] }}
                title={SOCIAL_CHANNELS[c.platform].label}
              >
                {SOCIAL_CHANNELS[c.platform].emoji}
                {missing.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center">
                    <AlertTriangle className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 p-3 border-b">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
          style={{ backgroundColor: brandHex }}
        >
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate">{meta.handle}</div>
          <div className="text-[10px] text-muted-foreground">{meta.label} · {active.format ?? '—'}</div>
        </div>
      </div>

      {!isReddit && (
        <div className="relative bg-muted" style={{ aspectRatio: aspect }}>
          {media ? (
            media.type === 'video' ? (
              <video src={media.url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
            ) : (
              <img src={media.url} className="w-full h-full object-cover" alt="" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              Preview da mídia ({aspect})
            </div>
          )}
          {value.media_items.length > 1 && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] bg-black/60 text-white">
              1/{value.media_items.length}
            </span>
          )}
        </div>
      )}

      <div className="p-3 space-y-2">
        {!isReddit && (
          <div className="flex items-center gap-3 text-foreground">
            <Heart className="w-5 h-5" />
            <MessageCircle className="w-5 h-5" />
            <Send className="w-5 h-5" />
            <Bookmark className="w-5 h-5 ml-auto" />
          </div>
        )}
        {('title' in active) && active.title && (
          <div className="text-sm font-semibold">{active.title as string}</div>
        )}
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