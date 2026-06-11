import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import KbSectionHeader from './KbSectionHeader';
import KbSearchBar from './KbSearchBar';
import KbChips, { KbChipOption } from './KbChips';
import KbResultCount from './KbResultCount';
import KbEmptyState from './KbEmptyState';
import KbSkeletonGrid from './KbSkeletonGrid';
import { CATALOG_COLORS } from './kbCategoryColors';

// Normalize raw product_category values (mixed casing/variants) to canonical buckets
const CAT_ALIASES: Record<string, string> = {
  'SCANNERS 3D': 'SCANNERS 3D',
  'SCANNERS': 'SCANNERS 3D',
  'RESINAS 3D': 'RESINAS 3D',
  'RESINAS': 'RESINAS 3D',
  'IMPRESSÃO 3D': 'IMPRESSÃO 3D',
  'IMPRESSORAS 3D': 'IMPRESSÃO 3D',
  'PÓS-IMPRESSÃO': 'PÓS-IMPRESSÃO',
  'DENTÍSTICA, ESTÉTICA E ORTODONTIA': 'DENTÍSTICA, ESTÉTICA E ORTODONTIA',
  'CARACTERIZAÇÃO': 'CARACTERIZAÇÃO',
  'SOFTWARES': 'SOFTWARES',
  'SOFTWARE': 'SOFTWARES',
};
const CANONICAL_CATS = Array.from(new Set(Object.values(CAT_ALIASES)));

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

const SPECIAL = /\b(FDA|ANVISA|NOVO|LANÇAMENTO|KIT|KOL)\b/i;

interface CatalogRow {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image_url: string | null;
  product_category: string | null;
  product_subcategory: string | null;
  cta_1_label: string | null;
  cta_1_url: string | null;
  cta_2_label: string | null;
  cta_2_url: string | null;
}

interface DocLinks {
  datasheet_url: string | null;
  manual_url: string | null;
  spec_sheet_url: string | null;
}

interface ResinInfo { slug: string }

const normCat = (v: string | null): string | null => {
  if (!v) return null;
  const up = v.trim().toUpperCase();
  return CAT_ALIASES[up] ?? null;
};

