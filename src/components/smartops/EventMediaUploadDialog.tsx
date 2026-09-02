import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink, Upload, X, CheckCircle2, AlertCircle, Loader2, ImagePlus, Video, MessageSquareQuote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  acceptFor, cancelEventUpload, fetchEventDriveInventory, prepareEventUpload,
  readDimensions, resolvedMimeType, runEventUpload,
  type EventDestination,
} from "@/lib/eventDriveUpload";

type QueueStatus = "waiting" | "uploading" | "done" | "error" | "canceled";

interface QueueItem {
  id: string;
  file: File;
  destinationKey: string;
  destinationLabel: string;
  status: QueueStatus;
  sent: number;
  generatedFilename?: string;
  link?: string;
  error?: string;
  uploadId?: string;
  controller?: AbortController;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  eventName: string;
  folderUrl?: string | null;
  destinations: EventDestination[];
}

function iconFor(dest: EventDestination) {
  if (dest.token.includes("DEPOIMENTO")) return MessageSquareQuote;
  return dest.kind === "photo" ? ImagePlus : Video;
}

export function EventMediaUploadDialog({ open, onOpenChange, eventId, eventName, folderUrl, destinations }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: inventory } = useQuery({
    queryKey: ["event-drive-inventory", eventId],
    enabled: open && !!eventId,
    staleTime: 30_000,
    queryFn: () => fetchEventDriveInventory(eventId),
  });

  const groups = useMemo(() => {
    const map = new Map<string, EventDestination[]>();
    for (const d of destinations) {
      const list = map.get(d.group) || [];
      list.push(d);
      map.set(d.group, list);
    }
    return Array.from(map.entries());
  }, [destinations]);

  const addFiles = (dest: EventDestination, files: FileList | null) => {
    if (!files?.length) return;
    const items: QueueItem[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      destinationKey: dest.key,
      destinationLabel: dest.label,
      status: "waiting",
      sent: 0,
    }));
    setQueue((prev) => [...prev, ...items]);
  };

  const patch = (id: string, changes: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)));

  const startQueue = async () => {
    if (running) return;
    setRunning(true);
    try {
      for (const item of queue) {
        if (item.status !== "waiting" && item.status !== "error") continue;
        const controller = new AbortController();
        patch(item.id, { status: "uploading", sent: 0, error: undefined, controller });
        try {
          const mime = resolvedMimeType(item.file);
          const dims = await readDimensions(item.file);
          const prepared = await prepareEventUpload({
            event_id: eventId,
            destination_key: item.destinationKey,
            original_filename: item.file.name,
            mime_type: mime,
            size_bytes: item.file.size,
            width: dims.width,
            height: dims.height,
          });
          patch(item.id, { uploadId: prepared.upload_id, generatedFilename: prepared.generated_filename });
          const res = await runEventUpload(
            item.file,
            prepared,
            (sent) => patch(item.id, { sent }),
            controller.signal,
          );
          patch(item.id, { status: "done", sent: item.file.size, link: res.drive_web_view_link });
        } catch (err: any) {
          const message = err?.message || String(err);
          patch(item.id, { status: message.includes("cancelado") ? "canceled" : "error", error: message });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["event-drive-inventory", eventId] });
      toast({ title: "Envio concluído", description: "As copies estão sendo geradas em background." });
    } finally {
      setRunning(false);
    }
  };

  const cancelItem = async (item: QueueItem) => {
    item.controller?.abort();
    if (item.uploadId) await cancelEventUpload(item.uploadId);
    patch(item.id, { status: "canceled" });
  };

  const pending = queue.filter((q) => q.status === "waiting" || q.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Upload de mídias — {eventName}
            {folderUrl && (
              <a href={folderUrl} target="_blank" rel="noopener" className="text-xs text-primary inline-flex items-center gap-1">
                pasta do Drive <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </DialogTitle>
          <DialogDescription>
            Escolha a pasta correta: o nome do arquivo e a copy são gerados pelo sistema com o contexto do evento,
            do estande da Smart Dent e da transcrição do vídeo.
          </DialogDescription>
        </DialogHeader>

        {!destinations.length ? (
          <p className="text-sm text-muted-foreground">
            Este evento ainda não tem a estrutura de pastas criada no Drive.
          </p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {groups.map(([group, list]) => (
              <AccordionItem key={group} value={group}>
                <AccordionTrigger className="text-sm">
                  {group}
                  <Badge variant="outline" className="ml-2 h-5 px-1.5 font-mono text-[10px]">
                    {list.reduce((sum, d) => sum + (inventory?.counts?.[d.key] || 0), 0)}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  {list.map((dest) => {
                    const Icon = iconFor(dest);
                    const count = inventory?.counts?.[dest.key] || 0;
                    return (
                      <div key={dest.key} className="flex items-center gap-3 rounded-lg border p-2.5">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{dest.label}</p>
                          <p className="truncate text-xs text-muted-foreground">{dest.purpose}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("h-5 px-1.5 font-mono text-[10px]", count > 0 && "border-emerald-500/50 text-emerald-600")}
                        >
                          {count}
                        </Badge>
                        <input
                          ref={(el) => { inputs.current[dest.key] = el; }}
                          type="file"
                          multiple
                          accept={acceptFor(dest.kind)}
                          className="hidden"
                          onChange={(e) => { addFiles(dest, e.target.files); e.target.value = ""; }}
                        />
                        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => inputs.current[dest.key]?.click()}>
                          <Upload className="h-3.5 w-3.5" /> Selecionar
                        </Button>
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {queue.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Fila de envio ({queue.length})</p>
              <Button size="sm" onClick={startQueue} disabled={running || pending === 0} className="h-7 text-xs">
                {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
                {running ? "Enviando..." : `Enviar ${pending} arquivo(s)`}
              </Button>
            </div>
            <div className="space-y-1.5">
              {queue.map((item) => (
                <div key={item.id} className="rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {item.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                    {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{item.generatedFilename || item.file.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{item.destinationLabel}</p>
                    </div>
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noopener" className="text-primary">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {item.status === "uploading" && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => cancelItem(item)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {(item.status === "waiting" || item.status === "error" || item.status === "canceled") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {item.status === "uploading" && (
                    <Progress value={Math.round((item.sent / Math.max(item.file.size, 1)) * 100)} className="mt-1.5 h-1" />
                  )}
                  {item.error && <p className="mt-1 text-[11px] text-destructive">{item.error}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
