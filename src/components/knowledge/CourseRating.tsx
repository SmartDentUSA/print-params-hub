import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, MessageSquareQuote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface RatingRow {
  id: string;
  rating: number;
  comment: string | null;
  author_name: string | null;
  created_at: string;
}

const VISITOR_STORAGE_KEY = 'sd_visitor_key';

function getVisitorKey(): string {
  try {
    let key = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!key) {
      key = `v_${crypto.randomUUID()}`;
      localStorage.setItem(VISITOR_STORAGE_KEY, key);
    }
    return key;
  } catch {
    return `v_${Math.random().toString(36).slice(2)}${Date.now()}`;
  }
}

function Stars({
  value,
  onChange,
  size = 'sm',
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'lg';
}) {
  const px = size === 'lg' ? 'w-7 h-7' : 'w-4 h-4';
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const cls = `${px} ${filled ? 'fill-primary text-primary' : 'text-muted-foreground/40'}`;
        return onChange ? (
          <button
            key={n}
            type="button"
            aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            className="p-0.5 rounded transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star className={cls} />
          </button>
        ) : (
          <Star key={n} className={cls} />
        );
      })}
    </div>
  );
}

export function RatingSummaryBadge({ courseId }: { courseId: string }) {
  const { data } = useQuery({
    queryKey: ['course_ratings', courseId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('professional_course_ratings')
        .select('rating')
        .eq('course_id', courseId);
      if (error) throw error;
      return (data ?? []) as { rating: number }[];
    },
  });

  if (!data || data.length === 0) return null;
  const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Star className="w-3.5 h-3.5 fill-primary text-primary" />
      <span className="font-semibold text-foreground">{avg.toFixed(1)}</span>
      <span>({data.length})</span>
    </span>
  );
}

export default function CourseRating({ courseId }: { courseId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [open, setOpen] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ['course_ratings_full', courseId],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('professional_course_ratings')
        .select('id, rating, comment, author_name, created_at')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as RatingRow[];
    },
  });

  const { avg, dist } = useMemo(() => {
    const d = [0, 0, 0, 0, 0];
    rows.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) d[r.rating - 1] += 1;
    });
    const a = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
    return { avg: a, dist: d };
  }, [rows]);

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('professional_course_ratings').insert({
        course_id: courseId,
        rating,
        comment: comment.trim() || null,
        author_name: name.trim() || null,
        visitor_key: getVisitorKey(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Avaliação enviada', description: 'Obrigado pelo seu feedback!' });
      setOpen(false);
      setComment('');
      qc.invalidateQueries({ queryKey: ['course_ratings_full', courseId] });
      qc.invalidateQueries({ queryKey: ['course_ratings', courseId] });
    },
    onError: (e: any) => {
      const dup = String(e?.message ?? '').includes('duplicate');
      toast({
        title: dup ? 'Você já avaliou este curso' : 'Não foi possível enviar',
        description: dup ? 'Cada visitante pode avaliar uma vez.' : String(e?.message ?? ''),
        variant: 'destructive',
      });
    },
  });

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
        <div className="flex items-center gap-3 sm:border-r sm:border-border sm:pr-5">
          <div className="text-3xl font-bold leading-none text-foreground">
            {rows.length ? avg.toFixed(1) : '—'}
          </div>
          <div className="flex flex-col gap-1">
            <Stars value={avg} />
            <span className="text-xs text-muted-foreground">
              {rows.length ? `${rows.length} avaliação${rows.length > 1 ? 'ões' : ''}` : 'Sem avaliações ainda'}
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-1">
          {[5, 4, 3, 2, 1].map((n) => {
            const count = dist[n - 1];
            const pct = rows.length ? (count / rows.length) * 100 : 0;
            return (
              <div key={n} className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-3 tabular-nums">{n}</span>
                <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground w-5 text-right tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border p-4 space-y-4">
        {!open ? (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Star className="w-3.5 h-3.5 mr-1.5" /> Avaliar este curso
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Stars value={rating} onChange={setRating} size="lg" />
              {rating > 0 && <span className="text-sm text-muted-foreground">{rating} de 5</span>}
            </div>
            <Input placeholder="Seu nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea
              placeholder="Conte como foi sua experiência (opcional)"
              value={comment}
              rows={3}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={rating < 1 || submit.isPending}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? 'Enviando...' : 'Enviar avaliação'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {rows.filter((r) => r.comment).length > 0 && (
          <div className="space-y-3 pt-1">
            {rows
              .filter((r) => r.comment)
              .slice(0, 5)
              .map((r) => (
                <div key={r.id} className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground truncate">
                      {r.author_name || 'Visitante'}
                    </span>
                    <Stars value={r.rating} />
                  </div>
                  <p className="text-sm text-muted-foreground inline-flex gap-1.5">
                    <MessageSquareQuote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{r.comment}</span>
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