export default function KbTabCatalogo() {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [docs, setDocs] = useState<Map<string, DocLinks>>(new Map());
  const [resins, setResins] = useState<Map<string, ResinInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [chip, setChip] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      const [{ data: cat, error: e1 }, { data: pc, error: e2 }, { data: rs, error: e3 }] = await Promise.all([
        supabase
          .from('system_a_catalog')
          .select('id, name, slug, description, image_url, product_category, product_subcategory, cta_1_label, cta_1_url, cta_2_label, cta_2_url')
          .eq('active', true)
          .eq('approved', true)
          .not('product_category', 'is', null)
          .order('product_category')
          .order('display_order')
          .order('name')
          .limit(500),
        supabase
          .from('products_catalog')
          .select('name, datasheet_url, manual_url, spec_sheet_url')
          .limit(1000),
        supabase
          .from('resins')
          .select('name, slug')
          .eq('active', true)
          .limit(500),
      ]);
      if (cancel) return;
      if (e1) console.error(e1);
      if (e2) console.error(e2);
      if (e3) console.error(e3);
      const docMap = new Map<string, DocLinks>();
      (pc || []).forEach((p: any) => {
        if (!p?.name) return;
        docMap.set(p.name.toLowerCase().trim(), {
          datasheet_url: p.datasheet_url,
          manual_url: p.manual_url,
          spec_sheet_url: p.spec_sheet_url,
        });
      });
      const resinMap = new Map<string, ResinInfo>();
      (rs || []).forEach((r: any) => {
        if (r?.name && r?.slug) resinMap.set(r.name.toLowerCase().trim(), { slug: r.slug });
      });
      setResins(resinMap);
      setDocs(docMap);
      setRows((cat || []) as any);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const canon = normCat(r.product_category);
      if (!canon) return false;
      if (chip !== 'all' && canon !== chip) return false;
      if (term && !(r.name?.toLowerCase().includes(term) || r.description?.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [rows, q, chip]);

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
            const canon = normCat(p.product_category) || 'SOFTWARES';
            const color = CATALOG_COLORS[canon] || '#5F6368';
            const bgBadge = color + '1A';
            const special = p.product_subcategory && SPECIAL.test(p.product_subcategory)
              ? p.product_subcategory.match(SPECIAL)![0].toUpperCase()
              : null;
            const d = docs.get(p.name.toLowerCase().trim());
            const resin = resins.get(p.name.toLowerCase().trim());
            const parametrizacaoUrl = resin
              ? `https://parametros.smartdent.com.br/base-conhecimento/f/${resin.slug}`
              : null;
            const lojaUrl = p.cta_1_url || null;
            const fdsUrl = d?.datasheet_url || d?.spec_sheet_url || null;
            const ifuUrl = d?.manual_url || null;
            const primaryUrl = lojaUrl || fdsUrl || ifuUrl || parametrizacaoUrl;
            const open = (url: string | null) => {
              if (url) window.open(url, '_blank', 'noopener,noreferrer');
            };
            return (
              <article key={p.id} className="kb-card" style={{ animationDelay: `${i * 18}ms` }}>
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    loading="lazy"
                    className="kb-cthumb"
                    style={{ cursor: primaryUrl ? 'pointer' : 'default', objectFit: 'contain', background: '#F6F8FB' }}
                    onClick={() => open(primaryUrl)}
                  />
                ) : (
                  <div
                    className="kb-cthumb kb-cthumb-fallback"
                    style={{ background: `linear-gradient(135deg, ${color}CC, ${color}44)`, cursor: primaryUrl ? 'pointer' : 'default' }}
                    onClick={() => open(primaryUrl)}
                    role="button"
                    tabIndex={0}
                  >
                    <span>📦</span>
                  </div>
                )}
                <div className="kb-cbody">
                  <div className="kb-meta">
                    <span className="kb-cat-badge" style={{ background: bgBadge, color }}>•</span>
                    <span className="kb-cat-label" style={{ color }}>{canon}</span>
                    {special && (
                      <span className="kb-special-badge" style={{ background: '#1A73E810', color: '#1A73E8' }}>{special}</span>
                    )}
                  </div>
                  <h3 className="kb-title">{p.name}</h3>
                  {(p.description || p.product_subcategory) && (
                    <p className="kb-excerpt">{p.description || p.product_subcategory}</p>
                  )}
                  {(lojaUrl || fdsUrl || ifuUrl) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {lojaUrl && (
                        <button
                          type="button"
                          className="kb-action-btn"
                          onClick={() => open(lojaUrl)}
                          style={{ background: '#1A73E8', color: '#fff', borderColor: '#1A73E8' }}
                          title="Loja"
                        >
                          🛒 Loja
                        </button>
                      )}
                      {fdsUrl && (
                        <button type="button" className="kb-action-btn" onClick={() => open(fdsUrl)} title="Ficha de Dados de Segurança">
                          📄 FDS
                        </button>
                      )}
                      {ifuUrl && (
                        <button type="button" className="kb-action-btn" onClick={() => open(ifuUrl)} title="Instruções de Uso">
                          📘 IFU
                        </button>
                      )}
                    </div>
                  )}
                  {parametrizacaoUrl && (
                    <div style={{ marginTop: 6 }}>
                      <button
                        type="button"
                        className="kb-action-btn"
                        onClick={() => open(parametrizacaoUrl)}
                        style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        title="Abrir ficha completa de parâmetros"
                      >
                        📖 Parametrização
                      </button>
                    </div>
                  )}
                  <div className="kb-cfoot">
                    <span className="kb-date">Smart Dent</span>
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