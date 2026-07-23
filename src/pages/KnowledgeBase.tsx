import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { KnowledgeSEOHead } from '@/components/KnowledgeSEOHead';
import { KnowledgeContentViewer } from '@/components/KnowledgeContentViewer';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useKnowledge } from '@/hooks/useKnowledge';
import KbTabSwitcher, { KbTab } from '@/components/knowledge/KbTabSwitcher';
import KbTabParametros from '@/components/knowledge/KbTabParametros';
import KbTabVideos from '@/components/knowledge/KbTabVideos';
import KbTabArtigos from '@/components/knowledge/KbTabArtigos';
import KbTabEbooks from '@/components/knowledge/KbTabEbooks';
import KbTabCatalogo from '@/components/knowledge/KbTabCatalogo';
import KbTabDistribuidores from '@/components/knowledge/KbTabDistribuidores';
import KbTabEventos from '@/components/knowledge/KbTabEventos';
import { kbStyles } from '@/components/knowledge/kbStyles';
import KbShellLayout, { type KbShellNavKey } from '@/components/knowledge/shell/KbShellLayout';
import { kbShellStyles } from '@/components/knowledge/shell/kbShellStyles';
import KbTabOverview from '@/components/knowledge/KbTabOverview';
import heroPrinterImg from '@/assets/kb-hero-printer.jpg';
import { CATALOG_SIDEBAR_FILTERS, rowMatchesCatalogFilter } from '@/components/knowledge/catalogSidebarFilters';
import { PRODUCT_CATALOG_ENTITY_TYPES } from '@/lib/catalogEntityTypes';
import { KB_HERO_SETTING_KEY, KB_CATALOG_PINS_KEY, KB_NAV_SHOW_OVERVIEW_KEY, KB_SIDEBAR_CTA_KEY } from '@/components/AdminKbHubEditor';

interface KnowledgeBaseProps { lang?: 'pt' | 'en' | 'es'; forcedTab?: KbTab }

const LETTER_TO_TAB: Record<string, KbTab> = {
  a: 'videos', e: 'videos',
  b: 'artigos', c: 'artigos', d: 'artigos', f: 'artigos',
  g: 'catalogo',
};

function getInitialTab(letter?: string, forcedTab?: KbTab): KbTab {
  if (forcedTab) return forcedTab;
  const fromUrl = new URLSearchParams(window.location.search).get('tab') as KbTab | null;
  if (fromUrl && ['parametros','catalogo','videos','artigos','ebooks','distribuidores','eventos'].includes(fromUrl)) return fromUrl;
  if (letter && LETTER_TO_TAB[letter.toLowerCase()]) return LETTER_TO_TAB[letter.toLowerCase()];
  return 'parametros';
}

