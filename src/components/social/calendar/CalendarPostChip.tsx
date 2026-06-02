import { cn } from '@/lib/utils';
import { normalizePlatform, SOCIAL_CHANNELS } from '@/lib/socialChannels';
import type { CalendarPost } from '@/hooks/social/useCalendarPosts';

const statusDot: Record<string, string> = {
  scheduled: 'bg-primary',
  publishing: 'bg-warning',
  published: 'bg-success',
  failed: 'bg-destructive',
  draft: 'bg-muted-foreground/50',
  cancelled: 'bg-muted-foreground/30',
};

export function CalendarPostChip({
  post,
  onDragStart,
  onClick,
}: {
  post: CalendarPost;
  onDragStart: (e: React.DragEvent, post: CalendarPost) => void;
  onClick?: (post: CalendarPost) => void;
}) {
  const draggable = ['scheduled', 'failed', 'draft'].includes(post.status);
  const firstChannel = post.channels[0];
  const plat = firstChannel ? normalizePlatform(firstChannel.platform) : null;
  const meta = plat ? SOCIAL_CHANNELS[plat] : null;
  const time = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => draggable && onDragStart(e, post)}
      onClick={() => onClick?.(post)}
      className={cn(
        'w-full text-left px-1.5 py-1 rounded text-[10px] leading-tight border bg-card hover:bg-accent transition-colors',
        'flex items-center gap-1.5 truncate',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
      title={post.caption ?? ''}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusDot[post.status] ?? 'bg-muted')} />
      {meta && (
        <span className={cn('w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] text-white shrink-0', meta.colorClass)}>
          {meta.emoji}
        </span>
      )}
      <span className="font-medium tabular-nums">{time}</span>
      <span className="truncate text-muted-foreground">{post.caption || 'Sem legenda'}</span>
    </button>
  );
}