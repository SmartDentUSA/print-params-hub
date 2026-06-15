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
import KbTabCatalogo from '@/components/knowledge/KbTabCatalogo';
import KbTabDistribuidores from '@/components/knowledge/KbTabDistribuidores';
import { kbStyles } from '@/components/knowledge/kbStyles';

interface KnowledgeBaseProps { lang?: 'pt' | 'en' | 'es' }

const LETTER_TO_TAB: Record<string, KbTab> = {
  a: 'videos', e: 'videos',
  b: 'artigos', c: 'artigos', d: 'artigos', f: 'artigos',
  g: 'catalogo',
};

function getInitialTab(letter?: string): KbTab {
  const fromUrl = new URLSearchParams(window.location.search).get('tab') as KbTab | null;
  if (fromUrl && ['parametros','catalogo','videos','artigos','distribuidores'].includes(fromUrl)) return fromUrl;
  if (letter && LETTER_TO_TAB[letter.toLowerCase()]) return LETTER_TO_TAB[letter.toLowerCase()];
  return 'parametros';
}

export default function KnowledgeBase({ lang = 'pt' }: KnowledgeBaseProps) {
  const { categoryLetter, contentSlug } = useParams();
  const navigate = useNavigate();
  const { setLanguage } = useLanguage();
  const { fetchContentBySlug } = useKnowledge();

  useEffect(() => { setLanguage(lang); }, [lang, setLanguage]);

  const [tab, setTab] = useState<KbTab>(() => getInitialTab(categoryLetter));
  const [dialogContent, setDialogContent] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Update URL when tab changes (no reload)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== tab) {
      params.set('tab', tab);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
    }
  }, [tab]);

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
        {tab === 'catalogo' && <KbTabCatalogo />}
        {tab === 'distribuidores' && <KbTabDistribuidores />}
      </main>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {dialogContent && <KnowledgeContentViewer content={dialogContent} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
