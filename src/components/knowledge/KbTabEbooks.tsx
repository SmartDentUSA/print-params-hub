import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArticleUrl } from '@/utils/knowledgeUrls';
import { getPublicOrigin } from '@/utils/publicOrigin';
import KbSectionHeader from './KbSectionHeader';
import KbSearchBar from './KbSearchBar';
import KbResultCount from './KbResultCount';
import KbEmptyState from './KbEmptyState';
import KbSkeletonGrid from './KbSkeletonGrid';
import KbContentCard, { KbContentCardData } from './KbContentCard';
import { resolveCategoryTk } from './kbCategoryTaxonomy';

interface Row {
  id: string; title: string; title_en: string | null; title_es: string | null;
  slug: string; excerpt: string | null; excerpt_en: string | null; excerpt_es: string | null;
  og_image_url: string | null; created_at: string; category_id: string; view_count: number | null;
  knowledge_categories: { id?: string; letter: string; name: string } | null;
}

interface Props { onOpen: (slug: string) => void }

export default function KbTabEbooks({ onOpen }: Props) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      const term = q.trim();
      let query = supabase
        .from('knowledge_contents')
        .select('id, title, title_en, title_es, slug, excerpt, excerpt_en, excerpt_es, og_image_url, created_at, category_id, view_count, knowledge_categories!inner(id,letter,name)')
        .eq('active', true)
        .eq('is_ebook', true)
        .order('created_at', { ascending: false })
        .limit(10000);
      if (term) {
        const safe = term.replace(/[%,()]/g, ' ');
        query = query.or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%,content_html.ilike.%${safe}%`);
      }
      const { data, error } = await query;
      if (!cancel) {
        if (error) { console.error(error); setRows([]); }
        else setRows((data || []) as any);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [q]);

  const cards: KbContentCardData[] = rows.map((r) => ({
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

  return (
    <section>
      <KbSectionHeader
        title={t('kb.tabs.ebooks')}
        subtitle={t('kb.ebooks.subtitle') !== 'kb.ebooks.subtitle' ? t('kb.ebooks.subtitle') : ''}
      />
      <KbSearchBar placeholder={t('kb.artigos.search')} value={q} onDebouncedChange={setQ} />
      {!loading && <KbResultCount count={cards.length} noun="article" />}
      <div className="kb-grid">
        {loading ? (
          <KbSkeletonGrid />
        ) : cards.length === 0 ? (
          <KbEmptyState icon="📘" />
        ) : (
          cards.map((c, i) => (
            <KbContentCard key={c.id} data={c} index={i} buttonLabel={t('kb.artigos.read_more')} onClick={() => onOpen(rows[i].slug)} />
          ))
        )}
      </div>
    </section>
  );
}