import React, { useEffect, useState } from "react";
import { Share2, MoreVertical, MapPin, Video, User, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TurmaComVagas } from "@/types/courses";
import { formatDatePtBr } from "@/lib/courseUtils";
import { GerarDocButton } from "@/components/GerarDocButton";
import { BoasVindasButton } from "@/components/BoasVindasButton";
import { GerarCrachasButton } from "@/components/GerarCrachasButton";
import { CriarPastaDriveButton } from "@/components/smartops/CriarPastaDriveButton";
import { UploadMidiasDriveButton } from "@/components/smartops/UploadMidiasDriveButton";
import { useTurmaDriveMedia, summarizeMedia } from "@/hooks/useTurmaDriveMedia";
import { AddTurmaToWaGroupButton } from "@/components/smartops/AddTurmaToWaGroupButton";
import { CreateTurmaWaGroupButton } from "@/components/smartops/CreateTurmaWaGroupButton";
import { useTurmaWaGroup } from "@/hooks/useTurmaWaGroup";
import { formatTurmaNumber } from "@/lib/turmaNumber";
import { TurmaFactoryDialog } from "@/components/smartops/TurmaFactoryDialog";

type Variant = "green" | "amber" | "red" | "blue" | "muted";

const STATUS_DOT: Record<Variant, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  blue: "bg-sky-500",
  muted: "bg-muted-foreground/50",
};

const STATUS_PILL: Record<Variant, string> = {
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  red: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  blue: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  muted: "bg-muted text-muted-foreground",
};

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  online_ao_vivo: "Online ao Vivo",
  online: "Online",
  hibrido: "Híbrido",
  gravado: "Gravado",
  acesso_remoto: "Acesso Remoto",
};

interface Props {
  turma: TurmaComVagas;
  companionCount: number;
  status: { label: string; variant: Variant } | null;
  onEnroll: () => void;
  onShare?: () => void;
}

