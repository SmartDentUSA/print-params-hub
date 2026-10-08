import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, ExternalLink, UploadCloud, Users } from "lucide-react";
import { CriarPastaEventoDriveButton } from "@/components/smartops/CriarPastaEventoDriveButton";
import { EventMediaUploadDialog } from "@/components/smartops/EventMediaUploadDialog";
import type { EventDestination } from "@/lib/eventDriveUpload";

interface EventFolderRow {
  event_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  country: string | null;
  folder_id: string | null;
  folder_url: string | null;
  destinations: EventDestination[] | null;
}

function fmtRange(a?: string | null, b?: string | null) {
  const f = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");
  if (!a && !b) return "sem data";
  if (!b || a === b) return f(a);
  return `${f(a)} — ${f(b)}`;
}

export function EventsUploadAccordion() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<EventFolderRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["agenda-event-drive-folders"],
    staleTime: 60_000,
    queryFn: async (): Promise<EventFolderRow[]> => {
      const { data, error } = await (supabase as any).rpc("fn_agenda_event_drive_folders");
      if (error) throw error;
      return (data || []) as EventFolderRow[];
    },
  });

  const { data: formRows } = useQuery({
    queryKey: ["agenda-event-visitor-forms"],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from("smartops_forms")
        .select("event_id,slug")
        .not("event_id", "is", null)
        .eq("active", true);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const f of (data || []) as { event_id: string | null; slug: string }[]) {
        if (f.event_id && f.slug && !map[f.event_id]) map[f.event_id] = f.slug;
      }
      return map;
    },
  });

  const rows = useMemo(() => {
    // Eventos realizados há mais de 15 dias não aparecem na lista.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 15);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);
    const recent = (data || []).filter((r) => {
      const ref = r.end_date || r.start_date;
      return !ref || ref >= cutoffStr;
    });
    const s = search.trim().toLowerCase();
    const filtered = s
      ? recent.filter((r) =>
          [r.name, r.location, r.country].filter(Boolean).some((v) => String(v).toLowerCase().includes(s)),
        )
      : recent;
    // Ordem do evento mais próximo ao mais distante: os que ainda vão acontecer
    // primeiro (data crescente), depois os já realizados (mais recentes antes),
    // e os sem data por último.
    const startRef = (r: EventFolderRow) => r.start_date || r.end_date || "";
    const isUpcoming = (r: EventFolderRow) => (r.end_date || r.start_date || "") >= todayStr;
    return [...filtered].sort((a, b) => {
      const ra = startRef(a);
      const rb = startRef(b);
      if (!ra && !rb) return 0;
      if (!ra) return 1;
      if (!rb) return -1;
      const ua = isUpcoming(a);
      const ub = isUpcoming(b);
      if (ua !== ub) return ua ? -1 : 1;
      return ua ? ra.localeCompare(rb) : rb.localeCompare(ra);
    });
  }, [data, search]);

  return (
    <Accordion type="single" collapsible className="w-full rounded-xl border bg-card">
      <AccordionItem value="eventos" className="border-0">
        <AccordionTrigger className="px-4 text-sm font-semibold">
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Mídias de eventos e congressos
            {!!rows.length && (
              <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">{rows.length}</Badge>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 px-4 pb-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar evento por nome, cidade ou país"
            className="h-9"
          />
          {isLoading && <p className="text-sm text-muted-foreground">Carregando eventos…</p>}
          {!isLoading && !rows.length && <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>}
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.event_id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fmtRange(row.start_date, row.end_date)}
                    {row.location ? ` · ${row.location}` : ""}
                    {row.country ? ` · ${row.country}` : ""}
                  </p>
                </div>
                {row.folder_url && (
                  <a href={row.folder_url} target="_blank" rel="noopener" className="text-primary">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {formRows?.[row.event_id] && (
                  <a
                    href={`/f/${formRows[row.event_id]}`}
                    target="_blank"
                    rel="noopener"
                    title="Abrir formulário de cadastro de leads do evento"
                  >
                    <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
                      <Users className="h-3.5 w-3.5" /> Visitantes
                    </Button>
                  </a>
                )}
                <CriarPastaEventoDriveButton eventId={row.event_id} folderUrl={row.folder_url} />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={!row.folder_id}
                  title={row.folder_id ? "Enviar fotos e vídeos" : "Crie a pasta do Drive primeiro"}
                  onClick={() => setActive(row)}
                >
                  <UploadCloud className="h-3.5 w-3.5" /> Upload de Mídias
                </Button>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {active && (
        <EventMediaUploadDialog
          open={!!active}
          onOpenChange={(v) => !v && setActive(null)}
          eventId={active.event_id}
          eventName={active.name}
          folderUrl={active.folder_url}
          destinations={active.destinations || []}
        />
      )}
    </Accordion>
  );
}
