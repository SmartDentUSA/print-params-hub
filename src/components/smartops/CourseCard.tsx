import React from "react";
import { MoreVertical, User, Repeat, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SmartopsCourse } from "@/types/courses";

const STATUS_DOT: Record<string, string> = {
  ativo: "bg-emerald-500",
  rascunho: "bg-amber-500",
  privado: "bg-muted-foreground/60",
};
const STATUS_PILL: Record<string, string> = {
  ativo: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  rascunho: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  privado: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  rascunho: "Inativo",
  privado: "Privado",
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
  course: SmartopsCourse;
  onEdit: () => void;
  onTogglePublic: () => void;
  onToggleActive: () => void;
  onClone: () => void;
  onDelete: () => void;
}

export function CourseCard({ course, onEdit, onTogglePublic, onToggleActive, onClone, onDelete }: Props) {
  const turmas = (course.turmas ?? []) as any[];
  const totalSlots = turmas.reduce((s, t) => s + (t.slots || 0), 0);
  const totalEnrolled = turmas.reduce((s, t) => s + (t.enrolled_count || 0), 0);
  const occMedia = totalSlots > 0 ? Math.round((totalEnrolled / totalSlots) * 100) : 0;

  const status =
    !course.active ? "rascunho"
    : !course.public_visible ? "privado"
    : "ativo";

  const pctColor =
    occMedia >= 100 ? "text-rose-600 dark:text-rose-400"
    : occMedia >= 60 ? "text-emerald-600 dark:text-emerald-400"
    : occMedia >= 30 ? "text-amber-600 dark:text-amber-400"
    : "text-muted-foreground";

  const subtitleParts = [
    MODALITY_LABEL[course.modality] || course.modality,
    course.duration_days ? `${course.duration_days} ${course.duration_days === 1 ? "dia" : "dias"}` : null,
    course.recurrence_enabled ? "Recorrente" : null,
  ].filter(Boolean);

  return (
    <div
      className="group relative bg-card border rounded-xl p-5 transition-all hover:shadow-md hover:border-primary/30 cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", STATUS_PILL[status])}>
          <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status])} />
          {STATUS_LABEL[status]}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Clonar curso"
            onClick={onClone}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-3.5 h-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>Editar curso</DropdownMenuItem>
              <DropdownMenuItem onClick={onClone}>Clonar curso</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onToggleActive}>
                {course.active ? "Marcar como inativo" : "Ativar curso"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTogglePublic}>
                {course.public_visible ? "Tornar privado" : "Tornar público"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                disabled={totalEnrolled > 0}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                {totalEnrolled > 0 ? `Excluir (${totalEnrolled} inscrito${totalEnrolled !== 1 ? "s" : ""})` : "Excluir curso"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {course.cover_image_url ? (
        <div className="w-full h-24 rounded-md overflow-hidden mb-3 bg-muted">
          <img src={course.cover_image_url} alt={course.title} className="w-full h-full object-cover" />
        </div>
      ) : null}

      <h3 className="font-semibold text-foreground leading-snug mb-1 line-clamp-2">{course.title}</h3>
      <p className="text-xs text-muted-foreground mb-4">{subtitleParts.join(" · ")}</p>

      <div className="grid grid-cols-3 gap-3 pt-3 border-t">
        <Metric label="Turmas" value={turmas.length} />
        <Metric label="Inscritos" value={totalEnrolled} />
        <Metric label="Ocupação" value={`${occMedia}%`} valueClassName={pctColor} />
      </div>

      <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {course.instructor_name ? <><User className="w-3 h-3" /> {course.instructor_name}</> : "Sem instrutor"}
        </span>
        {course.recurrence_enabled && (
          <span className="flex items-center gap-1"><Repeat className="w-3 h-3" /> Recorrente</span>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, valueClassName }: { label: string; value: React.ReactNode; valueClassName?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={cn("text-2xl font-semibold leading-tight", valueClassName)}>{value}</div>
    </div>
  );
}