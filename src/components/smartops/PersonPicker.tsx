import { useMemo, useState } from "react";
import { ChevronsUpDown, Loader2, Users } from "lucide-react";
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
import {
  INSTRUCTOR_SOURCE_LABEL,
  useInstructorOptions,
  type InstructorOption,
  type InstructorSource,
} from "@/hooks/useInstructorOptions";

const ORDER: InstructorSource[] = ["author", "team", "kol", "professional"];

/**
 * Seletor único de pessoas já cadastradas (autores, team members, KOLs e
 * profissionais) — evita recadastrar quem já existe no sistema.
 */
export default function PersonPicker({
  onSelect,
  label = "Selecionar cadastro existente",
  className,
}: {
  onSelect: (person: InstructorOption) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data = [], isLoading } = useInstructorOptions();

  const groups = useMemo(() => {
    const map = new Map<InstructorSource, InstructorOption[]>();
    for (const o of data) {
      const arr = map.get(o.source) ?? [];
      arr.push(o);
      map.set(o.source, arr);
    }
    return ORDER.filter((s) => (map.get(s) ?? []).length > 0).map((s) => ({ source: s, items: map.get(s)! }));
  }, [data]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={className}>
          {isLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Users className="w-4 h-4 mr-1.5" />}
          {label}
          <ChevronsUpDown className="w-3.5 h-3.5 ml-1.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command>
          <CommandInput placeholder="Buscar autor, team member, KOL…" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum cadastro encontrado.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.source} heading={INSTRUCTOR_SOURCE_LABEL[g.source]}>
                {g.items.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={`${o.name} ${o.detail ?? ""} ${o.email ?? ""}`}
                    onSelect={() => {
                      onSelect(o);
                      setOpen(false);
                    }}
                  >
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
