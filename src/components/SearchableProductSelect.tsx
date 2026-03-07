import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProductOption {
  id: string;
  name: string;
  category?: string;
}

interface ResinOption {
  id: string;
  name: string;
  manufacturer: string;
}

interface SearchableProductSelectProps {
  value: string; // "none" | "product:<id>" | "resin:<id>"
  onValueChange: (value: string) => void;
  products: ProductOption[];
  resins: ResinOption[];
  className?: string;
}

export function SearchableProductSelect({
  value,
  onValueChange,
  products,
  resins,
  className,
}: SearchableProductSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedLabel = useMemo(() => {
    if (!value || value === 'none') return null;
    if (value.startsWith('product:')) {
      const id = value.replace('product:', '');
      const p = products.find(p => p.id === id);
      return p ? `🛒 ${p.name}` : 'Produto';
    }
    if (value.startsWith('resin:')) {
      const id = value.replace('resin:', '');
      const r = resins.find(r => r.id === id);
      return r ? `🧪 ${r.manufacturer} - ${r.name}` : 'Resina';
    }
    return null;
  }, [value, products, resins]);

  const lowerSearch = search.toLowerCase();

  const filteredResins = useMemo(() =>
    resins.filter(r =>
      r.name.toLowerCase().includes(lowerSearch) ||
      r.manufacturer.toLowerCase().includes(lowerSearch)
    ), [resins, lowerSearch]);

  const filteredProducts = useMemo(() =>
    products.filter(p =>
      p.name.toLowerCase().includes(lowerSearch)
    ), [products, lowerSearch]);

  const handleSelect = (val: string) => {
    onValueChange(val);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between text-xs h-8 font-normal', className)}
        >
          <span className="truncate max-w-[140px]">
            {selectedLabel || 'Selecionar...'}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar produto ou resina..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
            {search && (
              <X
                className="absolute right-2 top-2.5 h-3.5 w-3.5 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
              />
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[300px]">
          <div className="p-1">
            {/* Nenhum */}
            <button
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent cursor-pointer',
                value === 'none' && 'bg-accent'
              )}
              onClick={() => handleSelect('none')}
            >
              <Check className={cn('h-3 w-3', value === 'none' ? 'opacity-100' : 'opacity-0')} />
              <span className="text-muted-foreground">Nenhum</span>
            </button>

            {/* Resinas */}
            {filteredResins.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Resinas ({filteredResins.length})
                </div>
                {filteredResins.map(r => {
                  const val = `resin:${r.id}`;
                  return (
                    <button
                      key={r.id}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent cursor-pointer',
                        value === val && 'bg-accent'
                      )}
                      onClick={() => handleSelect(val)}
                    >
                      <Check className={cn('h-3 w-3', value === val ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{r.manufacturer} - {r.name}</span>
                    </button>
                  );
                })}
              </>
            )}

            {/* Produtos */}
            {filteredProducts.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Produtos ({filteredProducts.length})
                </div>
                {filteredProducts.map(p => {
                  const val = `product:${p.id}`;
                  return (
                    <button
                      key={p.id}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent cursor-pointer',
                        value === val && 'bg-accent'
                      )}
                      onClick={() => handleSelect(val)}
                    >
                      <Check className={cn('h-3 w-3', value === val ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </>
            )}

            {filteredResins.length === 0 && filteredProducts.length === 0 && (
              <div className="text-center py-4 text-xs text-muted-foreground">
                Nenhum resultado encontrado
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
