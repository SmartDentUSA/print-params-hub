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
import { cn } from "@/lib/utils";
import {
  ExternalLink, Upload, X, RotateCcw, CheckCircle2, AlertCircle, Loader2,
  ImagePlus, Video, Camera, Users, Wrench, Clapperboard, MessageSquareQuote,
} from "lucide-react";
import { useTurmaParticipants, isBlockedStatus, type TurmaParticipant } from "@/hooks/useTurmaParticipants";
import { useTurmaDriveMedia } from "@/hooks/useTurmaDriveMedia";
import { useTurmaDriveInventory, upperKebabName } from "@/hooks/useTurmaDriveInventory";
import { prepareUpload, runUpload, readDimensions, cancelUpload } from "@/lib/trainingDriveUpload";

type DestSpec = {
  key: string;
  label: string;
  folderTag: string;
  folderName: string;
  path: string;
  tag: string;
  hint: string;
  accept: string;
  icon: typeof Camera;
  requiresDay?: boolean;
};

const PHOTO_DESTS: DestSpec[] = [
  { key: "fotos_turma", label: "Foto da turma", folderTag: "03 - Fotos Originais", folderName: "01 – Foto da Turma", path: "03 - Fotos Originais › 01 - Foto da Turma", tag: "Fotografia de Grupo", hint: "Foto oficial em grupo com todos os alunos, professores e equipe do treinamento.", accept: "image/*", icon: Camera },
  { key: "fotos_participantes_certificados", label: "Participantes com certificados", folderTag: "03 - Fotos Originais", folderName: "02 – Participantes com Certificados", path: "03 - Fotos Originais › 02 - Participantes com Certificados", tag: "Entrega de Certificados", hint: "Fotos individuais ou em duplas na entrega dos certificados.", accept: "image/*", icon: Users },
  { key: "fotos_atividades", label: "Atividades práticas", folderTag: "03 - Fotos Originais", folderName: "03 – Atividades Práticas", path: "03 - Fotos Originais › 03 - Atividades Práticas", tag: "Hands-on", hint: "Registros dos alunos executando as atividades práticas.", accept: "image/*", icon: Wrench },
  { key: "fotos_equipamentos", label: "Equipamentos e resultados", folderTag: "03 - Fotos Originais", folderName: "04 – Equipamentos e Resultados", path: "03 - Fotos Originais › 04 - Equipamentos e Resultados", tag: "Produto & Resultado", hint: "Impressoras, scanners, resinas e peças finalizadas.", accept: "image/*", icon: ImagePlus },
  { key: "fotos_bastidores", label: "Bastidores", folderTag: "03 - Fotos Originais", folderName: "05 – Bastidores", path: "03 - Fotos Originais › 05 - Bastidores", tag: "Making of", hint: "Coffee break, montagem da sala e momentos informais.", accept: "image/*", icon: Clapperboard },
];

const VIDEO_DESTS: DestSpec[] = [
  { key: "videos_vertical", label: "Vídeos verticais", folderTag: "04 - Vídeos Originais", folderName: "01 – Vídeos Verticais", path: "04 - Vídeos Originais › 01 - Vídeos Verticais", tag: "9:16 — Reels / Stories", hint: "Vídeos gravados na vertical para redes sociais.", accept: "video/*", icon: Video, requiresDay: true },
  { key: "videos_horizontal", label: "Vídeos horizontais", folderTag: "04 - Vídeos Originais", folderName: "02 – Vídeos Horizontais", path: "04 - Vídeos Originais › 02 - Vídeos Horizontais", tag: "16:9 — YouTube", hint: "Vídeos gravados na horizontal, aulas e panorâmicas.", accept: "video/*", icon: Video, requiresDay: true },
  { key: "videos_atividades", label: "Atividades práticas", folderTag: "04 - Vídeos Originais", folderName: "04 – Atividades Práticas", path: "04 - Vídeos Originais › 04 - Atividades Práticas", tag: "Hands-on", hint: "Vídeos das etapas práticas do treinamento.", accept: "video/*", icon: Wrench, requiresDay: true },
  { key: "videos_bastidores", label: "Bastidores", folderTag: "04 - Vídeos Originais", folderName: "05 – Bastidores", path: "04 - Vídeos Originais › 05 - Bastidores", tag: "Making of", hint: "Bastidores, preparação e momentos informais.", accept: "video/*", icon: Clapperboard, requiresDay: true },
];

const TESTIMONIAL_DEST: DestSpec = {
  key: "videos_depoimentos", label: "Depoimento", folderTag: "04 - Vídeos Originais", folderName: "03 – Depoimentos",
  path: "04 - Vídeos Originais › 03 - Depoimentos", tag: "Depoimento individual",
  hint: "Um vídeo por participante. O nome do arquivo é gerado com o nome do aluno.",
  accept: "video/*", icon: MessageSquareQuote,
};

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

