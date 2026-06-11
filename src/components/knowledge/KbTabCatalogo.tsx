import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import KbSectionHeader from './KbSectionHeader';
import KbSearchBar from './KbSearchBar';
import KbChips, { KbChipOption } from './KbChips';
import KbResultCount from './KbResultCount';
import KbEmptyState from './KbEmptyState';
import KbSkeletonGrid from './KbSkeletonGrid';
import { CATALOG_COLORS } from './kbCategoryColors';

const CATEGORIES = [
  'SCANNERS 3D','RESINAS 3D','IMPRESSÃO 3D','PÓS-IMPRESSÃO',
  'DENTÍSTICA, ESTÉTICA E ORTODONTIA','CARACTERIZAÇÃO','SOFTWARES',
];

const CHIPS: KbChipOption[] = [
  { key: 'all', label: 'Todos' },
  { key: 'SCANNERS 3D', label: 'Scanners 3D' },
  { key: 'RESINAS 3D', label: 'Resinas 3D' },
  { key: 'IMPRESSÃO 3D', label: 'Impressão 3D' },
  { key: 'PÓS-IMPRESSÃO', label: 'Pós-Impressão' },
  { key: 'DENTÍSTICA, ESTÉTICA E ORTODONTIA', label: 'Dentística e Estética' },
  { key: 'CARACTERIZAÇÃO', label: 'Caracterização' },
  { key: 'SOFTWARES', label: 'Softwares' },
];

interface Row {
  product_id: string;
  name: string;
  category: string;
  subcategory: string | null;
  datasheet_url: string | null;
  spec_sheet_url: string | null;
}

const SPECIAL = /\b(FDA|ANVISA|NOVO|LANÇAMENTO|KIT|KOL)\b/i;

export default function KbTabCatalogo() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [chip, setChip] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      let query = supabase
        .from('products_catalog')
        .select('product_id, name, category, subcategory, datasheet_url, spec_sheet_url')
        .in('category', CATEGORIES)
        .order('category')
        .order('name')
        .limit(200);
      if (chip !== 'all') query = query.eq('category', chip);
      const { data, error } = await query;
      if (!cancel) {
        if (error) { console.error(error); setRows([]); }
        else setRows((data || []) as any);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [chip]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.name?.toLowerCase().includes(term));
  }, [rows, q]);

  const openProduct = (r: Row) => {
    const url = r.datasheet_url || r.spec_sheet_url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section>
      <KbSectionHeader title="Catálogo" subtitle="Produtos Smart Dent para odontologia digital" />
      <KbSearchBar placeholder="Buscar produtos, resinas, scanners..." value={q} onDebouncedChange={setQ} />
      <KbChips options={CHIPS} active={chip} onChange={setChip} />
      {!loading && <KbResultCount count={filtered.length} noun="product" />}
      <div className="kb-grid">
        {loading ? (
          <KbSkeletonGrid />
        ) : filtered.length === 0 ? (
          <KbEmptyState icon="📦" />
        ) : (
          filtered.map((p, i) => {
            const color = CATALOG_COLORS[p.category] || '#5F6368';
            const bgBadge = color + '1A';
            const special = p.subcategory && SPECIAL.test(p.subcategory) ? p.subcategory.match(SPECIAL)![0].toUpperCase() : null;
            return (
              <article key={p.product_id} className="kb-card" style={{ animationDelay: `${i * 22}ms` }}>
                <div
                  className="kb-cthumb kb-cthumb-fallback"
                  style={{ background: `linear-gradient(135deg, ${color}CC, ${color}44)`, cursor: 'pointer' }}
                  onClick={() => openProduct(p)}
                  role="button"
                  tabIndex={0}
                >
                  <span>📦</span>
                </div>
                <div className="kb-cbody">
                  <div className="kb-meta">
                    <span className="kb-cat-badge" style={{ background: bgBadge, color }}>•</span>
                    <span className="kb-cat-label" style={{ color }}>{p.category}</span>
                    {special && (
                      <span className="kb-special-badge" style={{ background: '#1A73E810', color: '#1A73E8' }}>{special}</span>
                    )}
                  </div>
                  <h3 className="kb-title">{p.name}</h3>
                  {p.subcategory && <p className="kb-excerpt">{p.subcategory}</p>}
                  <div className="kb-cfoot">
                    <span className="kb-date">Smart Dent</span>
                    <button type="button" className="kb-action-btn" onClick={() => openProduct(p)}>Ver mais +</button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}