import { LayoutGrid, List, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type KbSortKey = 'recent' | 'views' | 'az';
export type KbViewMode = 'grid' | 'list';

export const KB_SORT_LABELS: Record<KbSortKey, string> = {
  recent: 'Mais recentes',
  views: 'Mais vistos',
  az: 'A–Z',
};

interface Props {
  sort: KbSortKey;
  onSortChange: (s: KbSortKey) => void;
  view: KbViewMode;
  onViewChange: (v: KbViewMode) => void;
  showSort?: boolean;
  showView?: boolean;
}

export default function KbListControls({
  sort, onSortChange, view, onViewChange, showSort = true, showView = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="kb-lc">
      {showSort && (
        <div className="kb-lc-sort" ref={ref}>
          <button
            type="button"
            className="kb-lc-sort-btn"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span>{KB_SORT_LABELS[sort]}</span>
            <ChevronDown size={14} />
          </button>
          {open && (
            <div className="kb-lc-sort-menu" role="listbox">
              {(Object.keys(KB_SORT_LABELS) as KbSortKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="option"
                  aria-selected={sort === k}
                  className={`kb-lc-sort-item${sort === k ? ' on' : ''}`}
                  onClick={() => { onSortChange(k); setOpen(false); }}
                >
                  {KB_SORT_LABELS[k]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {showView && (
        <div className="kb-lc-view" role="group" aria-label="Modo de exibição">
          <button
            type="button"
            className={`kb-lc-view-btn${view === 'grid' ? ' on' : ''}`}
            onClick={() => onViewChange('grid')}
            aria-pressed={view === 'grid'}
            title="Grade"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            type="button"
            className={`kb-lc-view-btn${view === 'list' ? ' on' : ''}`}
            onClick={() => onViewChange('list')}
            aria-pressed={view === 'list'}
            title="Lista"
          >
            <List size={15} />
          </button>
        </div>
      )}
    </div>
  );
}