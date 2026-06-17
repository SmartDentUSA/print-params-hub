import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArticleUrl } from '@/utils/knowledgeUrls';
import KbSectionHeader from './KbSectionHeader';
import KbSearchBar from './KbSearchBar';
import KbChips, { KbChipOption } from './KbChips';
import KbEmptyState from './KbEmptyState';
import KbSkeletonGrid from './KbSkeletonGrid';
import KbContentCard, { KbContentCardData } from './KbContentCard';

const CHIP_KEYS: { key: string; tk: string }[] = [
  { key: 'all', tk: 'kb.chips.all' },
  { key: '45243aad-7143-4bc8-a649-05f741992e07', tk: 'kb.chips.videos_tutoriais' },
  { key: '67b81704-64f8-4739-b79f-24f46f70752c', tk: 'kb.chips.casos_clinicos' },
  { key: 'fc493982-ad8c-417f-9579-82786a97925a', tk: 'kb.chips.ciencia' },
  { key: 'ff524477-c553-4518-868e-8435e16a5c57', tk: 'kb.chips.depoimentos' },
  { key: '6b724172-f7c8-4a4c-bfb1-8c2ee4fc608e', tk: 'kb.chips.catalogo_produtos' },
];

interface Row {
  id: string; title: string; title_en: string | null; title_es: string | null;
  slug: string; excerpt: string | null; excerpt_en: string | null; excerpt_es: string | null;
  og_image_url: string | null; created_at: string; category_id: string; view_count: number | null;
  knowledge_categories: { letter: string; name: string } | null;
  knowledge_videos: { thumbnail_url: string | null; video_duration_seconds: number | null; analytics_views: number | null }[];
}

interface Props { onOpen: (slug: string) => void }

export default function KbTabVideos({ onOpen }: Props) {
  const { t, language } = useLanguage();
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
        .select('id, title, title_en, title_es, slug, excerpt, excerpt_en, excerpt_es, og_image_url, created_at, category_id, view_count, knowledge_categories!inner(letter,name), knowledge_videos!inner(thumbnail_url,video_duration_seconds,analytics_views)')
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
    title: (language === 'en' && r.title_en) || (language === 'es' && r.title_es) || r.title,
    excerpt: (language === 'en' && r.excerpt_en) || (language === 'es' && r.excerpt_es) || r.excerpt,
    imageUrl: r.knowledge_videos?.[0]?.thumbnail_url || r.og_image_url || null,
    createdAt: r.created_at,
    categoryLetter: r.knowledge_categories?.letter || null,
    categoryName: r.knowledge_categories?.name || null,
    durationSeconds: r.knowledge_videos?.[0]?.video_duration_seconds || null,
  }));

  const chips: KbChipOption[] = CHIP_KEYS.map((c) => ({ key: c.key, label: t(c.tk) }));
  return (
    <section>
      <KbSectionHeader title={t('kb.videos.title')} subtitle={t('kb.videos.subtitle')} />
      <KbSearchBar placeholder={t('kb.videos.search')} value={q} onDebouncedChange={setQ} />
      <KbChips options={chips} active={chip} onChange={setChip} />
      <div className="kb-grid">
        {loading ? (
          <KbSkeletonGrid />
        ) : cards.length === 0 ? (
          <KbEmptyState icon="🎬" />
        ) : (
          cards.map((c, i) => (
            <KbContentCard key={c.id} data={c} index={i} buttonLabel={t('kb.videos.watch')} onClick={() => onOpen(filtered[i].slug)} />
          ))
        )}
      </div>
    </section>
  );
}