import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, ExternalLink, UploadCloud } from "lucide-react";
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

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data || [];
    return (data || []).filter((r) =>
      [r.name, r.location, r.country].filter(Boolean).some((v) => String(v).toLowerCase().includes(s)),
    );
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
