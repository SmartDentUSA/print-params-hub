import { useEffect, useMemo, useState } from 'react';
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
  { key: 'fc493982-ad8c-417f-9579-82786a97925a', label: 'Ciência e Tecnologia' },
  { key: '67b81704-64f8-4739-b79f-24f46f70752c', label: 'Casos Clínicos' },
  { key: '83d0b6ea-59d7-4d98-80a1-ac7df83b697a', label: 'Falhas, como resolver' },
  { key: '67f92f1b-ea9e-42b9-94d1-7d685e25629c', label: 'Parâmetros Técnicos' },
];

interface Row {
  id: string; title: string; slug: string; excerpt: string | null;
  og_image_url: string | null; created_at: string; category_id: string;
  knowledge_categories: { letter: string; name: string } | null;
}

interface Props { onOpen: (slug: string) => void }

export default function KbTabArtigos({ onOpen }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [chip, setChip] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      // 1) IDs that have videos (to exclude — emulates NOT EXISTS)
      const { data: vids } = await supabase
        .from('knowledge_videos')
        .select('content_id')
        .limit(2000);
      const videoIds = new Set((vids || []).map((v: any) => v.content_id).filter(Boolean));

      const term = q.trim();
      let query = supabase
        .from('knowledge_contents')
        .select('id, title, slug, excerpt, og_image_url, created_at, category_id, knowledge_categories!inner(letter,name)')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (chip !== 'all') query = query.eq('category_id', chip);
      if (term) {
        const safe = term.replace(/[%,()]/g, ' ');
        query = query.or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%,content_html.ilike.%${safe}%`).limit(500);
      } else {
        query = query.limit(150);
      }
      const { data, error } = await query;
      if (!cancel) {
        if (error) { console.error(error); setRows([]); }
        else {
          const filtered = (data || []).filter((r: any) => !videoIds.has(r.id));
          setRows(filtered as any);
        }
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
    imageUrl: r.og_image_url,
    createdAt: r.created_at,
    categoryLetter: r.knowledge_categories?.letter || null,
    categoryName: r.knowledge_categories?.name || null,
  }));

  return (
    <section>
      <KbSectionHeader title="Artigos" subtitle="Artigos técnicos, casos clínicos e guias práticos" />
      <KbSearchBar placeholder="Buscar artigos, guias e publicações..." value={q} onDebouncedChange={setQ} />
      <KbChips options={CHIPS} active={chip} onChange={setChip} />
      {!loading && <KbResultCount count={cards.length} noun="article" />}
      <div className="kb-grid">
        {loading ? (
          <KbSkeletonGrid />
        ) : cards.length === 0 ? (
          <KbEmptyState icon="📄" />
        ) : (
          cards.map((c, i) => (
            <KbContentCard key={c.id} data={c} index={i} buttonLabel="Ler mais →" onClick={() => onOpen(filtered[i].slug)} />
          ))
        )}
      </div>
    </section>
  );
}