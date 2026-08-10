export type CourseStatusVariant = "green" | "amber" | "red" | "blue" | "muted";

export interface CourseStatusBadge {
  label: string;
  variant: CourseStatusVariant;
  cls: string;
}

export const COURSE_STATUS_CLS: Record<CourseStatusVariant, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  red: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  blue: "bg-blue-50 text-blue-700 border-blue-200 animate-pulse dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  muted: "bg-muted text-muted-foreground border-transparent",
};

/**
 * Mesma régua usada na aba de Treinamentos (SmartOpsCourses):
 * finalizado → acontecendo agora → inscrições encerradas/abertas.
 */
export function getCourseStatusBadge(input: {
  start_date?: string | null;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  modality?: string | null;
  status?: string | null;
  now?: number;
}): CourseStatusBadge {
  const mk = (label: string, variant: CourseStatusVariant): CourseStatusBadge => ({
    label,
    variant,
    cls: COURSE_STATUS_CLS[variant],
  });

  if (input.status === "encerrado") return mk("Finalizado", "muted");
  if (!input.start_date) {
    if (input.status === "publicado") return mk("Inscrições abertas", "green");
    return mk("Sem data", "muted");
  }

  const now = input.now ?? Date.now();
  const sTime = (input.start_time || "09:00").substring(0, 5);
  const eDate = input.end_date || input.start_date;
  const eTime = (input.end_time || "18:00").substring(0, 5);
  const startMs = new Date(`${input.start_date}T${sTime}:00`).getTime();
  const endMs = new Date(`${eDate}T${eTime}:00`).getTime();
  if (isNaN(startMs)) return mk("Sem data", "muted");

  if (now >= endMs) return mk("Finalizado", "muted");
  if (now >= startMs) return mk("Acontecendo agora", "blue");

  const daysUntil = Math.ceil((startMs - now) / 86400000);
  if (input.status && input.status !== "publicado") return mk("Inscrições fechadas", "red");
  if (daysUntil <= 3) return mk("Inscrições encerradas", "red");
  if (daysUntil <= 7) return mk(`Faltam ${daysUntil} dias para encerrar inscrições`, "amber");
  return mk("Inscrições abertas", "green");
}
