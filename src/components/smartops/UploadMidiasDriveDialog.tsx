import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Upload, X, RotateCcw, CheckCircle2, AlertCircle, Loader2, ImagePlus, Video } from "lucide-react";
import { useTurmaParticipants, isBlockedStatus, type TurmaParticipant } from "@/hooks/useTurmaParticipants";
import { useTurmaDriveMedia } from "@/hooks/useTurmaDriveMedia";
import { prepareUpload, runUpload, readDimensions, cancelUpload } from "@/lib/trainingDriveUpload";

const PHOTO_DESTS = [
  { key: "fotos_turma", label: "Foto da turma", path: "03 - Fotos Originais › 01 - Foto da Turma" },
  { key: "fotos_participantes_certificados", label: "Participantes com certificados", path: "03 - Fotos Originais › 02 - Participantes com Certificados" },
  { key: "fotos_atividades", label: "Atividades práticas", path: "03 - Fotos Originais › 03 - Atividades Práticas" },
  { key: "fotos_equipamentos", label: "Equipamentos e resultados", path: "03 - Fotos Originais › 04 - Equipamentos e Resultados" },
  { key: "fotos_bastidores", label: "Bastidores", path: "03 - Fotos Originais › 05 - Bastidores" },
];

const VIDEO_DESTS = [
  { key: "videos_vertical", label: "Vídeo vertical", path: "04 - Vídeos Originais › 01 - Vídeos Verticais" },
  { key: "videos_horizontal", label: "Vídeo horizontal", path: "04 - Vídeos Originais › 02 - Vídeos Horizontais" },
  { key: "videos_depoimentos", label: "Depoimento", path: "04 - Vídeos Originais › 03 - Depoimentos" },
  { key: "videos_atividades", label: "Atividade prática", path: "04 - Vídeos Originais › 04 - Atividades Práticas" },
  { key: "videos_bastidores", label: "Bastidores", path: "04 - Vídeos Originais › 05 - Bastidores" },
];

type QueueStatus = "waiting" | "uploading" | "done" | "error" | "canceled";

interface QueueItem {
  id: string;
  file: File;
  destinationKey: string;
  destinationPath: string;
  trainingDay: number | "geral" | null;
  enrollmentId: string | null;
  companionId: string | null;
  exceptionReason: string | null;
  participantName: string | null;
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
  turmaId: string;
  turmaNumber?: number | null;
  turmaLabel?: string;
  courseTitle?: string;
  startDate?: string | null;
  endDate?: string | null;
  folderUrl?: string | null;
}

