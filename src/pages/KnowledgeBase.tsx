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
    const mapped = LETTER_TO_TAB[categoryLetter.toLowerCase()];
    if (mapped && mapped !== tab) setTab(mapped);
    setOverview(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryLetter]);
  const [dialogContent, setDialogContent] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catCounts, setCatCounts] = useState<Record<string, { name: string; count: number }>>({});
  const [countryCounts, setCountryCounts] = useState<Array<{ country: string; count: number }>>([]);
  const [activeCountry, setActiveCountry] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all';
    return new URLSearchParams(window.location.search).get('country') || 'all';
  });
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

  // Update URL when tab changes (no reload). Skip when route is a dedicated path alias.
  useEffect(() => {
    if (forcedTab) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== tab) {
      params.set('tab', tab);
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
      : letters.length
      ? [
          { key: 'all', label: 'Tudo', count: total, active: !categoryLetter, onClick: () => navigate(`${basePath}?tab=${tab}`) },
          ...letters.map((l) => ({
            key: l,
            label: (({ A: 'Tutoriais', E: 'Depoimentos', C: 'Tecnologia', G: 'Demonstrativos' } as Record<string,string>)[l]) ?? catCounts[l]?.name ?? l,
            count: catCounts[l]?.count ?? 0,
            active: categoryLetter?.toUpperCase() === l,
            onClick: () => navigate(`${basePath}/${l.toLowerCase()}`),
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
          heroArtUrl={heroPrinterImg}
          onChange={(k) => {
            if (k === 'overview') { setOverview(true); return; }
            setOverview(false);
            setTab(k);
          }}
          categories={categories}
          heroTitle={hero.title}
          heroSubtitle={hero.subtitle}
          showAdminButton
        >
          {overview ? (
            <KbTabOverview onGoto={(t) => { setOverview(false); setTab(t); }} />
          ) : (
            <>
              {tab === 'parametros' && <KbTabParametros />}
              {tab === 'videos' && <KbTabVideos onOpen={openArticle} letterFilter={categoryLetter ?? null} />}
              {tab === 'artigos' && <KbTabArtigos onOpen={openArticle} letterFilter={categoryLetter ?? null} />}
              {tab === 'ebooks' && <KbTabEbooks onOpen={openArticle} />}
              {tab === 'catalogo' && <KbTabCatalogo />}
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