export default function KnowledgeBase({ lang = 'pt', forcedTab }: KnowledgeBaseProps) {
  const { categoryLetter, contentSlug } = useParams();
  const navigate = useNavigate();
  const { setLanguage } = useLanguage();
  const { fetchContentBySlug } = useKnowledge();

  useEffect(() => { setLanguage(lang); }, [lang, setLanguage]);

  const [tab, setTab] = useState<KbTab>(() => getInitialTab(categoryLetter, forcedTab));
  // Sync tab when the URL categoryLetter changes (sidebar category click navigates route).
  useEffect(() => {
    if (forcedTab) return;
    if (!categoryLetter) return;
    // Prefer explicit ?tab= if present (so a letter shared across tabs stays on the right tab).
    const explicit = new URLSearchParams(window.location.search).get('tab') as KbTab | null;
    const mapped = explicit ?? LETTER_TO_TAB[categoryLetter.toLowerCase()];
    if (mapped && mapped !== tab) setTab(mapped);
    setOverview(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryLetter]);
  const [dialogContent, setDialogContent] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catCounts, setCatCounts] = useState<Record<string, { name: string; count: number }>>({});
  const [countryCounts, setCountryCounts] = useState<Array<{ country: string; count: number }>>([]);
  const [catalogRowsMeta, setCatalogRowsMeta] = useState<Array<{ name: string | null; product_category: string | null; product_subcategory: string | null }>>([]);
  const [activeCatalogFilter, setActiveCatalogFilter] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all';
    return new URLSearchParams(window.location.search).get('cat') || 'resinas_3d';
  });
  const [activeCountry, setActiveCountry] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all';
    return new URLSearchParams(window.location.search).get('country') || 'all';
  });
  // Editor HUB overrides (hero + catalog pins) loaded from site_settings.
  const [heroOverrides, setHeroOverrides] = useState<Record<string, { title?: string; subtitle?: string; image_url?: string }>>({});
  const [catalogPins, setCatalogPins] = useState<Record<string, string[]>>({});
  const [showOverviewNav, setShowOverviewNav] = useState<boolean>(false);
  const [sidebarCta, setSidebarCta] = useState<{ enabled?: boolean; title?: string; subtitle?: string; cta_label?: string; cta_url?: string }>({});
  useEffect(() => {
    (async () => {
      const heroKeys = ['overview','parametros','catalogo','videos','artigos','ebooks','eventos','distribuidores'] as const;
      const { data: heroRows } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', [...heroKeys.map((k) => KB_HERO_SETTING_KEY(k as any)), KB_NAV_SHOW_OVERVIEW_KEY, KB_SIDEBAR_CTA_KEY]);
      const hMap: Record<string, any> = {};
      (heroRows || []).forEach((row: any) => {
        if (row.key === KB_NAV_SHOW_OVERVIEW_KEY) {
          setShowOverviewNav(row.value === 'true');
          return;
        }
        if (row.key === KB_SIDEBAR_CTA_KEY) {
          try { setSidebarCta(JSON.parse(row.value) || {}); } catch { /* noop */ }
          return;
        }
        try { hMap[row.key] = JSON.parse(row.value); } catch { /* noop */ }
      });
      setHeroOverrides(hMap);
      const { data: pinRows } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', CATALOG_SIDEBAR_FILTERS.map((f) => KB_CATALOG_PINS_KEY(f.key)));
      const pMap: Record<string, string[]> = {};
      (pinRows || []).forEach((row: any) => {
        try {
          const arr = JSON.parse(row.value);
          if (Array.isArray(arr)) {
            const filterKey = String(row.key).replace(/^kb_catalog_pins_/, '');
            pMap[filterKey] = arr.filter((x: any) => typeof x === 'string');
          }
        } catch { /* noop */ }
      });
      setCatalogPins(pMap);
    })();
  }, []);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('knowledge_categories')
        .select('letter, name, knowledge_contents(count)')
        .eq('knowledge_contents.active', true);
      if (!data) return;
      const m: Record<string, { name: string; count: number }> = {};
      (data as any[]).forEach((row) => {
        m[row.letter] = { name: row.name, count: row.knowledge_contents?.[0]?.count ?? 0 };
      });
      setCatCounts(m);
    })();
  }, []);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase
        .from('system_a_catalog') as any)
        .select('name, product_category, product_subcategory')
        .eq('active', true)
        .eq('approved', true)
        .eq('visible_in_ui', true)
        .in('entity_type', PRODUCT_CATALOG_ENTITY_TYPES as unknown as string[]);
      if (!data) return;
      setCatalogRowsMeta(data as any[]);
    })();
  }, []);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('distributors')
        .select('pais')
        .eq('active', true);
      if (!data) return;
      const counts = new Map<string, number>();
      (data as any[]).forEach((r) => {
        const p = (r.pais || '').trim();
        if (!p) return;
        counts.set(p, (counts.get(p) ?? 0) + 1);
      });
      setCountryCounts(
        Array.from(counts.entries())
          .map(([country, count]) => ({ country, count }))
          .sort((a, b) => a.country.localeCompare(b.country, 'pt-BR')),
      );
    })();
  }, []);
  const shellV2 = typeof window === 'undefined'
    ? true
    : new URLSearchParams(window.location.search).get('shell') !== 'v1';
  const [overview, setOverview] = useState<boolean>(() =>
    shellV2 && !forcedTab && !categoryLetter && !new URLSearchParams(window.location.search).get('tab'),
  );
  // If overview nav is hidden and we defaulted to overview, fall back to the default tab.
  useEffect(() => {
    if (!showOverviewNav && overview) setOverview(false);
  }, [showOverviewNav, overview]);

  // Update URL when tab changes (no reload). Skip when route is a dedicated path alias.
  useEffect(() => {
    if (forcedTab) return;
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    if (params.get('tab') !== tab) {
      params.set('tab', tab);
      changed = true;
    }
    if (tab === 'catalogo' && !params.get('cat')) {
      params.set('cat', 'resinas_3d');
      changed = true;
    }
    if (changed) {
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
    }
  }, [tab, forcedTab]);

  // Deep-link to article: open dialog
  useEffect(() => {
    if (!contentSlug) { setDialogOpen(false); setDialogContent(null); return; }
    (async () => {
      const data = await fetchContentBySlug(contentSlug);
      if (data) {
        setDialogContent(data);
        setDialogOpen(true);
      }
    })();
  }, [contentSlug]);

  const openArticle = async (slug: string) => {
    const data = await fetchContentBySlug(slug);
    if (data) { setDialogContent(data); setDialogOpen(true); }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDialogContent(null);
    if (contentSlug) {
      const basePath = lang === 'en' ? '/en/knowledge-base'
        : lang === 'es' ? '/es/base-conocimiento'
        : '/base-conhecimento';
      navigate(`${basePath}?tab=${tab}`, { replace: true });
    }
  };

  if (shellV2) {
    const activeKey: KbShellNavKey = overview ? 'overview' : tab;
    const heroMap: Record<KbShellNavKey, { title: string; subtitle: string }> = {
      overview:       { title: 'Base de Conhecimento', subtitle: 'Tudo o que você precisa para operar a odontologia digital.' },
      parametros:     { title: 'Parâmetros',    subtitle: 'Parâmetros de impressão testados por impressora e resina.' },
      catalogo:       { title: 'Catálogo',      subtitle: 'Resinas, impressoras, scanners e consumíveis Smart Dent.' },
      videos:         { title: 'Vídeos',        subtitle: 'Vídeos tutoriais, casos clínicos e depoimentos.' },
      artigos:        { title: 'Artigos',       subtitle: 'Artigos técnicos, casos clínicos e guias práticos.' },
      ebooks:         { title: 'Ebooks',        subtitle: 'Materiais aprofundados para download.' },
      eventos:        { title: 'Eventos',       subtitle: 'Cursos, feiras e treinamentos.' },
      distribuidores: { title: 'Revendas',      subtitle: 'Rede oficial de revendas Smart Dent.' },
    };
    const hero = heroMap[activeKey];
    const override = heroOverrides[KB_HERO_SETTING_KEY(activeKey as any)] || {};
    const heroTitle = override.title || hero.title;
    const heroSubtitle = override.subtitle || hero.subtitle;
    const heroArt = override.image_url || heroPrinterImg;
    const TAB_LETTERS: Partial<Record<KbShellNavKey, string[]>> = {
      videos: ['A', 'E', 'C', 'G'],
      artigos: ['B', 'C', 'D', 'F'],
      catalogo: ['G'],
    };
    const letters = TAB_LETTERS[activeKey] ?? [];
    const total = letters.reduce((s, l) => s + (catCounts[l]?.count ?? 0), 0);
    const basePath = lang === 'en' ? '/en/knowledge-base'
      : lang === 'es' ? '/es/base-conocimiento'
      : '/base-conhecimento';
    const setCountryParam = (c: string) => {
      const params = new URLSearchParams(window.location.search);
      if (c === 'all') params.delete('country'); else params.set('country', c);
      params.set('tab', 'distribuidores');
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
      setActiveCountry(c);
    };
    const countryTotal = countryCounts.reduce((s, c) => s + c.count, 0);
    const CONTINENT_MAP: Record<string, string> = {
      brasil: 'América do Sul', brazil: 'América do Sul', argentina: 'América do Sul', chile: 'América do Sul',
      uruguai: 'América do Sul', uruguay: 'América do Sul', paraguai: 'América do Sul', paraguay: 'América do Sul',
      bolivia: 'América do Sul', bolívia: 'América do Sul', peru: 'América do Sul', colombia: 'América do Sul',
      colômbia: 'América do Sul', venezuela: 'América do Sul', equador: 'América do Sul', ecuador: 'América do Sul',
      mexico: 'América do Norte', méxico: 'América do Norte', 'estados unidos': 'América do Norte',
      eua: 'América do Norte', usa: 'América do Norte', 'united states': 'América do Norte', canada: 'América do Norte', canadá: 'América do Norte',
      portugal: 'Europa', espanha: 'Europa', spain: 'Europa', franca: 'Europa', frança: 'Europa', italia: 'Europa', itália: 'Europa',
      alemanha: 'Europa', germany: 'Europa', 'reino unido': 'Europa', uk: 'Europa',
    };
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const continentOf = (c: string) => CONTINENT_MAP[norm(c)] || 'Outros';
    const CONTINENT_ORDER = ['América do Sul', 'América do Norte', 'Europa', 'Ásia', 'África', 'Oceania', 'Outros'];
    const grouped = new Map<string, Array<{ country: string; count: number }>>();
    countryCounts.forEach((c) => {
      const k = continentOf(c.country);
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(c);
    });
    const continentCategories: any[] = [];
    CONTINENT_ORDER.forEach((cont) => {
      const list = grouped.get(cont);
      if (!list || !list.length) return;
      const total = list.reduce((s, x) => s + x.count, 0);
      continentCategories.push({
        key: `cont:${cont}`,
        label: cont,
        count: total,
        active: activeCountry === `cont:${cont}`,
        onClick: () => setCountryParam(`cont:${cont}`),
      });
    });
    const categories = activeKey === 'distribuidores'
      ? [
          { key: 'all', label: 'Todos os países', count: countryTotal, active: activeCountry === 'all', onClick: () => setCountryParam('all') },
          ...continentCategories,
        ]
      : activeKey === 'catalogo'
      ? CATALOG_SIDEBAR_FILTERS.map((def) => {
          const count = def.key === 'all'
            ? catalogRowsMeta.length
            : catalogRowsMeta.filter((r) => rowMatchesCatalogFilter(r, def)).length;
          return {
            key: def.key,
            label: def.label,
            count,
            active: activeCatalogFilter === def.key,
            onClick: () => {
              const params = new URLSearchParams(window.location.search);
              if (def.key === 'all') params.delete('cat'); else params.set('cat', def.key);
              params.set('tab', 'catalogo');
              window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
              setActiveCatalogFilter(def.key);
            },
          };
        })
      : letters.length
      ? [
          { key: 'all', label: 'Tudo', count: total, active: !categoryLetter, onClick: () => navigate(`${basePath}?tab=${tab}`) },
          ...letters.map((l) => ({
            key: l,
            label: (({ A: 'Tutoriais', E: 'Depoimentos', C: 'Tecnologia', G: 'Demonstrativos' } as Record<string,string>)[l]) ?? catCounts[l]?.name ?? l,
            count: catCounts[l]?.count ?? 0,
            active: categoryLetter?.toUpperCase() === l,
            onClick: () => navigate(`${basePath}/${l.toLowerCase()}?tab=${tab}`),
          })),
        ]
      : undefined;
    return (
      <>
        <style>{kbStyles}</style>
        <style>{kbShellStyles}</style>
        {dialogContent && (
          <KnowledgeSEOHead content={dialogContent} category={dialogContent?.knowledge_categories} currentLang={lang} />
        )}
        <KbShellLayout
          active={activeKey}
          heroArtUrl={heroArt}
          onChange={(k) => {
            if (k === 'overview') { setOverview(true); return; }
            setOverview(false);
            setTab(k);
          }}
          categories={categories}
          heroTitle={heroTitle}
          heroSubtitle={heroSubtitle}
          showAdminButton
          showOverview={showOverviewNav}
          cta={sidebarCta}
        >
          {overview ? (
            <KbTabOverview onGoto={(t) => { setOverview(false); setTab(t); }} />
          ) : (
            <>
              {tab === 'parametros' && <KbTabParametros />}
              {tab === 'videos' && <KbTabVideos onOpen={openArticle} letterFilter={categoryLetter ?? null} />}
              {tab === 'artigos' && <KbTabArtigos onOpen={openArticle} letterFilter={categoryLetter ?? null} />}
              {tab === 'ebooks' && <KbTabEbooks onOpen={openArticle} />}
              {tab === 'catalogo' && (
                <KbTabCatalogo
                  filterKey={activeCatalogFilter}
                  pinnedIds={catalogPins[activeCatalogFilter]}
                  pinnedElsewhereIds={Object.entries(catalogPins)
                    .filter(([k]) => k !== activeCatalogFilter)
                    .flatMap(([, ids]) => ids || [])}
                  onFilterChange={(k) => {
                    const params = new URLSearchParams(window.location.search);
                    if (k === 'all') params.delete('cat'); else params.set('cat', k);
                    params.set('tab', 'catalogo');
                    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
                    setActiveCatalogFilter(k);
                  }}
                />
              )}
              {tab === 'distribuidores' && <KbTabDistribuidores country={activeCountry} />}
              {tab === 'eventos' && <KbTabEventos />}
            </>
          )}
        </KbShellLayout>
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            {dialogContent && <KnowledgeContentViewer content={dialogContent} />}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#EEF1F6' }}>
      <style>{kbStyles}</style>
      {dialogContent && (
        <KnowledgeSEOHead content={dialogContent} category={dialogContent?.knowledge_categories} currentLang={lang} />
      )}
      <Header showAdminButton={true} />
      <main className="kb-root">
        <KbTabSwitcher active={tab} onChange={setTab} />
        {tab === 'parametros' && <KbTabParametros />}
        {tab === 'videos' && <KbTabVideos onOpen={openArticle} />}
        {tab === 'artigos' && <KbTabArtigos onOpen={openArticle} />}
        {tab === 'ebooks' && <KbTabEbooks onOpen={openArticle} />}
        {tab === 'catalogo' && <KbTabCatalogo />}
        {tab === 'distribuidores' && <KbTabDistribuidores />}
        {tab === 'eventos' && <KbTabEventos />}
      </main>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {dialogContent && <KnowledgeContentViewer content={dialogContent} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
