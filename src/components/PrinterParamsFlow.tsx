import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';

interface BrandItem {
  name: string;
  slug: string;
  logo_url?: string;
}

interface ModelItem {
  name: string;
  slug: string;
  image_url?: string;
}

interface ResinCTA {
  label: string;
  url: string;
}

interface ParamSet {
  id: string;
  resin_name: string;
  resin_manufacturer: string;
  resin_image?: string;
  layer_height: number;
  cure_time: number;
  bottom_cure_time?: number;
  bottom_layers?: number;
  light_intensity: number;
  xy_adjustment_x_pct?: number;
  xy_adjustment_y_pct?: number;
  wait_time_before_cure?: number;
  wait_time_after_cure?: number;
  wait_time_after_lift?: number;
}

interface ResinGroup {
  resinKey: string;
  resinName: string;
  resinManufacturer: string;
  resinImage?: string;
  resinDescription?: string;
  resinProcessingInstructions?: string;
  resinCTAs: ResinCTA[];
  params: ParamSet[];
}

interface PrinterParamsFlowProps {
  step: 'brand' | 'model' | 'resin';
  onStepChange: (step: 'brand' | 'model' | 'resin' | null) => void;
}

function ResinAccordionSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-2 border-t border-gray-200">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center justify-between w-full text-[10px] font-semibold text-gray-600 hover:text-gray-800 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-1.5">{children}</div>}
    </div>
  );
}

