import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { campaignEventId } from "@/lib/campaignEvent";

export function CampaignEventPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const { data: events = [], isPending, isError, refetch } = useQuery({
    queryKey: ["campaign-event-options"],
    queryFn: async () => {
      const rows: { id: string; name: string; start_date: string | null }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("smartops_events")
          .select("id,name,start_date").order("name").order("id").range(from, from + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return rows;
    },
    staleTime: 60_000,
  });
  useEffect(() => { if (open) void refetch(); }, [open, refetch]);
  const selected = events.find((e) => e.id === campaignEventId(value));
  return <div className="space-y-1">
    <Label htmlFor={id}>Evento (opcional)</Label>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="truncate">{selected?.name || (value ? "Evento selecionado" : "Sem evento")}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar evento…" />
          <CommandList>
            <CommandEmpty>{isPending ? "Carregando eventos…" : isError ? "Não foi possível carregar os eventos." : "Nenhum evento encontrado."}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="Sem evento" onSelect={() => { onChange(""); setOpen(false); }}>
                <Check className={`mr-2 h-4 w-4 ${value ? "invisible" : ""}`} />Sem evento
              </CommandItem>
              {events.map((e) => <CommandItem key={e.id} value={`${e.name} ${e.start_date || ""} ${e.id}`} onSelect={() => { onChange(e.id); setOpen(false); }}>
                <Check className={`mr-2 h-4 w-4 shrink-0 ${value === e.id ? "" : "invisible"}`} />
                <span className="min-w-0 break-words">{e.name}{e.start_date ? ` · ${e.start_date.split("-").reverse().join("/")}` : ""}</span>
              </CommandItem>)}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>;
}