function fmt(d?: string | null) {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

export function UploadMidiasDriveDialog({
  open, onOpenChange, turmaId, turmaNumber, turmaLabel, courseTitle, startDate, endDate, folderUrl,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [photoDest, setPhotoDest] = useState(PHOTO_DESTS[0].key);
  const [videoDest, setVideoDest] = useState(VIDEO_DESTS[0].key);
  const [videoDay, setVideoDay] = useState<string>("");
  const [days, setDays] = useState<{ day_number: number; date: string }[]>([]);
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionMode, setExceptionMode] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const pendingTarget = useRef<{ enrollmentId: string | null; companionId: string | null; name: string | null } | null>(null);

  const { data: participants = [] } = useTurmaParticipants(turmaId, open);
  const { data: media = [], refetch: refetchMedia } = useTurmaDriveMedia(turmaId, open);

  useEffect(() => {
    if (!open || !turmaId) return;
    supabase
      .from("smartops_turma_days")
      .select("day_number, date")
      .eq("turma_id", turmaId)
      .order("day_number")
      .then(({ data }) => setDays((data || []) as any));
  }, [open, turmaId]);

  const uploading = queue.some((q) => q.status === "uploading");
  const activeParticipants = participants.filter((p) => !isBlockedStatus(p.status));
  const blockedParticipants = participants.filter((p) => isBlockedStatus(p.status));

  const testimonialsByKey = useMemo(() => {
    const map = new Map<string, { count: number; link: string | null }>();
    for (const m of media) {
      if (m.destination_key !== "videos_depoimentos" || m.status !== "completed") continue;
      const key = m.companion_id ? `c:${m.companion_id}` : m.enrollment_id ? `e:${m.enrollment_id}` : "x";
      const prev = map.get(key);
      map.set(key, { count: (prev?.count ?? 0) + 1, link: prev?.link ?? m.drive_web_view_link ?? null });
    }
    return map;
  }, [media]);

  const dayOptions = days.length
    ? days.map((d) => ({ value: String(d.day_number), label: `Dia ${d.day_number} — ${fmt(d.date)}` }))
    : startDate
      ? [{ value: "1", label: `Dia 1 — ${fmt(startDate)}` }]
      : [];

  const addFiles = (files: FileList | null, kind: "photo" | "video") => {
    if (!files?.length) return;
    const dest = kind === "photo"
      ? PHOTO_DESTS.find((d) => d.key === photoDest)!
      : VIDEO_DESTS.find((d) => d.key === videoDest)!;
    const isTestimonial = dest.key === "videos_depoimentos";
    const target = pendingTarget.current;
    pendingTarget.current = null;

    const items: QueueItem[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      destinationKey: dest.key,
      destinationPath: dest.path,
      trainingDay: kind === "video" && !isTestimonial ? (videoDay === "geral" ? "geral" : videoDay ? Number(videoDay) : null) : null,
      enrollmentId: isTestimonial ? (target?.enrollmentId ?? null) : null,
      companionId: isTestimonial ? (target?.companionId ?? null) : null,
      exceptionReason: isTestimonial && !target?.enrollmentId ? (exceptionReason || null) : null,
      participantName: isTestimonial ? (target?.name ?? "Participante não localizado") : null,
      status: "waiting",
      sent: 0,
    }));
    setQueue((q) => [...q, ...items]);
    items.forEach((it) => void startItem(it.id, items));
  };

  const startItem = async (itemId: string, seed?: QueueItem[]) => {
    const snapshot = seed ? [...queue, ...seed] : queue;
    const base = snapshot.find((q) => q.id === itemId);
    if (!base) return;
    const controller = new AbortController();
    setQueue((q) => q.map((x) => (x.id === itemId ? { ...x, status: "uploading", sent: 0, error: undefined, controller } : x)));
    try {
      const dims = await readDimensions(base.file);
      const prepared = await prepareUpload({
        turma_id: turmaId,
        destination_key: base.destinationKey,
        original_filename: base.file.name,
        mime_type: base.file.type,
        size_bytes: base.file.size,
        width: dims.width,
        height: dims.height,
        training_day: base.trainingDay,
        enrollment_id: base.enrollmentId,
        companion_id: base.companionId,
        exception_reason: base.exceptionReason,
      });
      setQueue((q) => q.map((x) => (x.id === itemId ? { ...x, generatedFilename: prepared.generated_filename, uploadId: prepared.upload_id } : x)));
      const res = await runUpload(base.file, prepared, (sent) => {
        setQueue((q) => q.map((x) => (x.id === itemId ? { ...x, sent } : x)));
      }, controller.signal);
      setQueue((q) => q.map((x) => (x.id === itemId ? { ...x, status: "done", sent: base.file.size, link: res.drive_web_view_link } : x)));
      void refetchMedia();
      qc.invalidateQueries({ queryKey: ["turma-drive-media", turmaId] });
    } catch (err: any) {
      const msg = err?.message || String(err);
      setQueue((q) => q.map((x) => (x.id === itemId ? { ...x, status: msg.includes("cancelado") ? "canceled" : "error", error: msg } : x)));
      if (!msg.includes("cancelado")) toast({ title: "Falha no upload", description: msg, variant: "destructive" });
    }
  };

  const cancelItem = async (item: QueueItem) => {
    item.controller?.abort();
    if (item.uploadId) await cancelUpload(item.uploadId);
    setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "canceled" } : x)));
  };

  const requestClose = (v: boolean) => {
    if (!v && uploading) {
      if (!window.confirm("Há uploads em andamento. Fechar e cancelar?")) return;
      queue.filter((q) => q.status === "uploading").forEach((q) => void cancelItem(q));
    }
    if (!v) setQueue([]);
    onOpenChange(v);
  };

  const pickTestimonial = (p: TurmaParticipant) => {
    pendingTarget.current = { enrollmentId: p.enrollment_id, companionId: p.companion_id, name: p.name };
    setVideoDest("videos_depoimentos");
    const ok = window.confirm(`Este vídeo será associado a ${p.name} e enviado para 04 - Vídeos Originais/03 - Depoimentos.`);
    if (!ok) { pendingTarget.current = null; return; }
    videoInput.current?.click();
  };

  const pickException = () => {
    if (exceptionReason.trim().length < 5) {
      toast({ title: "Justificativa obrigatória", description: "Descreva por que o participante não está cadastrado.", variant: "destructive" });
      return;
    }
    pendingTarget.current = { enrollmentId: null, companionId: null, name: "Participante não localizado" };
    setVideoDest("videos_depoimentos");
    videoInput.current?.click();
  };

  const semDepoimento = activeParticipants.filter((p) => !testimonialsByKey.get(p.key)).length;

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload de Mídias</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-0.5 text-xs">
              <div className="font-medium text-foreground">
                Imersão {turmaNumber ?? "S/N"} — {courseTitle || turmaLabel}
              </div>
              <div>
                {fmt(startDate)}{endDate && endDate !== startDate ? ` – ${fmt(endDate)}` : ""}
                {folderUrl && (
                  <a href={folderUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                    Abrir pasta no Drive <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="fotos" className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="fotos" className="gap-1.5"><ImagePlus className="h-4 w-4" /> Fotos</TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5"><Video className="h-4 w-4" /> Vídeos</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-3">
            <TabsContent value="fotos" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label>Destino da foto</Label>
                <Select value={photoDest} onValueChange={setPhotoDest}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PHOTO_DESTS.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Destino: Imersão {turmaNumber ?? "S/N"} › {PHOTO_DESTS.find((d) => d.key === photoDest)?.path}
                </p>
              </div>
              <Button onClick={() => photoInput.current?.click()} className="gap-1.5">
                <Upload className="h-4 w-4" /> Selecionar fotos
              </Button>
              <input ref={photoInput} type="file" accept="image/*" multiple hidden
                onChange={(e) => { addFiles(e.target.files, "photo"); e.target.value = ""; }} />
            </TabsContent>

            <TabsContent value="videos" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label>Tipo de vídeo</Label>
                <Select value={videoDest} onValueChange={setVideoDest}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VIDEO_DESTS.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Destino: Imersão {turmaNumber ?? "S/N"} › {VIDEO_DESTS.find((d) => d.key === videoDest)?.path}
                </p>
              </div>

              {videoDest !== "videos_depoimentos" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Classificação do dia</Label>
                    <Select value={videoDay} onValueChange={setVideoDay}>
                      <SelectTrigger><SelectValue placeholder="Selecione o dia" /></SelectTrigger>
                      <SelectContent>
                        {dayOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        <SelectItem value="geral">Geral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button disabled={!videoDay} onClick={() => videoInput.current?.click()} className="gap-1.5">
                    <Upload className="h-4 w-4" /> Selecionar vídeos
                  </Button>
                  {!videoDay && <p className="text-xs text-muted-foreground">Selecione o dia para liberar o envio.</p>}
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Participantes da turma</Label>
                    <Badge variant="secondary">{semDepoimento} sem depoimento</Badge>
                  </div>
                  {activeParticipants.map((p) => {
                    const t = testimonialsByKey.get(p.key);
                    const inFlight = queue.some((q) => q.status === "uploading" && (q.companionId ? `c:${q.companionId}` : `e:${q.enrollmentId}`) === p.key);
                    const failed = queue.some((q) => q.status === "error" && (q.companionId ? `c:${q.companionId}` : `e:${q.enrollmentId}`) === p.key);
                    return (
                      <div key={p.key} className="flex items-center justify-between gap-2 rounded-md border p-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                            {p.status && <Badge variant="outline" className="text-[10px]">{p.status}</Badge>}
                            <span className="text-[10px] text-muted-foreground">
                              {inFlight ? "enviando" : failed ? "erro" : t ? `${t.count} enviado(s)` : "sem vídeo"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {t?.link && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={t.link} target="_blank" rel="noopener noreferrer">Ver no Drive</a>
                            </Button>
                          )}
                          <Button size="sm" variant={t ? "outline" : "default"} onClick={() => pickTestimonial(p)}>
                            {t ? "Adicionar outro vídeo" : "Enviar depoimento"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {blockedParticipants.length > 0 && (
                    <div className="rounded-md border border-dashed p-2 space-y-1 opacity-60">
                      <div className="text-xs font-medium">Cancelados / ausentes</div>
                      {blockedParticipants.map((p) => (
                        <div key={p.key} className="flex items-center justify-between text-xs">
                          <span className="truncate">{p.name} — {p.status}</span>
                          <Button size="sm" variant="ghost" disabled>Enviar depoimento</Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-md border-2 border-dashed border-amber-500/60 bg-amber-500/5 p-2 space-y-2">
                    <div className="text-xs font-semibold text-amber-600">Participante não localizado (exceção)</div>
                    {exceptionMode ? (
                      <>
                        <Textarea
                          value={exceptionReason}
                          onChange={(e) => setExceptionReason(e.target.value)}
                          placeholder="Justifique por que o participante não está cadastrado na turma"
                          rows={2}
                        />
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" onClick={pickException}>Selecionar vídeo</Button>
                          <Button size="sm" variant="ghost" onClick={() => setExceptionMode(false)}>Cancelar</Button>
                        </div>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setExceptionMode(true)}>Usar exceção</Button>
                    )}
                  </div>
                </div>
              )}
              <input ref={videoInput} type="file" accept="video/*" multiple hidden
                onChange={(e) => { addFiles(e.target.files, "video"); e.target.value = ""; }} />
            </TabsContent>

            {queue.length > 0 && (
              <div className="mt-4 space-y-2 border-t pt-3">
                <div className="text-sm font-medium">Fila de envio</div>
                {queue.map((item) => {
                  const pct = item.file.size ? Math.round((item.sent / item.file.size) * 100) : 0;
                  return (
                    <div key={item.id} className="rounded-md border p-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">{item.generatedFilename || item.file.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {item.destinationPath}
                            {item.participantName ? ` · ${item.participantName}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin" />}
                          {item.status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                          {item.link && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={item.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                            </Button>
                          )}
                          {(item.status === "error" || item.status === "canceled") && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startItem(item.id)}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {item.status === "uploading" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cancelItem(item)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {item.status !== "done" && <Progress value={pct} className="h-1.5" />}
                      {item.error && <div className="text-[10px] text-destructive">{item.error}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
