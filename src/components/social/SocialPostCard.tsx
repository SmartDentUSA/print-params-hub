import { Heart, MessageCircle, Eye, Link as LinkIcon, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { normalizePlatform, SOCIAL_CHANNELS, isVerticalFormat } from '@/lib/socialChannels';

export function SocialPostCard({ post }: { post: any }) {
  const plat = normalizePlatform(post.platform);
  const meta = plat ? SOCIAL_CHANNELS[plat] : null;
  const vertical = isVerticalFormat(post.format);
  const thumb = post.thumbnail_url || post.media_url;
  const link = post.short_link || post.post_url;

  const copyLink = async () => {
    if (!link) return toast.error('Sem link disponível');
    await navigator.clipboard.writeText(link);
    toast.success('Link copiado');
  };

  return (
    <Card className="overflow-hidden group">
      <div className={cn('relative bg-muted overflow-hidden', vertical ? 'aspect-[9/16]' : 'aspect-square')}>
        {thumb ? (
          <img src={thumb} alt={post.caption ?? ''} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">sem mídia</div>
        )}
        {meta && (
          <span className={cn('absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white', meta.colorClass)}>
            {meta.emoji} {meta.label}
          </span>
        )}
        {post.format && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/60 text-white backdrop-blur-sm">
            {post.format}
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="text-sm line-clamp-2 min-h-[2.5rem]">
          {post.caption || <span className="italic text-muted-foreground">Sem legenda</span>}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{post.likes ?? 0}</span>
          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{post.comments ?? 0}</span>
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.reach ?? post.views ?? 0}</span>
          <span className="ml-auto">
            {post.published_at ? new Date(post.published_at).toLocaleDateString('pt-BR') : '—'}
          </span>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1" onClick={copyLink}>
            <LinkIcon className="w-3 h-3" /> Copiar link
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info('Disponível na Fase 3')}>
            <Send className="w-3 h-3" /> Usar em WA
          </Button>
        </div>
      </div>
    </Card>
  );
}