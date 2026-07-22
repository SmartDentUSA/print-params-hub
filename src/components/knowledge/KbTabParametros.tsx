import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import KbSectionHeader from './KbSectionHeader';
import KbChips, { KbChipOption } from './KbChips';
import KbResinSheetDialog from './KbResinSheetDialog';

interface Brand { id: string; name: string; slug: string }
interface Model { id: string; name: string; slug: string; image_url: string | null; resinCount?: number }
interface ParamRow {
  id: string;
  resin_name: string;
  cure_time: number | null;
  bottom_cure_time: number | null;
  bottom_layers: number | null;
  layer_height: number | null;
  lift_speed: number | null;
  retract_speed: number | null;
  anti_aliasing: boolean | null;
  notes: string | null;
  resin?: { image_url: string | null; fda_510k: string | null; anvisa_registration: string | null; slug: string | null } | null;
}

export default function KbTabParametros() {
  const { t } = useLanguage();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState<Model | null>(null);
  const [params, setParams] = useState<ParamRow[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingParams, setLoadingParams] = useState(false);
  const [sheet, setSheet] = useState<{ name: string; modelSlug: string | null } | null>(null);
  const paramAreaRef = useRef<HTMLDivElement | null>(null);
  const initialBrandSet = useRef(false);
  const initialModelSet = useRef(false);

  // Load brands
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('brands')
        .select('id,name,slug')
        .eq('active', true)
        .order('name');
      const list = ((data || []) as Brand[]).filter(b => b.slug?.toLowerCase() !== 'asiga');
      setBrands(list);
      if (!initialBrandSet.current) {
        const elegoo = list.find((b) => b.slug === 'elegoo' || b.name?.toLowerCase() === 'elegoo');
        if (elegoo) {
          setBrand(elegoo);
          initialBrandSet.current = true;
        }
      }
    })();
  }, []);

  // Load models when brand changes
  useEffect(() => {
    if (!brand) { setModels([]); setModel(null); return; }
    let cancel = false;
    setLoadingModels(true);
    (async () => {
      const { data: ms } = await supabase
        .from('models')
        .select('id,name,slug,image_url')
        .eq('brand_id', brand.id)
        .eq('active', true)
        .order('name');
      const list = (ms || []) as Model[];
      // Count resinas per model via parameter_sets (brand_slug+model_slug)
      const slugs = list.map((m) => m.slug);
      let counts: Record<string, number> = {};
      if (slugs.length) {
        const { data: ps } = await supabase
          .from('parameter_sets')
          .select('model_slug')
          .eq('brand_slug', brand.slug)
          .eq('active', true)
          .in('model_slug', slugs);
        (ps || []).forEach((r: any) => {
          counts[r.model_slug] = (counts[r.model_slug] || 0) + 1;
        });
      }
      if (!cancel) {
        const enriched = list.map((m) => ({ ...m, resinCount: counts[m.slug] || 0 }));
        setModels(enriched);
        if (!initialModelSet.current) {
          const mars5 = enriched.find((m) => m.slug === 'mars-5-ultra' || m.name === 'Mars 5 Ultra');
          if (mars5) {
            setModel(mars5);
            initialModelSet.current = true;
          } else {
            setModel(null);
          }
        } else {
          setModel(null);
        }
        setLoadingModels(false);
      }
    })();
    return () => { cancel = true; };
  }, [brand]);

  // Load parameters when model changes
  useEffect(() => {
    if (!brand || !model) { setParams([]); return; }
    if (typeof window !== 'undefined' && window.innerWidth < 768 && paramAreaRef.current) {
      requestAnimationFrame(() => {
        paramAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    let cancel = false;
    setLoadingParams(true);
    (async () => {
      const { data: ps } = await supabase
        .from('parameter_sets')
        .select('id,resin_name,cure_time,bottom_cure_time,bottom_layers,layer_height,lift_speed,retract_speed,anti_aliasing,notes')
        .eq('brand_slug', brand.slug)
        .eq('model_slug', model.slug)
        .eq('active', true)
        .order('resin_name');
      const list = (ps || []) as ParamRow[];
      const names = list.map((p) => p.resin_name).filter(Boolean);
      let resinMap: Record<string, any> = {};
      if (names.length) {
        const { data: rs } = await supabase
          .from('resins')
          .select('name,image_url,fda_510k,anvisa_registration,slug')
          .in('name', names)
          .eq('active', true);
        (rs || []).forEach((r: any) => { resinMap[r.name] = r; });
      }
      if (!cancel) {
        setParams(list.map((p) => ({ ...p, resin: resinMap[p.resin_name] || null })));
        setLoadingParams(false);
      }
    })();
    return () => { cancel = true; };
  }, [brand, model]);

  const brandChips: KbChipOption[] = useMemo(
    () => brands.map((b) => ({ key: b.id, label: b.name })),
    [brands]
  );

  return (
    <section>
      {/* Título removido: hero do shell v2 é a única fonte do título nesta aba */}
      <p className="kb-label">{t('kb.parametros.select_brand')}</p>
      <KbChips
        options={brandChips}
        active={brand?.id || ''}
        onChange={(k) => setBrand(brands.find((b) => b.id === k) || null)}
      />

      {brand && (
        <div className="kb-param-grid">
          {/* Sidebar */}
          <aside className="kb-side">
            <div className="kb-side-h">{t('kb.parametros.brand_models', { brand: brand.name })}</div>
            {loadingModels ? (
              <div className="kb-side-empty">{t('kb.parametros.loading')}</div>
            ) : models.length === 0 ? (
              <div className="kb-side-empty">{t('kb.parametros.no_models')}</div>
            ) : (
              models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`kb-model-item${model?.id === m.id ? ' on' : ''}`}
                  onClick={() => setModel(m)}
                >
                  {m.image_url ? (
                    <img src={m.image_url} alt={m.name} className="kb-model-thumb" />
                  ) : (
                    <div className="kb-model-thumb kb-model-thumb-fallback">🖨️</div>
                  )}
                  <div className="kb-model-meta">
                    <div className="kb-model-name">{m.name}</div>
                    <div className="kb-model-count">{t((m.resinCount || 0) === 1 ? 'kb.parametros.resin_count_one' : 'kb.parametros.resin_count_other', { count: m.resinCount || 0 })}</div>
                  </div>
                </button>
              ))
            )}
          </aside>

          {/* Área */}
          <div className="kb-param-area" ref={paramAreaRef}>
            {!model ? (
              <div className="kb-param-empty">
                <div className="kb-param-empty-icon">🖨️</div>
                <div className="kb-param-empty-t">{t('kb.parametros.select_model')}</div>
                <div className="kb-param-empty-s">{t('kb.parametros.select_model_desc')}</div>
              </div>
            ) : (
              <>
                <header className="kb-param-h">
                  {model.image_url ? (
                    <img src={model.image_url} alt={model.name} className="kb-param-h-img" />
                  ) : (
                    <div className="kb-param-h-img kb-param-h-img-fallback">🖨️</div>
                  )}
                  <div>
                    <div className="kb-param-h-name">{model.name}</div>
                    <div className="kb-param-h-sub">
                      {brand.name} · {t(params.length === 1 ? 'kb.parametros.parametrized_one' : 'kb.parametros.parametrized_other', { count: params.length })}
                    </div>
                  </div>
                </header>

                {loadingParams ? (
                  <div className="kb-param-empty">{t('kb.parametros.loading')}</div>
                ) : params.length === 0 ? (
                  <div className="kb-param-empty">{t('kb.parametros.no_params')}</div>
                ) : (
                  <div className="kb-rgrid">
                    {params.map((p, i) => (
                      <ResinCard
                        key={p.id}
                        p={p}
                        index={i}
                        t={t}
                        onOpenSheet={() => setSheet({ name: p.resin_name, modelSlug: model.slug })}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <KbResinSheetDialog
        open={!!sheet}
        onClose={() => setSheet(null)}
        resinName={sheet?.name || null}
        modelSlug={sheet?.modelSlug || null}
      />
    </section>
  );
}

function ResinCard({ p, index, t, onOpenSheet }: { p: ParamRow; index: number; t: (k: string, params?: any) => string; onOpenSheet: () => void }) {
  const r = p.resin;
  return (
    <article className="kb-rcard" style={{ animationDelay: `${index * 18}ms` }}>
      <div className="kb-rcard-top">
        {r?.image_url ? (
          <img src={r.image_url} alt={p.resin_name} className="kb-rcard-img" />
        ) : (
          <div className="kb-rcard-img kb-rcard-img-fallback">💉</div>
        )}
        <div className="kb-rcard-meta">
          <div className="kb-rcard-name">{p.resin_name}</div>
          <div className="kb-rcard-badges">
            {r?.fda_510k && (
              <span className="kb-cert-badge" style={{ background: 'rgba(26,115,232,0.10)', color: '#1A73E8' }}>FDA {r.fda_510k}</span>
            )}
            {r?.anvisa_registration && (
              <span className="kb-cert-badge" style={{ background: 'rgba(52,168,83,0.10)', color: '#34A853' }}>ANVISA</span>
            )}
          </div>
        </div>
      </div>
      <div className="kb-rparams">
        <ParamItem label={t('kb.parametros.exposure')} value={p.cure_time} unit="s" />
        <ParamItem label={t('kb.parametros.bottom')} value={p.bottom_cure_time} unit="s" />
        <ParamItem label={t('kb.parametros.layers')} value={p.bottom_layers} unit="un" />
        <ParamItem label={t('kb.parametros.thickness')} value={p.layer_height} unit="mm" />
        <ParamItem label={t('kb.parametros.lift_speed')} value={p.lift_speed} unit="mm/s" />
        <ParamItem label={t('kb.parametros.retract_speed')} value={p.retract_speed} unit="mm/s" />
      </div>
      <div className="kb-rfoot">
        {p.anti_aliasing && (
          <span
            className="kb-aa-badge"
            style={{ background: 'rgba(52,168,83,0.10)', color: '#34A853' }}
          >
            ✓ Anti-aliasing
          </span>
        )}
        <button type="button" className="kb-action-btn" onClick={onOpenSheet}>
          {t('kb.parametros.view_sheet')}
        </button>
      </div>
      {p.notes && p.notes.trim() && (
        <div className="kb-rnotes">📝 {p.notes}</div>
      )}
    </article>
  );
}

function ParamItem({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="kb-pitem">
      <div className="kb-pitem-l">{label}</div>
      <div className="kb-pitem-v">
        {value ?? '—'}
        <span className="kb-pitem-u">{unit}</span>
      </div>
    </div>
  );
}