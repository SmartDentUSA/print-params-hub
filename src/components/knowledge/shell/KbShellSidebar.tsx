import { LayoutGrid, PlaySquare, FileText, BookOpen, Calendar, Store, Sliders, Home, Layers } from 'lucide-react';
import type { KbTab } from '../KbTabSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

type NavKey = KbTab | 'overview';

const NAV: { key: NavKey; icon: React.ReactNode }[] = [
  { key: 'overview',       icon: <Home /> },
  { key: 'catalogo',       icon: <LayoutGrid /> },
  { key: 'videos',         icon: <PlaySquare /> },
  { key: 'artigos',        icon: <FileText /> },
  { key: 'ebooks',         icon: <BookOpen /> },
  { key: 'eventos',        icon: <Calendar /> },
  { key: 'distribuidores', icon: <Store /> },
  { key: 'parametros',     icon: <Sliders /> },
];

export interface SidebarCategory { key: string; label: string; count?: number; active?: boolean; onClick?: () => void; isHeader?: boolean; }

export interface SidebarCta { enabled?: boolean; title?: string; subtitle?: string; cta_label?: string; cta_url?: string }

interface Props {
  active: NavKey;
  onChange: (key: NavKey) => void;
  counts?: Partial<Record<NavKey, number>>;
  categories?: SidebarCategory[];
  open?: boolean;
  onClose?: () => void;
  showOverview?: boolean;
  cta?: SidebarCta;
}

export default function KbShellSidebar({ active, onChange, counts, categories, open, onClose, showOverview = false, cta }: Props) {
  const { t } = useLanguage();
  const navItems = NAV.filter((item) => item.key !== 'overview' || showOverview);
  const ctaEnabled = cta?.enabled !== false;
  const ctaTitle = cta?.title || t('kb.sidebar_cta.title');
  const ctaSubtitle = cta?.subtitle || t('kb.sidebar_cta.subtitle');
  const ctaLabel = cta?.cta_label || t('kb.sidebar_cta.cta_label');
  const ctaUrl = cta?.cta_url || 'https://smartdent.com.br';
  return (
    <>
      {open && <div className="kbs-backdrop" onClick={onClose} />}
      <aside className={`kbs-side${open ? ' open' : ''}`}>
        <div className="kbs-side-logo">
          <img
            src="https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png"
            alt="Smart Dent"
          />
        </div>
        <div className="kbs-side-scroll">
          <div className="kbs-side-label">{t('kb.shell.nav')}</div>
          {navItems.map((item) => {
            const count = counts?.[item.key];
            return (
              <button
                key={item.key}
                type="button"
                className={`kbs-nav-btn${active === item.key ? ' on' : ''}`}
                onClick={() => { onChange(item.key); onClose?.(); }}
              >
                {item.icon}
                <span>{t(`kb.nav.${item.key}`)}</span>
                {typeof count === 'number' && count > 0 && <span className="kbs-count">{count}</span>}
              </button>
            );
          })}
          {categories && categories.length > 0 && (
            <>
              <div className="kbs-side-label">{t('kb.shell.categories')}</div>
              {categories.map((c) => (
                c.isHeader ? (
                  <div key={c.key} className="kbs-side-label" style={{ marginTop: 12, opacity: 0.75 }}>
                    {c.label}
                  </div>
                ) : (
                  <button
                    key={c.key}
                    type="button"
                    className={`kbs-nav-btn cat${c.active ? ' on' : ''}`}
                    onClick={() => { c.onClick?.(); onClose?.(); }}
                  >
                    <Layers />
                    <span>{c.label}</span>
                    {typeof c.count === 'number' && <span className="kbs-count">{c.count}</span>}
                  </button>
                )
              ))}
            </>
          )}
        </div>
        {ctaEnabled && (
          <div className="kbs-cta">
            <h4>{ctaTitle}</h4>
            <p>{ctaSubtitle}</p>
            <a href={ctaUrl} target="_blank" rel="noopener noreferrer">
              {ctaLabel}
            </a>
          </div>
        )}
      </aside>
    </>
  );
}