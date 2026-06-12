import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import KbSectionHeader from './KbSectionHeader';
import KbSearchBar from './KbSearchBar';
import KbChips, { KbChipOption } from './KbChips';
import KbResultCount from './KbResultCount';
import KbEmptyState from './KbEmptyState';
import KbSkeletonGrid from './KbSkeletonGrid';
import KbContentCard, { KbContentCardData } from './KbContentCard';

const CHIPS: KbChipOption[] = [
  { key: 'all', label: 'Todos' },
  { key: '45243aad-7143-4bc8-a649-05f741992e07', label: 'Vídeos Tutoriais' },
  { key: '67b81704-64f8-4739-b79f-24f46f70752c', label: 'Casos Clínicos' },
  { key: 'fc493982-ad8c-417f-9579-82786a97925a', label: 'Ciência e Tecnologia' },
  { key: 'ff524477-c553-4518-868e-8435e16a5c57', label: 'Depoimentos e Cursos' },
  { key: '6b724172-f7c8-4a4c-bfb1-8c2ee4fc608e', label: 'Catálogo de Produtos' },
];

interface Row {
  id: string; title: string; slug: string; excerpt: string | null;
  og_image_url: string | null; created_at: string; category_id: string;
  knowledge_categories: { letter: string; name: string } | null;
  knowledge_videos: { thumbnail_url: string | null; video_duration_seconds: number | null }[];
}

interface Props { onOpen: (slug: string) => void }

export default function KbTabVideos({ onOpen }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [chip, setChip] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      const term = q.trim();
      let query = supabase
        .from('knowledge_contents')
        .select('id, title, slug, excerpt, og_image_url, created_at, category_id, knowledge_categories!inner(letter,name), knowledge_videos!inner(thumbnail_url,video_duration_seconds)')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (chip !== 'all') query = query.eq('category_id', chip);
      if (term) {
        const safe = term.replace(/[%,()]/g, ' ');
        query = query.or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%,content_html.ilike.%${safe}%`).limit(500);
      } else {
        query = query.limit(50);
      }
      const { data, error } = await query;
      if (!cancel) {
        if (error) { console.error(error); setRows([]); }
        else setRows((data || []) as any);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [chip, q]);

  const filtered = rows;

  const cards: KbContentCardData[] = filtered.map((r) => ({
    id: r.id,
    title: r.title,
    excerpt: r.excerpt,
    imageUrl: r.knowledge_videos?.[0]?.thumbnail_url || r.og_image_url || null,
    createdAt: r.created_at,
    categoryLetter: r.knowledge_categories?.letter || null,
    categoryName: r.knowledge_categories?.name || null,
    durationSeconds: r.knowledge_videos?.[0]?.video_duration_seconds || null,
  }));

  return (
    <section>
      <KbSectionHeader title="Vídeos" subtitle="Vídeos tutoriais, casos clínicos e depoimentos" />
      <KbSearchBar placeholder="Buscar vídeos, tutoriais, casos clínicos..." value={q} onDebouncedChange={setQ} />
      <KbChips options={CHIPS} active={chip} onChange={setChip} />
      {!loading && <KbResultCount count={cards.length} noun="video" />}
      <div className="kb-grid">
        {loading ? (
          <KbSkeletonGrid />
        ) : cards.length === 0 ? (
          <KbEmptyState icon="🎬" />
        ) : (
          cards.map((c, i) => (
            <KbContentCard key={c.id} data={c} index={i} buttonLabel="▶ Assistir" onClick={() => onOpen(filtered[i].slug)} />
          ))
        )}
      </div>
    </section>
  );
}