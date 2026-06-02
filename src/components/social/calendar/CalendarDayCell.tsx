import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CalendarPostChip } from './CalendarPostChip';
import type { CalendarPost } from '@/hooks/social/useCalendarPosts';

export function CalendarDayCell({
  date,
  posts,
  inMonth,
  onDropPost,
  onDragStart,
  onChipClick,
}: {
  date: Date;
  posts: CalendarPost[];
  inMonth: boolean;
  onDropPost: (postId: string, targetDate: Date) => void;
  onDragStart: (e: React.DragEvent, post: CalendarPost) => void;
  onChipClick: (post: CalendarPost) => void;
}) {
  const [over, setOver] = useState(false);
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/post-id');
        if (id) onDropPost(id, date);
      }}
      className={cn(
        'min-h-[110px] border border-border p-1.5 flex flex-col gap-1 transition-colors',
        !inMonth && 'bg-muted/30 text-muted-foreground',
        over && 'bg-primary/10 border-primary',
      )}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span
          className={cn(
            'font-medium tabular-nums',
            isToday && 'bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center',
          )}
        >
          {date.getDate()}
        </span>
        {posts.length > 3 && (
          <span className="text-[9px] text-muted-foreground">+{posts.length - 3}</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {posts.slice(0, 3).map((p) => (
          <CalendarPostChip key={p.id} post={p} onDragStart={onDragStart} onClick={onChipClick} />
        ))}
      </div>
    </div>
  );
}