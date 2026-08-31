import { useState, useMemo, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface GenericOption {
  id: string;
  name: string;
  subtitle?: string;
}

interface SearchableProductSelectProps {
  value: string; // "none" | "product:<id>" | "resin:<id>" | "event:<id>" | "distributor:<id>"
  onValueChange: (value: string) => void;
  products: ProductOption[];
  resins: ResinOption[];
  events?: GenericOption[];
  distributors?: GenericOption[];
  className?: string;
}

export function SearchableProductSelect({
  value,
  onValueChange,
  products,
  resins,
  events = [],
  distributors = [],
  className,
}: SearchableProductSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedLabel = useMemo(() => {
    if (!value || value === 'none') return null;
    const [kind, id] = [value.split(':')[0], value.slice(value.indexOf(':') + 1)];
    if (kind === 'product') {
      const p = products.find(p => p.id === id);
      return p ? `🛒 ${p.name}` : 'Produto';
    }
    if (kind === 'resin') {
      const r = resins.find(r => r.id === id);
      return r ? `🧪 ${r.manufacturer} - ${r.name}` : 'Resina';
    }
    if (kind === 'event') {
      const e = events.find(e => e.id === id);
      return e ? `📅 ${e.name}` : 'Evento';
    }
    if (kind === 'distributor') {
      const d = distributors.find(d => d.id === id);
      return d ? `🤝 ${d.name}` : 'Distribuidor';
    }
    return null;
  }, [value, products, resins, events, distributors]);

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

  const filteredEvents = useMemo(() =>
    events.filter(e =>
      e.name.toLowerCase().includes(lowerSearch) ||
      (e.subtitle || '').toLowerCase().includes(lowerSearch)
    ), [events, lowerSearch]);

  const filteredDistributors = useMemo(() =>
    distributors.filter(d =>
      d.name.toLowerCase().includes(lowerSearch) ||
      (d.subtitle || '').toLowerCase().includes(lowerSearch)
    ), [distributors, lowerSearch]);

  const handleSelect = (val: string) => {
    onValueChange(val);
    setOpen(false);
    setSearch('');
  };

  const renderGroup = (
    label: string,
    items: GenericOption[],
    prefix: string,
    renderName: (item: GenericOption) => string,
  ) => {
    if (items.length === 0) return null;
    return (
      <>
        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label} ({items.length})
        </div>
        {items.map(item => {
          const val = `${prefix}:${item.id}`;
          return (
            <button
              key={item.id}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent cursor-pointer',
                value === val && 'bg-accent'
              )}
              onClick={() => handleSelect(val)}
            >
              <Check className={cn('h-3 w-3', value === val ? 'opacity-100' : 'opacity-0')} />
              <span className="truncate">{renderName(item)}</span>
            </button>
          );
        })}
      </>
    );
  };

  const noResults =
    filteredResins.length === 0 &&
    filteredProducts.length === 0 &&
    filteredEvents.length === 0 &&
    filteredDistributors.length === 0;

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
      <PopoverContent
        className="w-[280px] p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Buscar produto, evento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
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
        <div
          className="h-[300px] overflow-y-auto overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
        >
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

            {renderGroup(
              'Resinas',
              filteredResins as any,
              'resin',
              (r: any) => `${r.manufacturer} - ${r.name}`,
            )}

            {renderGroup('Produtos', filteredProducts, 'product', (p) => p.name)}

            {renderGroup(
              'Eventos',
              filteredEvents,
              'event',
              (e) => (e.subtitle ? `${e.name} · ${e.subtitle}` : e.name),
            )}

            {renderGroup(
              'Distribuidores',
              filteredDistributors,
              'distributor',
              (d) => (d.subtitle ? `${d.name} · ${d.subtitle}` : d.name),
            )}

            {noResults && (
              <div className="text-center py-4 text-xs text-muted-foreground">
                Nenhum resultado encontrado
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
