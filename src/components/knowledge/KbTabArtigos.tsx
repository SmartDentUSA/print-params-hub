import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArticleUrl } from '@/utils/knowledgeUrls';
import { getPublicOrigin } from '@/utils/publicOrigin';
import KbSectionHeader from './KbSectionHeader';
import KbSearchBar from './KbSearchBar';
import KbChips, { KbChipOption } from './KbChips';
import KbResultCount from './KbResultCount';
import KbEmptyState from './KbEmptyState';
import KbSkeletonGrid from './KbSkeletonGrid';
import KbContentCard, { KbContentCardData } from './KbContentCard';
import { resolveCategoryTk } from './kbCategoryTaxonomy';

const CHIP_KEYS: { key: string; tk: string }[] = [
  { key: 'all', tk: 'kb.chips.all' },
  { key: 'fc493982-ad8c-417f-9579-82786a97925a', tk: 'kb.chips.ciencia' },
  { key: '67b81704-64f8-4739-b79f-24f46f70752c', tk: 'kb.chips.casos_clinicos' },
  { key: '83d0b6ea-59d7-4d98-80a1-ac7df83b697a', tk: 'kb.chips.falhas' },
  { key: '67f92f1b-ea9e-42b9-94d1-7d685e25629c', tk: 'kb.chips.parametros' },
];

interface Row {
  id: string; title: string; title_en: string | null; title_es: string | null;
  slug: string; excerpt: string | null; excerpt_en: string | null; excerpt_es: string | null;
  og_image_url: string | null; created_at: string; category_id: string; view_count: number | null;
  knowledge_categories: { id?: string; letter: string; name: string } | null;
}

interface Props { onOpen: (slug: string) => void }

export default function KbTabArtigos({ onOpen }: Props) {
  const { t, language } = useLanguage();
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
        .limit(10000);
      const videoIds = new Set((vids || []).map((v: any) => v.content_id).filter(Boolean));

      const term = q.trim();
      let query = supabase
        .from('knowledge_contents')
        .select('id, title, title_en, title_es, slug, excerpt, excerpt_en, excerpt_es, og_image_url, created_at, updated_at, category_id, view_count, knowledge_categories!inner(id,letter,name)')
        .eq('active', true)
        .order('created_at', { ascending: false });
      // When the user is searching, ignore the active chip and scan the whole base.
      if (!term && chip !== 'all') query = query.eq('category_id', chip);
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
          const filtered = (data || []).filter((r: any) => !videoIds.has(r.id));
          const byDateDesc = (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

          const dateSorted = filtered.slice().sort(byDateDesc);
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
            const va = a?.view_count ?? 0;
            const vb = b?.view_count ?? 0;
            if (vb !== va) return vb - va;
            return byDateDesc(a, b);
          };
          const remaining = afterRecent.filter((r: any) => !updatedIds.has(r.id));
          const topViewed = remaining.slice().sort(byViewsDesc).slice(0, RECENT_COUNT);
          const topViewedIds = new Set(topViewed.map((r: any) => r.id));
          const rest = remaining.filter((r: any) => !topViewedIds.has(r.id));
          const sorted = [...recent, ...updatedRecent, ...topViewed, ...rest];
          setRows(sorted as any);
        }
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
    imageUrl: r.og_image_url,
    createdAt: r.created_at,
    categoryLetter: r.knowledge_categories?.letter || null,
    categoryName: r.knowledge_categories?.name || null,
    categoryTk: resolveCategoryTk(r.knowledge_categories?.id || r.category_id),
    viewCount: r.view_count ?? 0,
    shareUrl: `${getPublicOrigin()}${getArticleUrl({ slug: r.slug, knowledge_categories: r.knowledge_categories })}`,
  }));

  const chips: KbChipOption[] = CHIP_KEYS.map((c) => ({ key: c.key, label: t(c.tk) }));
  return (
    <section>
      {/* Título removido: hero do shell v2 é a única fonte do título nesta aba */}
      <KbSearchBar placeholder={t('kb.artigos.search')} value={q} onDebouncedChange={setQ} />
      <KbChips options={chips} active={chip} onChange={setChip} />
      {q.trim() && (
        <div className="kb-count" style={{ opacity: 0.75 }}>
          {t('kb.search.global_hint') !== 'kb.search.global_hint'
            ? t('kb.search.global_hint')
            : 'Buscando em toda a base de conhecimento'}
        </div>
      )}
      {!loading && <KbResultCount count={cards.length} noun="article" />}
      <div className="kb-grid">
        {loading ? (
          <KbSkeletonGrid />
        ) : cards.length === 0 ? (
          <KbEmptyState icon="📄" />
        ) : (
          cards.map((c, i) => (
            <KbContentCard key={c.id} data={c} index={i} buttonLabel={t('kb.artigos.read_more')} onClick={() => onOpen(filtered[i].slug)} />
          ))
        )}
      </div>
    </section>
  );
}