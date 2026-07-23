import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArticleUrl } from '@/utils/knowledgeUrls';
import { getPublicOrigin } from '@/utils/publicOrigin';
import KbSectionHeader from './KbSectionHeader';
import KbSearchBar from './KbSearchBar';
import KbChips, { KbChipOption } from './KbChips';
import KbEmptyState from './KbEmptyState';
import KbSkeletonGrid from './KbSkeletonGrid';
import KbContentCard, { KbContentCardData } from './KbContentCard';
import { resolveCategoryTk } from './kbCategoryTaxonomy';
import KbListControls, { KbSortKey, KbViewMode } from './KbListControls';

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
  knowledge_categories: { id?: string; letter: string; name: string } | null;
  knowledge_videos: { thumbnail_url: string | null; video_duration_seconds: number | null; analytics_views: number | null }[];
}

interface Props { onOpen: (slug: string) => void; letterFilter?: string | null }

export default function KbTabVideos({ onOpen, letterFilter }: Props) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [chip, setChip] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<KbSortKey>('recent');
  const [view, setView] = useState<KbViewMode>('grid');

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      const term = q.trim();
      let query = supabase
        .from('knowledge_contents')
        .select('id, title, title_en, title_es, slug, excerpt, excerpt_en, excerpt_es, og_image_url, created_at, updated_at, category_id, view_count, knowledge_categories!inner(id,letter,name), knowledge_videos!inner(thumbnail_url,video_duration_seconds,analytics_views)')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (!term && letterFilter) query = query.eq('knowledge_categories.letter', letterFilter.toUpperCase());
      else if (!term && chip !== 'all') query = query.eq('category_id', chip);
      if (term) {
        const safe = term.replace(/[%,()]/g, ' ');
        query = query.or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%,content_html.ilike.%${safe}%`).limit(10000);
      } else {
        query = query.limit(10000);
      }
      const { data, error } = await query;
      if (!cancel) {
        if (error) { console.error(error); setRows([]); }
        else {
          const isDepoimentos = chip === 'ff524477-c553-4518-868e-8435e16a5c57';
          const byDateDesc = (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

          let sorted: any[];
          if (isDepoimentos) {
            sorted = ((data || []) as any[]).slice().sort(byDateDesc);
          } else {
            const dateSorted = ((data || []) as any[]).slice().sort(byDateDesc);
            const RECENT_COUNT = 10;
            const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            const recent = dateSorted
              .filter((r: any) => now - new Date(r.created_at).getTime() <= THIRTY_DAYS_MS)
              .slice(0, RECENT_COUNT);
            const recentIds = new Set(recent.map((r: any) => r.id));
            const byUpdatedDesc = (a: any, b: any) =>
              new Date(b.updated_at ?? b.created_at).getTime() -
              new Date(a.updated_at ?? a.created_at).getTime();
            const afterRecent = dateSorted.filter((r: any) => !recentIds.has(r.id));
            const updatedRecent = afterRecent
              .filter((r: any) => {
                const u = new Date(r.updated_at ?? r.created_at).getTime();
                const c = new Date(r.created_at).getTime();
                return now - u <= THIRTY_DAYS_MS && now - c > THIRTY_DAYS_MS;
              })
              .sort(byUpdatedDesc)
              .slice(0, RECENT_COUNT);
            const updatedIds = new Set(updatedRecent.map((r: any) => r.id));
            const byViewsDesc = (a: any, b: any) => {
              const va = a?.knowledge_videos?.[0]?.analytics_views ?? 0;
              const vb = b?.knowledge_videos?.[0]?.analytics_views ?? 0;
              if (vb !== va) return vb - va;
              return byDateDesc(a, b);
            };
            const remaining = afterRecent.filter((r: any) => !updatedIds.has(r.id));
            const topViewed = remaining.slice().sort(byViewsDesc).slice(0, RECENT_COUNT);
            const topViewedIds = new Set(topViewed.map((r: any) => r.id));
            const rest = remaining.filter((r: any) => !topViewedIds.has(r.id));
            sorted = [...recent, ...updatedRecent, ...topViewed, ...rest];
          }
          setRows(sorted as any);
        }
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [chip, q, letterFilter]);

  const filtered = (() => {
    const arr = rows.slice();
    if (sort === 'views') {
      arr.sort((a: any, b: any) => {
        const va = a?.knowledge_videos?.[0]?.analytics_views ?? a?.view_count ?? 0;
        const vb = b?.knowledge_videos?.[0]?.analytics_views ?? b?.view_count ?? 0;
        return vb - va;
      });
    } else if (sort === 'az') {
      arr.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR', { sensitivity: 'base' }));
    }
    return arr;
  })();

  const cards: KbContentCardData[] = filtered.map((r) => ({
    id: r.id,
    title: (language === 'en' && r.title_en) || (language === 'es' && r.title_es) || r.title,
    excerpt: (language === 'en' && r.excerpt_en) || (language === 'es' && r.excerpt_es) || r.excerpt,
    // Prioriza a Hero inserida pelo usuário (og_image_url) sobre o thumbnail
    // auto-gerado pelo Panda — em vídeos recém-criados o Panda devolve um
    // placeholder preto/vazio, o que fazia o card aparecer sem imagem.
    imageUrl: r.og_image_url || r.knowledge_videos?.[0]?.thumbnail_url || null,
    createdAt: r.created_at,
    categoryLetter: r.knowledge_categories?.letter || null,
    categoryName: r.knowledge_categories?.name || null,
    categoryTk: resolveCategoryTk(r.knowledge_categories?.id || r.category_id),
    durationSeconds: r.knowledge_videos?.[0]?.video_duration_seconds || null,
    viewCount: r.knowledge_videos?.[0]?.analytics_views ?? r.view_count ?? 0,
    shareUrl: `${getPublicOrigin()}${getArticleUrl({ slug: r.slug, knowledge_categories: r.knowledge_categories })}`,
  }));

  const chips: KbChipOption[] = CHIP_KEYS.map((c) => ({ key: c.key, label: t(c.tk) }));
  return (
    <section>
      {/* Título removido: hero do shell v2 é a única fonte do título nesta aba */}
      <KbSearchBar placeholder={t('kb.videos.search')} value={q} onDebouncedChange={setQ} />
      <div className="kb-chips-row">
        <KbChips options={chips} active={chip} onChange={setChip} align="left" />
        <KbListControls sort={sort} onSortChange={setSort} view={view} onViewChange={setView} />
      </div>
      {q.trim() && (
        <div className="kb-count" style={{ opacity: 0.75 }}>
          {t('kb.search.global_hint') !== 'kb.search.global_hint'
            ? t('kb.search.global_hint')
            : 'Buscando em toda a base de conhecimento'}
        </div>
      )}
      <div className={`kb-grid${view === 'list' ? ' kb-list' : ''}`}>
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