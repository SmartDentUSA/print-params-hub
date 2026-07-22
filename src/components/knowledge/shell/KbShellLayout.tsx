import { useState, type ReactNode } from 'react';
import { Menu, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/LanguageSelector';
import KbShellSidebar from './KbShellSidebar';
import KbHero from './KbHero';
import type { KbTab } from '../KbTabSwitcher';

export type KbShellNavKey = KbTab | 'overview';

interface Props {
  active: KbShellNavKey;
  onChange: (key: KbShellNavKey) => void;
  counts?: Partial<Record<KbShellNavKey, number>>;
  heroTitle: string;
  heroSubtitle?: string;
  heroArtUrl?: string;
  showAdminButton?: boolean;
  children: ReactNode;
}

export default function KbShellLayout({
  active, onChange, counts, heroTitle, heroSubtitle, heroArtUrl, showAdminButton, children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="kbs-root">
      <KbShellSidebar
        active={active}
        onChange={onChange}
        counts={counts}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
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
          {showAdminButton && (
            <Link to="/admin">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden md:inline">Admin</span>
              </Button>
            </Link>
          )}
          <LanguageSelector />
        </div>
        <div className="kbs-content">
          <KbHero title={heroTitle} subtitle={heroSubtitle} artUrl={heroArtUrl} />
          {children}
        </div>
      </div>
    </div>
  );
}