import { LayoutGrid, PlaySquare, FileText, BookOpen, Calendar, Store, Sliders, Home, Layers } from 'lucide-react';
import type { KbTab } from '../KbTabSwitcher';

type NavKey = KbTab | 'overview';

const NAV: { key: NavKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview',       label: 'Visão geral',   icon: <Home /> },
  { key: 'catalogo',       label: 'Catálogo',      icon: <LayoutGrid /> },
  { key: 'videos',         label: 'Vídeos',        icon: <PlaySquare /> },
  { key: 'artigos',        label: 'Artigos',       icon: <FileText /> },
  { key: 'ebooks',         label: 'Ebooks',        icon: <BookOpen /> },
  { key: 'eventos',        label: 'Eventos',       icon: <Calendar /> },
  { key: 'distribuidores', label: 'Revendas',      icon: <Store /> },
  { key: 'parametros',     label: 'Parâmetros',    icon: <Sliders /> },
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
  const navItems = NAV.filter((item) => item.key !== 'overview' || showOverview);
  const ctaEnabled = cta?.enabled !== false;
  const ctaTitle = cta?.title || 'Soluções de odontologia digital';
  const ctaSubtitle = cta?.subtitle || 'Mais que tecnologia, entregamos autonomia e rentabilidade para seu consultório ou laboratório.';
  const ctaLabel = cta?.cta_label || 'Conheça nossas soluções →';
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
          <div className="kbs-side-label">Navegação</div>
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
                <span>{item.label}</span>
                {typeof count === 'number' && count > 0 && <span className="kbs-count">{count}</span>}
              </button>
            );
          })}
          {categories && categories.length > 0 && (
            <>
              <div className="kbs-side-label">Categorias</div>
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