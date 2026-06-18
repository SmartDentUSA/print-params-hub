import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, format, isSameDay, isSameMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { normalizePlatform } from '@/lib/socialChannels';
import { useCalendarPosts, type CalendarPost } from '@/hooks/social/useCalendarPosts';
import { useReschedulePost } from '@/hooks/social/useReschedulePost';
import { CalendarDayCell } from './CalendarDayCell';
import { CalendarFilters, type CalendarFiltersValue } from './CalendarFilters';
import { RescheduleDialog } from './RescheduleDialog';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function SocialCalendar() {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => new Date());
  const [filters, setFilters] = useState<CalendarFiltersValue>({ platform: 'all', status: 'all' });
  const [dragPost, setDragPost] = useState<CalendarPost | null>(null);
  const [pending, setPending] = useState<{ post: CalendarPost; date: Date } | null>(null);

  const range = useMemo(() => {
    const from = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const to = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return { from, to };
  }, [cursor]);

  const { data: allPosts = [], isLoading } = useCalendarPosts(range.from, range.to);
  const reschedule = useReschedulePost();

  const posts = useMemo(() => {
    return allPosts.filter((p) => {
      if (filters.status !== 'all' && p.status !== filters.status) return false;
      if (filters.platform !== 'all') {
        const has = p.channels.some((c: any) => normalizePlatform(c.platform) === filters.platform);
        if (!has) return false;
      }
      return true;
    });
  }, [allPosts, filters]);

  const days = useMemo(() => {
    const arr: Date[] = [];
    let d = range.from;
    while (d <= range.to) {
      arr.push(d);
      d = addDays(d, 1);
    }
    return arr;
  }, [range]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const key = format(new Date(p.scheduled_at), 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [posts]);

  const onDragStart = (e: React.DragEvent, post: CalendarPost) => {
    e.dataTransfer.setData('text/post-id', post.id);
    e.dataTransfer.effectAllowed = 'move';
    setDragPost(post);
  };

  const onDropPost = (postId: string, targetDate: Date) => {
    const post = allPosts.find((p) => p.id === postId);
    if (!post) return;
    const original = post.scheduled_at ? new Date(post.scheduled_at) : null;
    if (original && isSameDay(original, targetDate)) {
      setDragPost(null);
      return;
    }
    setPending({ post, date: targetDate });
    setDragPost(null);
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendário</h1>
          <p className="text-sm text-muted-foreground">Arraste posts entre datas para reagendar</p>
        </div>
        <Button onClick={() => navigate('/social/novo')}>Criar Post</Button>
        <Button
          variant="outline"
          onClick={() =>
            window.open(
              '/social/calendario',
              'social-calendar-popout',
              'noopener,noreferrer,width=1400,height=900',
            )
          }
          title="Abrir em nova janela (atualiza em tempo real)"
        >
          <ExternalLink className="w-4 h-4" /> Abrir em nova janela
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor((d) => addMonths(d, -1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
            <Button variant="outline" size="icon" onClick={() => setCursor((d) => addMonths(d, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold ml-2 capitalize">
              {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
          </div>
          <CalendarFilters value={filters} onChange={setFilters} />
        </div>

        <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-md overflow-hidden">
          {WEEKDAYS.map((w) => (
            <div key={w} className="bg-muted/50 py-1.5 text-xs font-medium text-center text-muted-foreground">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const key = format(d, 'yyyy-MM-dd');
            return (
              <CalendarDayCell
                key={key}
                date={d}
                inMonth={isSameMonth(d, cursor)}
                posts={postsByDay.get(key) ?? []}
                onDragStart={onDragStart}
                onDropPost={onDropPost}
                onChipClick={(p) => navigate(`/social/${p.id}/editar`)}
              />
            );
          })}
        </div>

        {isLoading && (
          <div className="text-center text-sm text-muted-foreground py-2">Carregando…</div>
        )}
      </Card>

      <RescheduleDialog
        open={!!pending}
        post={pending?.post ?? null}
        targetDate={pending?.date ?? null}
        onCancel={() => setPending(null)}
        onConfirm={(iso) => {
          if (!pending) return;
          reschedule.mutate({ id: pending.post.id, scheduledAt: iso });
          setPending(null);
        }}
      />
    </div>
  );
}