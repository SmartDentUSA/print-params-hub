import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';

interface CategoryItem {
  name: string;
  count: number;
}

interface ProductItem {
  id: string;
  name: string;
  image_url: string | null;
  product_subcategory: string | null;
  source: 'catalog' | 'resin';
}

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^resina\s*(3d\s*)?/i, '')
    .replace(/^smart\s*(3d\s*)?print\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ProductsFlowProps {
  step: 'category' | 'products';
  onStepChange: (step: 'category' | 'products' | null) => void;
  onProductSelect: (productName: string) => void;
}

export default function ProductsFlow({ step, onStepChange, onProductSelect }: ProductsFlowProps) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch categories from system_a_catalog
  useEffect(() => {
    if (step === 'category') {
      setLoading(true);
      supabase
        .from('system_a_catalog')
        .select('name, product_category')
        .eq('active', true)
        .eq('approved', true)
        .not('product_category', 'is', null)
        .then(({ data }) => {
          if (!data) { setLoading(false); return; }

          // Count unique names per category
          const namesByCat = new Map<string, Set<string>>();
          data.forEach((row: { name: string; product_category: string | null }) => {
            const cat = row.product_category;
            if (!cat) return;
            if (!namesByCat.has(cat)) namesByCat.set(cat, new Set());
            namesByCat.get(cat)!.add(row.name.toLowerCase());
          });

          const countMap = new Map<string, number>();
          namesByCat.forEach((names, cat) => countMap.set(cat, names.size));

          // Also count unique resins for "RESINAS 3D" (deduped against catalog)
          supabase
            .from('resins')
            .select('id, name')
            .eq('active', true)
            .then(({ data: resinsData }) => {
              if (resinsData) {
                const catalogNormalized = new Set(
                  (namesByCat.get('RESINAS 3D') || new Set<string>())
                );
                const catalogNormalizedNames = new Set<string>();
                catalogNormalized.forEach(n => catalogNormalizedNames.add(normalizeProductName(n)));

                let extra = 0;
                resinsData.forEach((r: { name: string }) => {
                  if (!catalogNormalizedNames.has(normalizeProductName(r.name))) {
                    extra++;
                  }
                });
                const existing = countMap.get('RESINAS 3D') || 0;
                countMap.set('RESINAS 3D', existing + extra);
              }

              const cats = Array.from(countMap.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => a.name.localeCompare(b.name));
              setCategories(cats);
              setLoading(false);
            });
        });
    }
  }, [step]);

  const handleSelectCategory = useCallback(async (categoryName: string) => {
    setSelectedCategory(categoryName);
    setLoading(true);
    onStepChange('products');

    const items: ProductItem[] = [];

    // Fetch catalog products for this category
    const { data: catalogData } = await supabase
      .from('system_a_catalog')
      .select('id, name, image_url, product_subcategory')
      .eq('active', true)
      .eq('approved', true)
      .eq('product_category', categoryName)
      .order('name');

    if (catalogData) {
      const seen = new Set<string>();
      catalogData.forEach((p: { id: string; name: string; image_url: string | null; product_subcategory: string | null }) => {
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

    // If category is RESINAS 3D, also fetch from resins table
    if (categoryName === 'RESINAS 3D') {
      const { data: resinsData } = await supabase
        .from('resins')
        .select('id, name, image_url, type')
        .eq('active', true)
        .order('name');

      if (resinsData) {
        const normalizedExisting = items.map(i => normalizeProductName(i.name));
        resinsData.forEach((r: { id: string; name: string; image_url: string | null; type: string | null }) => {
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
  }, [onStepChange]);

  const handleBack = useCallback(() => {
    if (step === 'products') {
      onStepChange('category');
      setSelectedCategory(null);
      setProducts([]);
    } else {
      onStepChange(null);
    }
  }, [step, onStepChange]);

  const CATEGORY_EMOJIS: Record<string, string> = {
    'RESINAS 3D': '🧪',
    'IMPRESSÃO 3D': '🖨️',
    'IMPRESSAO 3D': '🖨️',
    'SCANNERS 3D': '📷',
    'PÓS-IMPRESSÃO': '⚙️',
    'POS-IMPRESSAO': '⚙️',
    'CARACTERIZAÇÃO': '🎨',
    'CARACTERIZACAO': '🎨',
    'DENTÍSTICA': '🦷',
    'DENTISTICA': '🦷',
    'SOFTWARES': '💻',
    'SOLUÇÕES': '🏥',
    'SOLUCOES': '🏥',
  };

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

  // === STEP: CATEGORY ===
  if (step === 'category') {
    return (
      <div className="mt-3 space-y-3">
        <div className="px-3 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#1e3a5f' }}>
          Em relação a qual categoria de produto você precisa de ajuda?
        </div>
        <div className="grid grid-cols-2 gap-2">
          {categories.map(cat => (
            <button
              key={cat.name}
              onClick={() => handleSelectCategory(cat.name)}
              className="flex flex-col items-start p-3 rounded-xl border border-gray-200 bg-white hover:border-[#1e3a5f] hover:bg-blue-50 transition-all text-left shadow-sm"
            >
              <span className="text-lg mb-1">{CATEGORY_EMOJIS[cat.name] || '📦'}</span>
              <span className="text-xs font-semibold text-gray-800 leading-tight">{cat.name}</span>
              <span className="text-[10px] text-gray-400 mt-0.5">{cat.count} produto{cat.count !== 1 ? 's' : ''}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // === STEP: PRODUCTS ===
  if (step === 'products') {
    return (
      <div className="mt-3 space-y-3">
        <div className="px-3 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#1e3a5f' }}>
          Selecione o produto que deseja conhecer
        </div>
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#1e3a5f] transition-colors"
        >
          <ArrowLeft size={12} /> Voltar para categorias
        </button>
        <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          {selectedCategory} — {products.length} produto{products.length !== 1 ? 's' : ''}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {products.map(product => (
            <button
              key={`${product.source}-${product.id}`}
              onClick={() => onProductSelect(product.name)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200 bg-white hover:border-[#1e3a5f] hover:bg-blue-50 transition-all text-center shadow-sm"
            >
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
          ))}
        </div>
        {products.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Nenhum produto encontrado nesta categoria.</p>
        )}
      </div>
    );
  }

  return null;
}
