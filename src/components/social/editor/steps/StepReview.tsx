import { Calendar, Image as ImageIcon, Video, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SOCIAL_CHANNELS } from '@/lib/socialChannels';
import type { PostInput } from '@/lib/social/postSchema';

export function StepReview({ value }: { value: PostInput }) {
  const images = value.media_items.filter((m) => m.type === 'image').length;
  const videos = value.media_items.filter((m) => m.type === 'video').length;

  return (
    <div className="space-y-4">
      <div className="border rounded-md p-4 space-y-2">
        <div className="text-xs uppercase text-muted-foreground">Quando</div>
        <div className="flex items-center gap-2">
          {value.publish_now ? (
            <Badge variant="default" className="gap-1"><Send className="w-3 h-3" /> Publicar agora</Badge>
          ) : (
            <span className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {value.scheduled_at ? new Date(value.scheduled_at).toLocaleString('pt-BR') : '—'}
              <span className="text-xs text-muted-foreground">({value.timezone})</span>
            </span>
          )}
        </div>
      </div>

      <div className="border rounded-md p-4 space-y-2">
        <div className="text-xs uppercase text-muted-foreground">Canais ({value.channels.length})</div>
        <div className="flex flex-wrap gap-1.5">
          {value.channels.map((c) => {
            const meta = SOCIAL_CHANNELS[c.platform];
            return (
              <Badge key={c.platform} className={cn('text-white gap-1', meta.colorClass)}>
                {meta.emoji} {meta.label} · {c.format}
              </Badge>
            );
          })}
        </div>
      </div>

      <div className="border rounded-md p-4 space-y-2">
        <div className="text-xs uppercase text-muted-foreground">Mídia</div>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1"><ImageIcon className="w-4 h-4" /> {images} imagem(ns)</span>
          <span className="flex items-center gap-1"><Video className="w-4 h-4" /> {videos} vídeo(s)</span>
        </div>
      </div>

      <div className="border rounded-md p-4 space-y-2">
        <div className="text-xs uppercase text-muted-foreground">Legenda</div>
        <p className="text-sm whitespace-pre-wrap">{value.caption || <span className="italic text-muted-foreground">vazia</span>}</p>
        {value.hashtags.length > 0 && (
          <p className="text-xs text-primary">{value.hashtags.map((h) => `#${h}`).join(' ')}</p>
        )}
      </div>
    </div>
  );
}