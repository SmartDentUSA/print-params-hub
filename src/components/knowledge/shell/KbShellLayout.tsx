import { useState, type ReactNode } from 'react';
import { Menu, LayoutGrid, PlaySquare, FileText, BookOpen, Calendar, Store, Sliders, Radio } from 'lucide-react';
import { LanguageSelector } from '@/components/LanguageSelector';
import { AccountButton } from '@/components/AccountButton';
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
  { key: 'lives',          icon: <Radio /> },
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
            <AccountButton />
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