interface DropCardProps {
  dest: DestSpec;
  count: number;
  subtitle?: string;
  disabled?: boolean;
  disabledHint?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onFiles: (files: FileList | null) => void;
}

function DropCard({ dest, count, subtitle, disabled, disabledHint, children, footer, onFiles }: DropCardProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const Icon = dest.icon;

  return (
    <div className={cn("rounded-xl border-2 p-3 flex flex-col gap-3 transition-colors", disabled ? "border-border opacity-60" : "border-border hover:border-primary/40")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="rounded-lg bg-muted p-2 shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-1 font-mono text-[10px]">{dest.folderTag}</Badge>
            <div className="text-sm font-semibold leading-tight truncate">{dest.folderName}</div>
            {subtitle && <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>}
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{count} arq</Badge>
      </div>

      <Badge variant="outline" className="w-fit text-[10px]">{dest.tag}</Badge>
      <p className="rounded-md bg-muted/50 p-2 text-[11px] leading-snug text-muted-foreground">{dest.hint}</p>

      {children}

      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { if (disabled) return; e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault(); setOver(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed p-4 text-center transition-colors",
          disabled ? "cursor-not-allowed border-border" : over ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
        )}
      >
        <Upload className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
        <div className="text-xs">
          Arraste para <span className="font-semibold text-primary underline">{dest.folderName}</span>
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {disabled ? (disabledHint || "Indisponível") : dest.accept.startsWith("image") ? "JPG, PNG, WEBP, HEIC" : "MP4, MOV, WEBM"}
        </div>
      </button>

      {footer}

      <input
        ref={input}
        type="file"
        accept={dest.accept}
        multiple
        hidden
        onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}

export function UploadMidiasDriveDialog({
  open, onOpenChange, turmaId, turmaNumber, turmaLabel, courseTitle, startDate, endDate, folderUrl,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dayByDest, setDayByDest] = useState<Record<string, string>>({});
  const [days, setDays] = useState<{ day_number: number; date: string }[]>([]);
  const [exceptionReason, setExceptionReason] = useState("");

  const { data: participants = [] } = useTurmaParticipants(turmaId, open);
  const { data: media = [], refetch: refetchMedia } = useTurmaDriveMedia(turmaId, open);
  const { data: inventory, refetch: refetchInventory } = useTurmaDriveInventory(turmaId, open);

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

  const countByDest = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of media) {
      if (m.status !== "completed") continue;
      map[m.destination_key] = (map[m.destination_key] || 0) + 1;
    }
    // O Drive é a fonte de verdade: arquivos enviados manualmente também contam.
    for (const [k, n] of Object.entries(inventory?.counts || {})) {
      map[k] = Math.max(map[k] || 0, n);
    }
    return map;
  }, [media, inventory]);

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

  // Depoimentos já existentes no Drive (upload manual): casa pelo nome do arquivo.
  const driveTestimonialCount = useMemo(() => {
    const names = inventory?.names?.["videos_depoimentos"] || [];
    const map = new Map<string, number>();
    for (const p of participants) {
      const token = upperKebabName(p.name);
      if (!token) continue;
      const n = names.filter((f) => f.toUpperCase().includes(token)).length;
      if (n) map.set(p.key, n);
    }
    return map;
  }, [inventory, participants]);

  const driveTestimonialTotal = inventory?.names?.["videos_depoimentos"]?.length ?? 0;

  /** Contagem por destino + dia (banco + arquivos já existentes no Drive). */
  const countByDestDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of media) {
      if (m.status !== "completed") continue;
      const day = m.training_day ? String(m.training_day) : "geral";
      const k = `${m.destination_key}|${day}`;
      map[k] = (map[k] || 0) + 1;
    }
    for (const [dest, names] of Object.entries(inventory?.names || {})) {
      const perDay: Record<string, number> = {};
      for (const n of names) {
        const up = n.toUpperCase();
        const m = up.match(/_DIA-(\d)_/);
        const day = m ? m[1] : up.includes("_GERAL_") ? "geral" : "sem";
        perDay[day] = (perDay[day] || 0) + 1;
      }
      for (const [day, n] of Object.entries(perDay)) {
        const k = `${dest}|${day}`;
        map[k] = Math.max(map[k] || 0, n);
      }
    }
    return map;
  }, [media, inventory]);

  const dayOptions = days.length
    ? days.map((d) => ({ value: String(d.day_number), label: `Dia ${d.day_number} — ${fmt(d.date)}` }))
    : startDate
      ? [{ value: "1", label: `Dia 1 — ${fmt(startDate)}` }]
      : [];

  const addFiles = (
    files: FileList | null,
    dest: DestSpec,
    opts?: { day?: string; enrollmentId?: string | null; companionId?: string | null; name?: string | null; exceptionReason?: string | null },
  ) => {
    if (!files?.length) return;
    const isTestimonial = dest.key === TESTIMONIAL_DEST.key;
    const day = opts?.day;

    const items: QueueItem[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      destinationKey: dest.key,
      destinationPath: dest.path,
      trainingDay: dest.requiresDay ? (day === "geral" ? "geral" : day ? Number(day) : null) : null,
      enrollmentId: isTestimonial ? (opts?.enrollmentId ?? null) : null,
      companionId: isTestimonial ? (opts?.companionId ?? null) : null,
      exceptionReason: isTestimonial && !opts?.enrollmentId ? (opts?.exceptionReason || null) : null,
      participantName: isTestimonial ? (opts?.name ?? "Participante não localizado") : null,
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
      void refetchInventory();
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

  const semDepoimento = activeParticipants.filter(
    (p) => !testimonialsByKey.get(p.key) && !driveTestimonialCount.get(p.key),
  ).length;

  const participantCard = (p: TurmaParticipant) => {
    const t = testimonialsByKey.get(p.key);
    const driveCount = driveTestimonialCount.get(p.key) ?? 0;
    const total = Math.max(t?.count ?? 0, driveCount);
    const inFlight = queue.some((q) => q.status === "uploading" && (q.companionId ? `c:${q.companionId}` : `e:${q.enrollmentId}`) === p.key);
    const failed = queue.some((q) => q.status === "error" && (q.companionId ? `c:${q.companionId}` : `e:${q.enrollmentId}`) === p.key);
    return (
      <DropCard
        key={p.key}
        dest={{ ...TESTIMONIAL_DEST, folderName: p.name, tag: `${p.type}${p.status ? ` · ${p.status}` : ""}` }}
        count={total}
        subtitle={TESTIMONIAL_DEST.path}
        onFiles={(files) => addFiles(files, TESTIMONIAL_DEST, { enrollmentId: p.enrollment_id, companionId: p.companion_id, name: p.name })}
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {inFlight ? "enviando…" : failed ? "erro no último envio" : total ? `${total} depoimento(s)` : "sem vídeo"}
            </span>
            {t?.link && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" asChild>
                <a href={t.link} target="_blank" rel="noopener noreferrer">Ver no Drive</a>
              </Button>
            )}
          </div>
        }
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
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
            <TabsTrigger value="depoimentos" className="gap-1.5"><MessageSquareQuote className="h-4 w-4" /> Depoimentos</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-3">
            <TabsContent value="fotos" className="mt-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PHOTO_DESTS.map((d) => (
                  <DropCard
                    key={d.key}
                    dest={d}
                    count={countByDest[d.key] || 0}
                    subtitle={d.path}
                    onFiles={(files) => addFiles(files, d)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="videos" className="mt-3">
              <div className="space-y-5">
                {VIDEO_DESTS.map((d) => (
                  <div key={d.key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold">{d.folderName}</div>
                      <Badge variant="secondary" className="font-mono text-[10px]">{d.folderTag}</Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">{countByDest[d.key] || 0} arq</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[...dayOptions, { value: "geral", label: "Geral (sem dia específico)" }].map((o) => (
                        <DropCard
                          key={`${d.key}-${o.value}`}
                          dest={{ ...d, folderName: o.label }}
                          count={countByDestDay[`${d.key}|${o.value}`] || 0}
                          subtitle={d.path}
                          onFiles={(files) => addFiles(files, d, { day: o.value })}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="depoimentos" className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Uma janela de upload por participante — o nome do arquivo é gerado com o nome do aluno.</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{driveTestimonialTotal} no Drive</Badge>
                  <Badge variant="secondary">{semDepoimento} sem depoimento</Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeParticipants.map(participantCard)}
              </div>

              {blockedParticipants.length > 0 && (
                <div className="rounded-lg border border-dashed p-3 opacity-60">
                  <div className="mb-1 text-xs font-medium">Cancelados / ausentes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {blockedParticipants.map((p) => (
                      <Badge key={p.key} variant="outline" className="text-[10px]">{p.name} — {p.status}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border-2 border-dashed border-amber-500/60 bg-amber-500/5 p-3 space-y-2">
                <div className="text-xs font-semibold text-amber-600">Participante não localizado (exceção)</div>
                <Textarea
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="Justifique por que o participante não está cadastrado na turma (mín. 5 caracteres)"
                  rows={2}
                />
                <DropCard
                  dest={{ ...TESTIMONIAL_DEST, folderName: "Participante não localizado", tag: "Exceção justificada" }}
                  count={testimonialsByKey.get("x")?.count ?? 0}
                  subtitle={TESTIMONIAL_DEST.path}
                  disabled={exceptionReason.trim().length < 5}
                  disabledHint="Preencha a justificativa"
                  onFiles={(files) => addFiles(files, TESTIMONIAL_DEST, { name: "Participante não localizado", exceptionReason })}
                />
              </div>
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
