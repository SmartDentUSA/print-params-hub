import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Check } from 'lucide-react';

export type CommercialStep = 'qualify' | 'scan' | 'cad' | 'print' | 'make' | 'summary';

interface ProductCTA {
  label: string;
  url: string;
}

interface ProductItem {
  id: string;
  name: string;
  image_url: string | null;
  description: string | null;
  product_subcategory: string | null;
  source: 'catalog' | 'resin';
  ctas: ProductCTA[];
}

interface CommercialFlowProps {
  step: CommercialStep;
  isFullWorkflow: boolean;
  onStepSelect: (step: CommercialStep, fullWorkflow: boolean) => void;
  onProductSelect: (productName: string) => void;
  onMultiSelect: (productNames: string[]) => void;
}

const STEP_CATEGORIES: Record<string, string[]> = {
  scan: ['SCANNERS 3D'],
  cad: ['SOFTWARES'],
  print: ['IMPRESSAO 3D', 'IMPRESSÃO 3D'],
  make: ['RESINAS 3D', 'PÓS-IMPRESSÃO', 'POS-IMPRESSAO', 'CARACTERIZAÇÃO', 'CARACTERIZACAO'],
};

const STEP_LABELS: Record<string, string> = {
  scan: 'Scanners 3D',
  cad: 'Softwares CAD',
  print: 'Impressoras 3D',
  make: 'Resinas & Materiais',
};

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^resina\s*(3d\s*)?/i, '')
    .replace(/^smart\s*(3d\s*)?print\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function CommercialFlow({
  step,
  isFullWorkflow,
  onStepSelect,
  onProductSelect,
  onMultiSelect,
}: CommercialFlowProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMake, setSelectedMake] = useState<Set<string>>(new Set());

  // Fetch products when entering a category step
  useEffect(() => {
    if (step === 'qualify' || step === 'summary') return;

    const categories = STEP_CATEGORIES[step];
    if (!categories) return;

    setLoading(true);
    setSelectedMake(new Set());

    (async () => {
      const items: ProductItem[] = [];

      const { data: catalogData } = await supabase
        .from('system_a_catalog')
        .select('id, name, image_url, description, product_subcategory, product_category, cta_1_label, cta_1_url, cta_2_label, cta_2_url, cta_3_label, cta_3_url')
        .eq('active', true)
        .eq('approved', true)
        .in('product_category', categories)
        .order('name');

      if (catalogData) {
        const seen = new Set<string>();
        catalogData.forEach((p) => {
          const key = p.name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            const ctas: ProductCTA[] = [];
            if (p.cta_1_url && p.cta_1_label) ctas.push({ label: p.cta_1_label, url: p.cta_1_url });
            if (p.cta_2_url && p.cta_2_label) ctas.push({ label: p.cta_2_label, url: p.cta_2_url });
            if (p.cta_3_url && p.cta_3_label) ctas.push({ label: p.cta_3_label, url: p.cta_3_url });
            items.push({
              id: p.id,
              name: p.name,
              image_url: p.image_url,
              description: p.description,
              product_subcategory: p.product_subcategory,
              source: 'catalog',
              ctas,
            });
          }
        });
      }

      // For make step, also fetch resins
      if (step === 'make') {
        const { data: resinsData } = await supabase
          .from('resins')
          .select('id, name, image_url, description, type, cta_1_label, cta_1_url, cta_1_enabled, cta_2_label, cta_2_url, cta_3_label, cta_3_url')
          .eq('active', true)
          .order('name');

        if (resinsData) {
          const normalizedExisting = items.map((i) => normalizeProductName(i.name));
          resinsData.forEach((r) => {
            if (!normalizedExisting.includes(normalizeProductName(r.name))) {
              const ctas: ProductCTA[] = [];
              if (r.cta_1_enabled && r.cta_1_url && r.cta_1_label) ctas.push({ label: r.cta_1_label, url: r.cta_1_url });
              if (r.cta_2_url && r.cta_2_label) ctas.push({ label: r.cta_2_label, url: r.cta_2_url });
              if (r.cta_3_url && r.cta_3_label) ctas.push({ label: r.cta_3_label, url: r.cta_3_url });
              items.push({
                id: r.id,
                name: r.name,
                image_url: r.image_url,
                description: r.description,
                product_subcategory: r.type === 'biocompatible' ? 'Biocompatível' : 'Uso Geral',
                source: 'resin',
                ctas,
              });
            }
          });
        }
      }

      setProducts(items);
      setLoading(false);
    })();
  }, [step]);

  const handleToggleMake = useCallback((name: string) => {
    setSelectedMake((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleConfirmMake = useCallback(() => {
    if (selectedMake.size > 0) {
      onMultiSelect(Array.from(selectedMake));
    }
  }, [selectedMake, onMultiSelect]);

  // Loading state
  if (loading) {
    return (
      <div className="mt-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-[#1e3a5f] rounded-full animate-spin" />
          Carregando produtos...
        </div>
      </div>
    );
  }

  // === STEP: QUALIFY (buttons) ===
  if (step === 'qualify') {
    return (
      <div className="mt-3 space-y-3">
        <div className="px-3 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#1e3a5f' }}>
          Em qual etapa do fluxo digital você quer começar?
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'scan' as CommercialStep, emoji: '📷', label: 'Scan' },
            { id: 'cad' as CommercialStep, emoji: '💻', label: 'CAD' },
            { id: 'print' as CommercialStep, emoji: '🖨️', label: 'Print' },
            { id: 'make' as CommercialStep, emoji: '🧪', label: 'Make' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => onStepSelect(btn.id, false)}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-200 bg-white hover:border-[#1e3a5f] hover:bg-blue-50 transition-all shadow-sm gap-1"
            >
              <span className="text-xl">{btn.emoji}</span>
              <span className="text-xs font-semibold text-gray-800">{btn.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => onStepSelect('scan', true)}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 bg-white hover:border-[#1e3a5f] hover:bg-blue-50 transition-all shadow-sm"
        >
          <span className="text-base">🔄</span>
          <span className="text-xs font-semibold text-gray-800">Workflow Completo</span>
        </button>
      </div>
    );
  }

  // === STEP: SUMMARY ===
  if (step === 'summary') {
    return null; // Summary is handled by the AI response
  }

  // === CATEGORY STEPS (scan, cad, print, make) ===
  const isMake = step === 'make';

  return (
    <div className="mt-3 space-y-3">
      <div className="px-3 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#1e3a5f' }}>
        {isMake ? 'Selecione os materiais que deseja (múltipla escolha)' : `Selecione o ${STEP_LABELS[step] || 'produto'} que deseja conhecer`}
      </div>

      {isFullWorkflow && (
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium uppercase tracking-wide">
          {['scan', 'cad', 'print', 'make'].map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className="text-gray-300">→</span>}
              <span className={s === step ? 'text-[#1e3a5f] font-bold' : ''}>{s.toUpperCase()}</span>
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="text-xs text-gray-400 font-medium">
        {STEP_LABELS[step]} — {products.length} opç{products.length !== 1 ? 'ões' : 'ão'}
      </div>

      <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto">
        {products.map((product) => {
          const isSelected = isMake && selectedMake.has(product.name);
          const truncatedDesc = product.description
            ? product.description.length > 120
              ? product.description.slice(0, 120) + '…'
              : product.description
            : null;
          return (
            <div
              key={`${product.source}-${product.id}`}
              className={`flex gap-3 p-3 rounded-xl border bg-white transition-all shadow-sm ${
                isSelected
                  ? 'border-[#1e3a5f] bg-blue-50 ring-1 ring-[#1e3a5f]'
                  : 'border-gray-200 hover:border-[#1e3a5f] hover:bg-blue-50'
              }`}
            >
              {/* Image */}
              <button
                onClick={() => isMake ? handleToggleMake(product.name) : onProductSelect(product.name)}
                className="flex-shrink-0 flex flex-col items-center gap-1"
              >
                {isMake && (
                  <div className={`w-4 h-4 rounded border flex items-center justify-center text-white ${
                    isSelected ? 'bg-[#1e3a5f] border-[#1e3a5f]' : 'border-gray-300'
                  }`}>
                    {isSelected && <Check size={12} />}
                  </div>
                )}
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-14 h-14 object-contain rounded-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-lg">📦</div>
                )}
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0 text-left">
                <button
                  onClick={() => isMake ? handleToggleMake(product.name) : onProductSelect(product.name)}
                  className="text-left w-full"
                >
                  <span className="text-xs font-semibold text-gray-800 leading-tight block">{product.name}</span>
                  {product.product_subcategory && (
                    <span className="text-[9px] inline-block mt-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 text-[#1e3a5f] font-medium">
                      {product.product_subcategory}
                    </span>
                  )}
                  {truncatedDesc && (
                    <p className="text-[10px] text-gray-500 mt-1 leading-snug">{truncatedDesc}</p>
                  )}
                </button>

                {/* CTAs */}
                {product.ctas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {product.ctas.map((cta, i) => (
                      <a
                        key={i}
                        href={cta.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[9px] px-2 py-0.5 rounded-full border border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white transition-colors font-medium"
                      >
                        {cta.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isMake && selectedMake.size > 0 && (
        <button
          onClick={handleConfirmMake}
          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: '#1e3a5f' }}
        >
          Confirmar seleção ({selectedMake.size} {selectedMake.size === 1 ? 'item' : 'itens'})
        </button>
      )}

      {products.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">Nenhum produto encontrado nesta categoria.</p>
      )}
    </div>
  );
}