export default function PrinterParamsFlow({ step, onStepChange }: PrinterParamsFlowProps) {
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [resinGroups, setResinGroups] = useState<ResinGroup[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<BrandItem | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelItem | null>(null);
  const [expandedResin, setExpandedResin] = useState<string | null>(null);
  const [selectedLayerHeight, setSelectedLayerHeight] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Fetch brands
  useEffect(() => {
    if (step === 'brand') {
      setLoading(true);
      supabase
        .from('brands')
        .select('name, slug, logo_url')
        .eq('active', true)
        .order('name')
        .then(({ data }) => {
          // Filter brands that have active parameter_sets
          if (data) {
            supabase
              .from('parameter_sets')
              .select('brand_slug')
              .eq('active', true)
              .then(({ data: psData }) => {
                const activeSlugs = new Set((psData || []).map(p => p.brand_slug));
                setBrands(data.filter(b => activeSlugs.has(b.slug)));
                setLoading(false);
              });
          } else {
            setLoading(false);
          }
        });
    }
  }, [step]);

  const handleSelectBrand = useCallback(async (brand: BrandItem) => {
    setSelectedBrand(brand);
    setLoading(true);
    onStepChange('model');

    // Fetch models for this brand that have parameter_sets
    const { data: psData } = await supabase
      .from('parameter_sets')
      .select('model_slug')
      .eq('brand_slug', brand.slug)
      .eq('active', true);

    const modelSlugs = [...new Set((psData || []).map(p => p.model_slug))];

    if (modelSlugs.length > 0) {
      const { data: modelsData } = await supabase
        .from('models')
        .select('name, slug, image_url')
        .eq('active', true)
        .in('slug', modelSlugs)
        .order('name');
      setModels(modelsData || []);
    } else {
      setModels([]);
    }
    setLoading(false);
  }, [onStepChange]);

  const handleSelectModel = useCallback(async (model: ModelItem) => {
    setSelectedModel(model);
    setLoading(true);
    onStepChange('resin');

    // Fetch parameter_sets for this brand+model
    const { data: psData } = await supabase
      .from('parameter_sets')
      .select('*')
      .eq('brand_slug', selectedBrand!.slug)
      .eq('model_slug', model.slug)
      .eq('active', true)
      .order('resin_name')
      .order('layer_height');

    if (psData && psData.length > 0) {
      // Get resin images
      const resinNames = [...new Set(psData.map(p => p.resin_name))];
      const { data: resinsData } = await supabase
        .from('resins')
        .select('name, image_url, description, processing_instructions, cta_1_enabled, cta_1_label, cta_1_url, cta_2_label, cta_2_url, cta_3_label, cta_3_url')
        .in('name', resinNames);

      const resinImageMap = new Map((resinsData || []).map(r => [r.name, r.image_url]));
      const resinDescMap = new Map((resinsData || []).map(r => [r.name, r.description]));
      const resinProcMap = new Map((resinsData || []).map(r => [r.name, r.processing_instructions]));
      const resinCTAMap = new Map<string, ResinCTA[]>();
      (resinsData || []).forEach(r => {
        const ctas: ResinCTA[] = [];
        if (r.cta_1_enabled && r.cta_1_url && r.cta_1_label) ctas.push({ label: r.cta_1_label, url: r.cta_1_url });
        if (r.cta_2_url && r.cta_2_label) ctas.push({ label: r.cta_2_label, url: r.cta_2_url });
        if (r.cta_3_url && r.cta_3_label) ctas.push({ label: r.cta_3_label, url: r.cta_3_url });
        resinCTAMap.set(r.name, ctas);
      });

      // Group by resin
      const groups = new Map<string, ResinGroup>();
      for (const ps of psData) {
        const key = `${ps.resin_name}__${ps.resin_manufacturer}`;
        if (!groups.has(key)) {
          groups.set(key, {
            resinKey: key,
            resinName: ps.resin_name,
            resinManufacturer: ps.resin_manufacturer,
            resinImage: resinImageMap.get(ps.resin_name) || undefined,
            resinDescription: resinDescMap.get(ps.resin_name) || undefined,
            resinProcessingInstructions: resinProcMap.get(ps.resin_name) || undefined,
            resinCTAs: resinCTAMap.get(ps.resin_name) || [],
            params: [],
          });
        }
        groups.get(key)!.params.push({
          id: ps.id,
          resin_name: ps.resin_name,
          resin_manufacturer: ps.resin_manufacturer,
          resin_image: resinImageMap.get(ps.resin_name) || undefined,
          layer_height: Number(ps.layer_height),
          cure_time: Number(ps.cure_time),
          bottom_cure_time: ps.bottom_cure_time != null ? Number(ps.bottom_cure_time) : undefined,
          bottom_layers: ps.bottom_layers ?? undefined,
          light_intensity: ps.light_intensity,
          xy_adjustment_x_pct: ps.xy_adjustment_x_pct ?? undefined,
          xy_adjustment_y_pct: ps.xy_adjustment_y_pct ?? undefined,
          wait_time_before_cure: ps.wait_time_before_cure != null ? Number(ps.wait_time_before_cure) : undefined,
          wait_time_after_cure: ps.wait_time_after_cure != null ? Number(ps.wait_time_after_cure) : undefined,
          wait_time_after_lift: ps.wait_time_after_lift != null ? Number(ps.wait_time_after_lift) : undefined,
        });
      }
      setResinGroups(Array.from(groups.values()));
    } else {
      setResinGroups([]);
    }
    setLoading(false);
  }, [selectedBrand, onStepChange]);

  const handleBack = useCallback(() => {
    if (step === 'resin') {
      onStepChange('model');
      setSelectedModel(null);
      setExpandedResin(null);
      setSelectedLayerHeight({});
    } else if (step === 'model') {
      onStepChange('brand');
      setSelectedBrand(null);
      setModels([]);
    } else {
      onStepChange(null);
    }
  }, [step, onStepChange]);

  const toggleResin = (resinKey: string) => {
    if (expandedResin === resinKey) {
      setExpandedResin(null);
    } else {
      setExpandedResin(resinKey);
      // Auto-select first layer height
      const group = resinGroups.find(g => g.resinKey === resinKey);
      if (group && group.params.length > 0 && !selectedLayerHeight[resinKey]) {
        setSelectedLayerHeight(prev => ({ ...prev, [resinKey]: group.params[0].layer_height }));
      }
    }
  };

  const getSelectedParam = (group: ResinGroup): ParamSet | undefined => {
    const lh = selectedLayerHeight[group.resinKey];
    return group.params.find(p => p.layer_height === lh) || group.params[0];
  };

  if (loading) {
    return (
      <div className="mt-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-[#1e3a5f] rounded-full animate-spin" />
          Carregando...
        </div>
      </div>
    );
  }

  // === STEP: BRAND ===
  if (step === 'brand') {
    return (
      <div className="mt-3 space-y-3">
        <div className="px-3 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#1e3a5f' }}>
          Claro! Para te ajudar com os parâmetros, qual é a marca da sua impressora?
        </div>
        <div className="grid grid-cols-2 gap-2">
          {brands.map(brand => (
            <button
              key={brand.slug}
              onClick={() => handleSelectBrand(brand)}
              className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 bg-white hover:border-[#1e3a5f] hover:bg-blue-50 transition-all text-left text-sm font-medium text-gray-800 shadow-sm"
            >
              {brand.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // === STEP: MODEL ===
  if (step === 'model') {
    return (
      <div className="mt-3 space-y-3">
        <div className="px-3 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#1e3a5f' }}>
          Selecione o modelo da sua impressora
        </div>
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#1e3a5f] transition-colors"
        >
          <ArrowLeft size={12} /> Voltar para marcas
        </button>
        <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          {selectedBrand?.name} — Modelos
        </div>
        <div className="grid grid-cols-2 gap-2">
          {models.map(model => (
            <button
              key={model.slug}
              onClick={() => handleSelectModel(model)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200 bg-white hover:border-[#1e3a5f] hover:bg-blue-50 transition-all text-center shadow-sm"
            >
              {model.image_url ? (
                <img
                  src={model.image_url}
                  alt={model.name}
                  className="w-12 h-12 object-contain rounded-lg"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-lg">🖨️</div>
              )}
              <span className="text-xs font-medium text-gray-800 leading-tight">{model.name}</span>
            </button>
          ))}
        </div>
        {models.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Nenhum modelo encontrado para esta marca.</p>
        )}
      </div>
    );
  }

  // === STEP: RESIN ===
  if (step === 'resin') {
    return (
      <div className="mt-3 space-y-3">
        <div className="px-3 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#1e3a5f' }}>
          Selecione a resina e a espessura das camadas
        </div>
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#1e3a5f] transition-colors"
        >
          <ArrowLeft size={12} /> Voltar para modelos
        </button>

        {/* Selected model info */}
        <div className="flex items-center gap-2 px-2">
          {selectedModel?.image_url && (
            <img src={selectedModel.image_url} alt={selectedModel.name} className="w-10 h-10 object-contain rounded" />
          )}
          <div>
            <div className="text-xs font-medium text-gray-800">{selectedBrand?.name} {selectedModel?.name}</div>
            <div className="text-[10px] text-gray-400">{resinGroups.length} resina(s) disponível(is)</div>
          </div>
        </div>

        {/* Resin list */}
        <div className="space-y-2">
          {resinGroups.map(group => {
            const isExpanded = expandedResin === group.resinKey;
            const selectedParam = getSelectedParam(group);

            return (
              <div
                key={group.resinKey}
                className={`rounded-xl border transition-all ${isExpanded ? 'border-[#1e3a5f] bg-blue-50/30' : 'border-gray-200 bg-white'} shadow-sm`}
              >
                {/* Resin header */}
                <button
                  onClick={() => toggleResin(group.resinKey)}
                  className="w-full flex items-center gap-2 p-3 text-left"
                >
                  {group.resinImage ? (
                    <img src={group.resinImage} alt={group.resinName} className="w-8 h-8 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm flex-shrink-0">🧪</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800 truncate">{group.resinName}</div>
                    <div className="text-[10px] text-gray-400">{group.resinManufacturer}</div>
                  </div>
                  {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </button>

                {/* Layer height pills + params */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3">
                    {/* Layer height pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {group.params.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedLayerHeight(prev => ({ ...prev, [group.resinKey]: p.layer_height }))}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                            selectedLayerHeight[group.resinKey] === p.layer_height
                              ? 'text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          style={
                            selectedLayerHeight[group.resinKey] === p.layer_height
                              ? { background: '#1e3a5f' }
                              : {}
                          }
                        >
                          {p.layer_height}mm
                        </button>
                      ))}
                    </div>

                    {/* Parameters table */}
                    {selectedParam && (
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        {/* Normal Layers */}
                        <div className="space-y-1.5">
                          <div className="font-semibold text-gray-700 text-xs border-b border-gray-200 pb-1">
                            Camadas Normais
                          </div>
                          <ParamRow label="Altura da Camada" value={`${selectedParam.layer_height}mm`} />
                          <ParamRow label="Tempo de Cura" value={`${selectedParam.cure_time}s`} />
                          {selectedParam.wait_time_before_cure != null && (
                            <ParamRow label="Espera antes cura" value={`${selectedParam.wait_time_before_cure}s`} />
                          )}
                          {selectedParam.wait_time_after_cure != null && (
                            <ParamRow label="Espera após cura" value={`${selectedParam.wait_time_after_cure}s`} />
                          )}
                          <ParamRow label="Intensidade Luz" value={`${selectedParam.light_intensity}%`} />
                          {(selectedParam.xy_adjustment_x_pct != null || selectedParam.xy_adjustment_y_pct != null) && (
                            <ParamRow
                              label="Ajuste X/Y"
                              value={`${selectedParam.xy_adjustment_x_pct ?? 100}% / ${selectedParam.xy_adjustment_y_pct ?? 100}%`}
                            />
                          )}
                        </div>

                        {/* Bottom Layers */}
                        <div className="space-y-1.5">
                          <div className="font-semibold text-gray-700 text-xs border-b border-gray-200 pb-1">
                            Camadas Inferiores
                          </div>
                          {selectedParam.bottom_cure_time != null && (
                            <ParamRow label="Tempo de Adesão" value={`${selectedParam.bottom_cure_time}s`} />
                          )}
                          {selectedParam.bottom_layers != null && (
                            <ParamRow label="Camadas base" value={`${selectedParam.bottom_layers}`} />
                          )}
                          {selectedParam.wait_time_before_cure != null && (
                            <ParamRow label="Espera antes cura" value={`${selectedParam.wait_time_before_cure}s`} />
                          )}
                          {selectedParam.wait_time_after_cure != null && (
                            <ParamRow label="Espera após cura" value={`${selectedParam.wait_time_after_cure}s`} />
                          )}
                          {selectedParam.wait_time_after_lift != null && (
                            <ParamRow label="Espera após elevação" value={`${selectedParam.wait_time_after_lift}s`} />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {/* Description - Accordion */}
                    {group.resinDescription && (
                      <ResinAccordionSection title="Descrição do produto">
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                          {group.resinDescription}
                        </p>
                      </ResinAccordionSection>
                    )}

                    {/* Processing Instructions - Accordion */}
                    {group.resinProcessingInstructions && (
                      <ResinAccordionSection title="Instruções de Pré/Pós Processamento">
                        <div className="text-[10px] text-gray-500 leading-relaxed space-y-1">
                          {group.resinProcessingInstructions.split('\n').filter(l => l.trim()).map((line, i) => {
                            const trimmed = line.trim();
                            if (trimmed.startsWith('##')) {
                              return <div key={i} className="font-semibold text-gray-600 mt-1">{trimmed.replace(/^#+\s*/, '')}</div>;
                            }
                            if (trimmed.startsWith('###')) {
                              return <div key={i} className="font-medium text-gray-600">{trimmed.replace(/^#+\s*/, '')}</div>;
                            }
                            if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                              return <div key={i} className="flex items-start gap-1"><span className="text-primary mt-0.5">•</span><span>{trimmed.replace(/^[-•]\s*/, '')}</span></div>;
                            }
                            if (trimmed.startsWith('> ')) {
                              return <div key={i} className="pl-1.5 border-l-2 border-amber-400 text-amber-700 text-[9px]">⚠️ {trimmed.replace(/^>\s*/, '')}</div>;
                            }
                            return <div key={i}>{trimmed}</div>;
                          })}
                        </div>
                      </ResinAccordionSection>
                    )}

                    {/* CTAs */}
                    {group.resinCTAs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-200">
                        {group.resinCTAs.map((cta, i) => (
                          <a
                            key={i}
                            href={cta.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white transition-colors font-medium"
                          >
                            {cta.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {resinGroups.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Nenhum parâmetro encontrado para este modelo.</p>
        )}
      </div>
    );
  }

  return null;
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
