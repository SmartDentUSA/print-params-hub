import { useState, type ReactNode } from 'react';
import { Menu, Settings, LayoutGrid, PlaySquare, FileText, BookOpen, Calendar, Store, Sliders } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import KbShellSidebar, { type SidebarCategory, type SidebarCta } from './KbShellSidebar';
import KbHero from './KbHero';
import type { KbTab } from '../KbTabSwitcher';

export type KbShellNavKey = KbTab | 'overview';

interface Props {
  active: KbShellNavKey;
  onChange: (key: KbShellNavKey) => void;
  counts?: Partial<Record<KbShellNavKey, number>>;
  categories?: SidebarCategory[];
  heroTitle: string;
  heroSubtitle?: string;
  heroArtUrl?: string;
  showAdminButton?: boolean;
  showOverview?: boolean;
  cta?: SidebarCta;
  children: ReactNode;
}

const TOP_TABS: { key: KbTab; icon: React.ReactNode }[] = [
  { key: 'parametros',     icon: <Sliders /> },
  { key: 'catalogo',       icon: <LayoutGrid /> },
  { key: 'videos',         icon: <PlaySquare /> },
  { key: 'artigos',        icon: <FileText /> },
  { key: 'ebooks',         icon: <BookOpen /> },
  { key: 'distribuidores', icon: <Store /> },
  { key: 'eventos',        icon: <Calendar /> },
];

export default function KbShellLayout({
  active, onChange, counts, categories, heroTitle, heroSubtitle, heroArtUrl, showAdminButton, showOverview, cta, children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <div className="kbs-root">
      <KbShellSidebar
        active={active}
        onChange={onChange}
        counts={counts}
        categories={categories}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        showOverview={showOverview}
        cta={cta}
      />
      <div className="kbs-main">
        <div className="kbs-topbar">
          <button
            type="button"
            className="kbs-mobile-btn"
            aria-label={t('kb.shell.open_menu')}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={18} />
          </button>
          <div className="kbs-toptabs">
            {TOP_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`kbs-toptab${active === tab.key ? ' on' : ''}`}
                onClick={() => onChange(tab.key)}
              >
                {tab.icon}<span>{t(`kb.tabs.${tab.key}`)}</span>
              </button>
            ))}
          </div>
          <div className="kbs-topright">
            {showAdminButton && (
              <Link to="/admin">
                <Button variant="outline" size="sm" className="flex items-center gap-2 rounded-full">
                  <Settings className="w-4 h-4" />
                  <span className="hidden md:inline">{t('common.admin')}</span>
                </Button>
              </Link>
            )}
            <LanguageSelector />
          </div>
        </div>
        <div className="kbs-content">
          <KbHero title={heroTitle} subtitle={heroSubtitle} artUrl={heroArtUrl} />
          {children}
        </div>
      </div>
    </div>
  );
}