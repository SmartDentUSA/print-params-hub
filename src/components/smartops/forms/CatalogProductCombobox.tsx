import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { CatalogProductOption } from "@/lib/catalogProductOptions";

interface Props {
  value: string | null;
  options: CatalogProductOption[];
  onChange: (id: string | null, name: string | null) => void;
  placeholder?: string;
  loading?: boolean;
}

/** Seletor de produto do catálogo comercial com busca por nome ou categoria. */
export function CatalogProductCombobox({ value, options, onChange, placeholder = "Selecione o produto...", loading }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? options.find((o) => o.id === value) : undefined;
  const catalog = options.filter((o) => !o.outsideCatalog);
  const outside = options.filter((o) => o.outsideCatalog);

  const pick = (id: string | null) => {
    const opt = id ? options.find((o) => o.id === id) : undefined;
    onChange(id, opt?.name ?? null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {loading ? "Carregando produtos…" : selected ? selected.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar produto (ex.: Elegoo, scanner, resina)…" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__ nenhum" onSelect={() => pick(null)}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                — Nenhum —
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Produtos do catálogo">
              {catalog.map((o) => (
                <CommandItem key={o.id} value={`${o.name} ${o.productCategory ?? ""} ${o.id}`} onSelect={() => pick(o.id)}>
                  <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.productCategory && <span className="ml-2 truncate text-[11px] text-muted-foreground">{o.productCategory}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
            {outside.length > 0 && (
              <CommandGroup heading="Vínculo atual fora do catálogo de produtos">
                {outside.map((o) => (
                  <CommandItem key={o.id} value={`${o.name} ${o.id}`} onSelect={() => pick(o.id)}>
                    <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{o.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