export function TurmaCard({ turma, companionCount, status, onEnroll, onShare }: Props) {
  const pct = turma.slots > 0 ? Math.round((turma.enrolled_count / turma.slots) * 100) : 0;
  const lotado = (turma.vagas_disponiveis ?? 0) === 0;
  const [driveFolderId, setDriveFolderId] = useState<string | null>(turma.drive_folder_id ?? turma.factory_drive_folder_id ?? null);
  const [driveFolderUrl, setDriveFolderUrl] = useState<string | null>(turma.drive_folder_url ?? turma.factory_drive_folder_url ?? null);
  // Mantém sincronizado quando os dados do Drive chegam depois do primeiro render
  useEffect(() => {
    const id = turma.drive_folder_id ?? turma.factory_drive_folder_id ?? null;
    const url = turma.drive_folder_url ?? turma.factory_drive_folder_url ?? null;
    if (id) setDriveFolderId(id);
    if (url) setDriveFolderUrl(url);
    // Se só houver URL, extrai o id para liberar o upload de mídias
    if (!id && url) {
      const m = url.match(/\/folders\/([^/?#]+)/);
      if (m) setDriveFolderId(m[1]);
    }
  }, [turma.drive_folder_id, turma.factory_drive_folder_id, turma.drive_folder_url, turma.factory_drive_folder_url]);
  const { data: driveMedia = [] } = useTurmaDriveMedia(turma.id, !!driveFolderId);
  const mediaCounts = summarizeMedia(driveMedia);
  const depoimentosParticipantes = new Set(
    driveMedia
      .filter((m) => m.destination_key === "videos_depoimentos" && m.status === "completed")
      .map((m) => m.companion_id || m.enrollment_id)
      .filter(Boolean) as string[],
  ).size;
  const semDepoimento = Math.max(0, (turma.enrolled_count ?? 0) + companionCount - depoimentosParticipantes);
  const isMuted = status?.variant === "muted";
  const { group: waGroup, loading: waChecking, refetch: refetchWaGroup } = useTurmaWaGroup(turma.id);
  const effectiveWaGroup = waGroup ?? (turma.whatsapp_group_link
    ? { id: "link-only", nome: null }
    : null);
  const [factoryOpen, setFactoryOpen] = useState(false);
  const hasFactory = turma.factory_status != null;
  const factoryVariant: Variant =
    turma.factory_status === "concluido" ? "green"
    : turma.factory_status === "pronto" ? "blue"
    : turma.factory_status === "processando" ? "amber"
    : turma.factory_status === "erro" ? "red"
    : "muted";
  const factoryLabel =
    turma.factory_status === "concluido" ? "Publicado"
    : turma.factory_status === "pronto" ? "Pronto para publicar"
    : turma.factory_status === "processando" ? "Processando"
    : turma.factory_status === "publicando" ? "Publicando"
    : turma.factory_status === "erro" ? "Erro"
    : "Factory";

  const pctColor =
    pct >= 100 ? "text-rose-600 dark:text-rose-400"
    : pct >= 60 ? "text-emerald-600 dark:text-emerald-400"
    : pct >= 30 ? "text-amber-600 dark:text-amber-400"
    : "text-muted-foreground";

  const subtitleParts = [
    MODALITY_LABEL[turma.modality || "presencial"],
    turma.total_days ? `${turma.total_days} ${turma.total_days === 1 ? "dia" : "dias"}` : null,
    turma.modality === "presencial" ? turma.location : (turma.meeting_link ? "Link online" : null),
  ].filter(Boolean);

  const dateLine = turma.start_date
    ? turma.end_date && turma.end_date !== turma.start_date
      ? `${formatDatePtBr(turma.start_date)} – ${formatDatePtBr(turma.end_date)}`
      : formatDatePtBr(turma.start_date)
    : turma.label;

  return (
    <div
      className={cn(
        "group relative bg-card border rounded-xl p-5 transition-all hover:shadow-md hover:border-primary/30 cursor-pointer",
        isMuted && "opacity-60"
      )}
      onClick={onEnroll}
    >
      {/* Header: status + actions */}
      <div className="flex items-start justify-between mb-3">
        {status && (
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", STATUS_PILL[status.variant])}>
            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status.variant])} />
            {status.label}
          </span>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
          {onShare && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onShare}>
              <Share2 className="w-3.5 h-3.5" />
            </Button>
          )}
          {turma.turma_number != null && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Participantes e acompanhantes"
              aria-label="Participantes e acompanhantes"
              onClick={() => window.open(`/turma${turma.turma_number}`, "_blank", "noopener,noreferrer")}
            >
              <Users className="w-3.5 h-3.5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-3.5 h-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEnroll}>Agendar inscrição</DropdownMenuItem>
              <DropdownMenuItem disabled>Ver inscritos</DropdownMenuItem>
              <DropdownMenuItem disabled>Editar turma</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasFactory && (
        <div className="mb-3" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setFactoryOpen(true)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium hover:opacity-80 transition",
              STATUS_PILL[factoryVariant]
            )}
          >
            <Sparkles className="w-3 h-3" />
            Factory · {factoryLabel}
          </button>
        </div>
      )}

      {/* Title */}
      <h3 className="font-semibold text-foreground leading-snug mb-1 line-clamp-2">
        {formatTurmaNumber(turma.turma_number, turma.modality) && (
          <span className="inline-flex items-center gap-1 mr-2 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold align-middle">
            {formatTurmaNumber(turma.turma_number, turma.modality)}
          </span>
        )}
        {turma.course_title || "Sem curso"} <span className="text-muted-foreground font-normal">— {turma.label}</span>
      </h3>
      <p className="text-xs text-muted-foreground mb-1">{subtitleParts.join(" · ")}</p>
      <p className="text-xs text-muted-foreground/80 mb-4 flex items-center gap-1">
        {turma.modality === "presencial"
          ? <MapPin className="w-3 h-3" />
          : <Video className="w-3 h-3" />}
        {dateLine}
      </p>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t">
        <Metric label="Vagas" value={turma.slots} />
        <Metric
          label="Inscritos"
          value={turma.enrolled_count}
          hint={companionCount > 0 ? `+${companionCount} acomp.` : undefined}
        />
        <Metric
          label="Ocupação"
          value={lotado ? "Lotado" : `${pct}%`}
          valueClassName={lotado ? "text-rose-600 dark:text-rose-400" : pctColor}
        />
      </div>

      {driveFolderId && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span>{mediaCounts.fotos} fotos</span>
          <span>·</span>
          <span>{mediaCounts.videos} vídeos</span>
          <span>·</span>
          <span>{mediaCounts.depoimentos} depoimentos</span>
          {semDepoimento > 0 && (
            <span className="text-amber-600 dark:text-amber-400">· {semDepoimento} sem depoimento</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2 flex-wrap">
        {turma.instructor_name ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <User className="w-3 h-3 shrink-0" />
            {turma.instructor_name}
          </span>
        ) : <span />}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <GerarDocButton turmaId={turma.id} turmaLabel={turma.label} />
          <BoasVindasButton turmaNumber={turma.turma_number ?? null} />
          <CriarPastaDriveButton
            turmaId={turma.id}
            folderUrl={driveFolderUrl}
            onCreated={(url) => {
              setDriveFolderUrl(url);
              const m = url.match(/\/folders\/([^/?#]+)/);
              if (m) setDriveFolderId(m[1]);
            }}
          />
          <UploadMidiasDriveButton
            turmaId={turma.id}
            turmaNumber={turma.turma_number ?? null}
            turmaLabel={turma.label}
            courseTitle={turma.course_title}
            startDate={turma.start_date}
            endDate={turma.end_date}
            folderId={driveFolderId}
            folderUrl={driveFolderUrl}
          />
          <GerarCrachasButton turmaId={turma.id} turmaLabel={turma.label} />
          <CreateTurmaWaGroupButton
            turmaId={turma.id}
            group={effectiveWaGroup}
            checking={waChecking}
            onCreated={refetchWaGroup}
          />
          <AddTurmaToWaGroupButton
            turmaId={turma.id}
            group={effectiveWaGroup}
            checking={waChecking}
          />
          <Button
            size="sm"
            variant={lotado ? "secondary" : "default"}
            disabled={lotado}
            onClick={(e) => { e.stopPropagation(); onEnroll(); }}
          >
            {lotado ? "Sem vagas" : "Agendar"}
          </Button>
        </div>
      </div>

      {hasFactory && (
        <div onClick={(e) => e.stopPropagation()}>
          <TurmaFactoryDialog
            open={factoryOpen}
            onOpenChange={setFactoryOpen}
            turmaId={turma.id}
            turmaLabel={turma.label}
            factoryStatus={turma.factory_status as any}
          />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, hint, valueClassName }: { label: string; value: React.ReactNode; hint?: string; valueClassName?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={cn("text-2xl font-semibold leading-tight", valueClassName)}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}