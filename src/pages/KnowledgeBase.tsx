import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  const [dialogContent, setDialogContent] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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
    return (
      <>
        <style>{kbStyles}</style>
        <style>{kbShellStyles}</style>
        {dialogContent && (
          <KnowledgeSEOHead content={dialogContent} category={dialogContent?.knowledge_categories} currentLang={lang} />
        )}
        <KbShellLayout
          active={activeKey}
          onChange={(k) => {
            if (k === 'overview') { setOverview(true); return; }
            setOverview(false);
            setTab(k);
          }}
          heroTitle={hero.title}
          heroSubtitle={hero.subtitle}
          showAdminButton
        >
          {overview ? (
            <KbTabOverview onGoto={(t) => { setOverview(false); setTab(t); }} />
          ) : (
            <>
              {tab === 'parametros' && <KbTabParametros />}
              {tab === 'videos' && <KbTabVideos onOpen={openArticle} />}
              {tab === 'artigos' && <KbTabArtigos onOpen={openArticle} />}
              {tab === 'ebooks' && <KbTabEbooks onOpen={openArticle} />}
              {tab === 'catalogo' && <KbTabCatalogo />}
              {tab === 'distribuidores' && <KbTabDistribuidores />}
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
