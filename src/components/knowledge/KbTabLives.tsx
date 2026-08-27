import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Filter, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { TurmaComVagas } from '@/types/courses';
import { PublicOnlineCourseCard, publicPageStyles } from '@/components/agenda/onlineLiveShared';

/** Mesma config da página /agenda/online (+ categoria "Live de produtos"). */
const ONLINE_MODALITIES = ['online_ao_vivo', 'online'];
const ONLINE_CATEGORIES = ['workshop', 'webinar', 'live_produtos'];

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
    return publicCourses
      .map((c) => ({
        course_id: c.id as string,
        course: c,
        turmas: (map.get(c.id as string) || []).sort(
          (a, b) => (a.start_date || '').localeCompare(b.start_date || ''),
        ),
      }))
      .sort((a, b) => {
        const nextOf = (list: TurmaComVagas[]) =>
          list.map((t) => t.start_date || '').filter((d) => d >= today).sort()[0] || '9999';
        return nextOf(a.turmas).localeCompare(nextOf(b.turmas));
      });
  }, [publicCourses, allTurmas]);

  return (
    <div className="pp-root" style={{ background: 'transparent' }}>
      <style>{publicPageStyles}</style>
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
