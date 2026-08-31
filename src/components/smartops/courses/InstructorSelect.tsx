import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  INSTRUCTOR_SOURCE_LABEL,
  useInstructorOptions,
  type InstructorSource,
} from "@/hooks/useInstructorOptions";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

const ORDER: InstructorSource[] = ["team", "kol", "author", "professional"];

export default function InstructorSelect({ value, onChange, placeholder = "Selecionar instrutor…" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useInstructorOptions();

  const groups = useMemo(() => {
    const map = new Map<InstructorSource, typeof data>();
    for (const o of data) {
      const arr = map.get(o.source) ?? [];
      arr.push(o);
      map.set(o.source, arr);
    }
    return ORDER.filter((s) => (map.get(s) ?? []).length > 0).map((s) => ({ source: s, items: map.get(s)! }));
  }, [data]);

  const typed = search.trim();
  const hasExact = data.some((o) => o.name.toLowerCase() === typed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin opacity-60" />
          ) : (
            <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]" align="start">
        <Command>
          <CommandInput placeholder="Buscar ou digitar nome…" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum instrutor encontrado.</CommandEmpty>
            {typed && !hasExact && (
              <CommandGroup heading="Personalizado">
                <CommandItem
                  value={`__custom__${typed}`}
                  onSelect={() => {
                    onChange(typed);
                    setOpen(false);
                  }}
                >
                  Usar “{typed}”
                </CommandItem>
              </CommandGroup>
            )}
            {groups.map((g) => (
              <CommandGroup key={g.source} heading={INSTRUCTOR_SOURCE_LABEL[g.source]}>
                {g.items.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={`${o.name} ${o.detail ?? ""}`}
                    onSelect={() => {
                      onChange(o.name);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === o.name ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{o.name}</span>
                    {o.detail ? (
                      <span className="ml-2 text-xs text-muted-foreground truncate">{o.detail}</span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
