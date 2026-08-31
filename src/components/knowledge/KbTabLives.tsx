import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Filter, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { TurmaComVagas } from '@/types/courses';
import {
  PublicOnlineCourseCard,
  publicPageStyles,
  ONLINE_LIVE_MODALITIES as ONLINE_MODALITIES,
  ONLINE_LIVE_CATEGORIES as ONLINE_CATEGORIES,
} from '@/components/agenda/onlineLiveShared';

export default function KbTabLives() {
  const [selectedProduct, setSelectedProduct] = useState('');
  const { data: publicCourses = [] } = useQuery({
    queryKey: ['kb_lives_courses'],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('smartops_courses')
        .select('*')
        .eq('active', true)
        .in('modality', ONLINE_MODALITIES)
        .in('category', ONLINE_CATEGORIES);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: allTurmas = [], isLoading } = useQuery({
    queryKey: ['kb_lives_turmas'],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_turmas_com_vagas')
        .select('*')
        .eq('active', true)
        .in('modality', ONLINE_MODALITIES)
        .order('start_date');
      if (error) throw error;
      return data as TurmaComVagas[];
    },
  });

  const groups = useMemo(() => {
    const allowed = new Set(publicCourses.map((c) => c.id as string));
    const map = new Map<string, TurmaComVagas[]>();
    for (const t of allTurmas) {
      if (!allowed.has(t.course_id)) continue;
      const arr = map.get(t.course_id) || [];
      arr.push(t);
      map.set(t.course_id, arr);
    }

    const today = new Date().toISOString().slice(0, 10);
    const dateOf = (t: TurmaComVagas) => t.start_date || '';
    const hasDate = (d: string) => d.length === 10;

    const all = publicCourses
      .map((c) => {
        const turmas = (map.get(c.id as string) || []).slice().sort((a, b) => {
          const da = dateOf(a);
          const db = dateOf(b);
          if (!hasDate(da) && !hasDate(db)) return 0;
          if (!hasDate(da)) return 1;
          if (!hasDate(db)) return -1;
          return da.localeCompare(db);
        });
        return { course_id: c.id as string, course: c, turmas };
      })
      .sort((a, b) => {
        const nextFuture = (list: TurmaComVagas[]) => {
          const future = list
            .map(dateOf)
            .filter((d) => hasDate(d) && d >= today)
            .sort((x, y) => x.localeCompare(y))[0];
          return future || null;
        };
        const latestPast = (list: TurmaComVagas[]) => {
          const past = list
            .map(dateOf)
            .filter((d) => hasDate(d) && d < today)
            .sort((x, y) => y.localeCompare(x))[0];
          return past || null;
        };

        const fa = nextFuture(a.turmas);
        const fb = nextFuture(b.turmas);

        // Cursos com data futura vêm primeiro, ordenados pela data mais próxima.
        if (fa && fb) return fa.localeCompare(fb);
        if (fa && !fb) return -1;
        if (!fa && fb) return 1;

        // Sem data futura: ordenar pela data passada mais recente (descendente).
        const pa = latestPast(a.turmas);
        const pb = latestPast(b.turmas);
        if (pa && pb) return pb.localeCompare(pa);
        if (pa && !pb) return -1;
        if (!pa && pb) return 1;
        return 0;
      });

    if (!selectedProduct) return all;
    return all.filter((g) => {
      const names =
        ((g.course as any)?.related_product_names as string[] | undefined) ||
        (g.turmas[0] as any)?.related_product_names ||
        [];
      return names.includes(selectedProduct);
    });
  }, [publicCourses, allTurmas, selectedProduct]);

  const availableProducts = useMemo(() => {
    const set = new Set<string>();
    for (const c of publicCourses) {
      const names = ((c as any)?.related_product_names as string[] | undefined) || [];
      for (const n of names) if (n?.trim()) set.add(n.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [publicCourses]);

  return (
    <div className="pp-root" style={{ background: 'transparent' }}>
      <style>{publicPageStyles}</style>
      {availableProducts.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="appearance-none h-9 pl-8 pr-8 rounded-full border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[180px]"
            >
              <option value="">Todos os produtos</option>
              {availableProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▼</span>
          </div>
          {selectedProduct && (
            <button
              type="button"
              onClick={() => setSelectedProduct('')}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-full border bg-background text-xs font-medium hover:bg-accent transition-colors"
            >
              <X className="w-3 h-3" />
              Limpar: {selectedProduct}
            </button>
          )}
        </div>
      )}
      {isLoading ? (
        <div className="pp-empty">Carregando...</div>
      ) : groups.length === 0 ? (
        <div className="pp-empty">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma live ou curso online disponível no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <PublicOnlineCourseCard
              key={g.course_id}
              sessions={g.turmas}
              course={g.course}
              description={g.course?.description ?? undefined}
              canUpload={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
