import React from "react";
import { MapPin, Video, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TurmaComVagas } from "@/types/courses";
import { formatDatePtBr } from "@/lib/courseUtils";
import { GerarDocButton } from "@/components/GerarDocButton";
import { GerarCrachasButton } from "@/components/GerarCrachasButton";
import { AddTurmaToWaGroupButton } from "@/components/smartops/AddTurmaToWaGroupButton";
import { CreateTurmaWaGroupButton } from "@/components/smartops/CreateTurmaWaGroupButton";
import { useTurmaWaGroup } from "@/hooks/useTurmaWaGroup";
import { formatTurmaNumber } from "@/lib/turmaNumber";

type Variant = "green" | "amber" | "red" | "blue" | "muted";

const STATUS_DOT: Record<Variant, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  blue: "bg-sky-500 animate-pulse",
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
};

interface Props {
  turma: TurmaComVagas;
  companionCount: number;
  status: { label: string; variant: Variant } | null;
  onEnroll: () => void;
}

export function TurmaListRow({ turma, companionCount, status, onEnroll }: Props) {
  const pct = turma.slots > 0 ? Math.round((turma.enrolled_count / turma.slots) * 100) : 0;
  const lotado = (turma.vagas_disponiveis ?? 0) === 0;
  const isMuted = status?.variant === "muted";
  const { group: waGroup, loading: waChecking, refetch: refetchWaGroup } = useTurmaWaGroup(turma.id);
  const effectiveWaGroup = waGroup ?? (turma.whatsapp_group_link
    ? { id: "link-only", nome: null }
    : null);

  const pctColor =
    pct >= 100 ? "text-rose-600 dark:text-rose-400"
    : pct >= 60 ? "text-emerald-600 dark:text-emerald-400"
    : pct >= 30 ? "text-amber-600 dark:text-amber-400"
    : "text-muted-foreground";

  const dateLine = turma.start_date
    ? turma.end_date && turma.end_date !== turma.start_date
      ? `${formatDatePtBr(turma.start_date)} – ${formatDatePtBr(turma.end_date)}`
      : formatDatePtBr(turma.start_date)
    : turma.label;

  const turmaNum = formatTurmaNumber(turma.turma_number, turma.modality);
  const localLine = turma.modality === "presencial"
    ? turma.location
    : (turma.meeting_link ? "Link online" : "—");

  return (
    <TableRow
      className={cn("cursor-pointer", isMuted && "opacity-60")}
      onClick={onEnroll}
    >
      <TableCell>
        {status && (
          <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", STATUS_PILL[status.variant])}>
            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status.variant])} />
            {status.label}
          </span>
        )}
      </TableCell>
      <TableCell className="max-w-[280px]">
        <div className="flex items-start gap-2">
          {turmaNum && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold">
              {turmaNum}
            </span>
          )}
          <div className="min-w-0">
            <div className="font-medium text-sm leading-tight truncate">{turma.course_title || "Sem curso"}</div>
            <div className="text-xs text-muted-foreground truncate">{turma.label}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex items-center gap-1.5 text-xs">
          {turma.modality === "presencial"
            ? <MapPin className="w-3 h-3 shrink-0 text-muted-foreground" />
            : <Video className="w-3 h-3 shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <div>{MODALITY_LABEL[turma.modality || "presencial"]}</div>
            <div className="text-muted-foreground truncate">{localLine}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell text-xs whitespace-nowrap">
        {dateLine}
        {turma.total_days ? (
          <div className="text-muted-foreground">{turma.total_days} {turma.total_days === 1 ? "dia" : "dias"}</div>
        ) : null}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="font-medium">{turma.enrolled_count}/{turma.slots}</span>
          <span className={cn("font-semibold", pctColor)}>{lotado ? "Lotado" : `${pct}%`}</span>
        </div>
        {companionCount > 0 && (
          <div className="text-[10px] text-muted-foreground">+{companionCount} acomp.</div>
        )}
      </TableCell>
      <TableCell className="hidden xl:table-cell">
        {turma.instructor_name ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <User className="w-3 h-3 shrink-0" />
            {turma.instructor_name}
          </span>
        ) : <span className="text-muted-foreground text-xs">—</span>}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <GerarDocButton turmaId={turma.id} turmaLabel={turma.label} />
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
      </TableCell>
    </TableRow>
  );
}