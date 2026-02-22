import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Check } from 'lucide-react';

export type CommercialStep = 'qualify' | 'scan' | 'cad' | 'print' | 'make' | 'summary';

interface ProductItem {
  id: string;
  name: string;
  image_url: string | null;
  product_subcategory: string | null;
  source: 'catalog' | 'resin';
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
        .select('id, name, image_url, product_subcategory, product_category')
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
            items.push({
              id: p.id,
              name: p.name,
              image_url: p.image_url,
              product_subcategory: p.product_subcategory,
              source: 'catalog',
            });
          }
        });
      }

      // For make step, also fetch resins
      if (step === 'make') {
        const { data: resinsData } = await supabase
          .from('resins')
          .select('id, name, image_url, type')
          .eq('active', true)
          .order('name');

        if (resinsData) {
          const normalizedExisting = items.map((i) => normalizeProductName(i.name));
          resinsData.forEach((r) => {
            if (!normalizedExisting.includes(normalizeProductName(r.name))) {
              items.push({
                id: r.id,
                name: r.name,
                image_url: r.image_url,
                product_subcategory: r.type === 'biocompatible' ? 'Biocompatível' : 'Uso Geral',
                source: 'resin',
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

      <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
        {products.map((product) => {
          const isSelected = isMake && selectedMake.has(product.name);
          return (
            <button
              key={`${product.source}-${product.id}`}
              onClick={() => {
                if (isMake) {
                  handleToggleMake(product.name);
                } else {
                  onProductSelect(product.name);
                }
              }}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border bg-white transition-all text-center shadow-sm ${
                isSelected
                  ? 'border-[#1e3a5f] bg-blue-50 ring-1 ring-[#1e3a5f]'
                  : 'border-gray-200 hover:border-[#1e3a5f] hover:bg-blue-50'
              }`}
            >
              {isMake && (
                <div className={`self-end w-4 h-4 rounded border flex items-center justify-center text-white ${
                  isSelected ? 'bg-[#1e3a5f] border-[#1e3a5f]' : 'border-gray-300'
                }`}>
                  {isSelected && <Check size={12} />}
                </div>
              )}
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-12 h-12 object-contain rounded-lg"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-lg">📦</div>
              )}
              <span className="text-[11px] font-medium text-gray-800 leading-tight line-clamp-2">{product.name}</span>
              {product.product_subcategory && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-[#1e3a5f] font-medium">
                  {product.product_subcategory}
                </span>
              )}
            </button>
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
