import { useState, type ReactNode } from 'react';
import { Menu, Settings, LayoutGrid, PlaySquare, FileText, BookOpen, Calendar, Store, Sliders } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/LanguageSelector';
import KbShellSidebar, { type SidebarCategory } from './KbShellSidebar';
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
  children: ReactNode;
}

const TOP_TABS: { key: KbTab; label: string; icon: React.ReactNode }[] = [
  { key: 'parametros',     label: 'Parâmetros',    icon: <Sliders /> },
  { key: 'catalogo',       label: 'Catálogo',      icon: <LayoutGrid /> },
  { key: 'videos',         label: 'Vídeos',        icon: <PlaySquare /> },
  { key: 'artigos',        label: 'Artigos',       icon: <FileText /> },
  { key: 'ebooks',         label: 'Ebooks',        icon: <BookOpen /> },
  { key: 'distribuidores', label: 'Revendas',      icon: <Store /> },
  { key: 'eventos',        label: 'Eventos',       icon: <Calendar /> },
];

export default function KbShellLayout({
  active, onChange, counts, categories, heroTitle, heroSubtitle, heroArtUrl, showAdminButton, showOverview, children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
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
      />
      <div className="kbs-main">
        <div className="kbs-topbar">
          <button
            type="button"
            className="kbs-mobile-btn"
            aria-label="Abrir menu"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={18} />
          </button>
          <div className="kbs-toptabs">
            {TOP_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`kbs-toptab${active === t.key ? ' on' : ''}`}
                onClick={() => onChange(t.key)}
              >
                {t.icon}<span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="kbs-topright">
            {showAdminButton && (
              <Link to="/admin">
                <Button variant="outline" size="sm" className="flex items-center gap-2 rounded-full">
                  <Settings className="w-4 h-4" />
                  <span className="hidden md:inline">Admin</span>
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