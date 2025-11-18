import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface ProductCTAItem {
  id: string;
  name: string;
  manufacturer?: string;
  type: 'resin' | 'product';
}

interface ProductCTAMultiSelectProps {
  resins: string[];
  products: string[];
  onChange: (resins: string[], products: string[]) => void;
}

export function ProductCTAMultiSelect({ resins, products, onChange }: ProductCTAMultiSelectProps) {
  const [items, setItems] = useState<ProductCTAItem[]>([]);
  const [search, setSearch] = useState('');
  
  useEffect(() => {
    fetchItems();
  }, []);
  
  const fetchItems = async () => {
    try {
      // 1. Buscar resinas
      const { data: resinsData } = await supabase
        .from('resins')
        .select('id, name, manufacturer')
        .eq('active', true)
        .order('manufacturer')
        .order('name');
      
      // 2. Buscar produtos do catálogo
      const { data: productsData } = await supabase
        .from('system_a_catalog')
        .select('id, name')
        .eq('active', true)
        .eq('approved', true)
        .eq('category', 'product')
        .order('name');
      
      // 3. Combinar
      const resinItems: ProductCTAItem[] = resinsData?.map(r => ({
        id: r.id,
        name: r.name,
        manufacturer: r.manufacturer,
        type: 'resin' as const
      })) || [];
      
      const productItems: ProductCTAItem[] = productsData?.map(p => ({
        id: p.id,
        name: p.name,
        type: 'product' as const
      })) || [];
      
      setItems([...resinItems, ...productItems]);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };
  
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.manufacturer && item.manufacturer.toLowerCase().includes(search.toLowerCase()))
  );
  
  const toggleItem = (id: string, type: 'resin' | 'product') => {
    if (type === 'resin') {
      const newResins = resins.includes(id) 
        ? resins.filter(v => v !== id) 
        : [...resins, id];
      onChange(newResins, products);
    } else {
      const newProducts = products.includes(id)
        ? products.filter(v => v !== id)
        : [...products, id];
      onChange(resins, newProducts);
    }
  };
  
  const isSelected = (id: string, type: 'resin' | 'product') => {
    return type === 'resin' ? resins.includes(id) : products.includes(id);
  };
  
  const selectedItems = items.filter(item => isSelected(item.id, item.type));
  
  return (
    <div className="space-y-2">
      <Input 
        placeholder="🔍 Buscar resina ou produto..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      
      <div className="max-h-64 overflow-y-auto border border-border rounded p-2 space-y-1">
        {filteredItems.map(item => (
          <div 
            key={`${item.type}_${item.id}`}
            className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
            onClick={() => toggleItem(item.id, item.type)}
          >
            <Checkbox checked={isSelected(item.id, item.type)} />
            <div className="flex-1 flex items-center gap-2">
              <span className="text-sm">
                {item.name}
                {item.manufacturer && (
                  <span className="text-muted-foreground"> ({item.manufacturer})</span>
                )}
              </span>
              <Badge 
                variant={item.type === 'resin' ? 'secondary' : 'default'}
                className="text-[10px] px-1.5 py-0"
              >
                {item.type === 'resin' ? '🧪 Resina' : '🛒 Produto'}
              </Badge>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            Nenhum item encontrado
          </div>
        )}
      </div>
      
      {/* Selected chips */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedItems.map(item => (
            <span 
              key={`chip_${item.type}_${item.id}`}
              className="px-2 py-1 bg-primary/10 text-primary rounded text-sm flex items-center gap-1"
            >
              <span className="text-[10px]">
                {item.type === 'resin' ? '🧪' : '🛒'}
              </span>
              {item.name}
              <X 
                className="w-3 h-3 cursor-pointer hover:text-destructive" 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItem(item.id, item.type);
                }}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
