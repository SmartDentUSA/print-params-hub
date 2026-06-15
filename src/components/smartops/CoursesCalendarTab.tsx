import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  startOfDay, endOfDay, addDays, addMonths, addWeeks,
  format, isSameDay, isSameMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourseCreateModal } from "./CourseCreateModal";
import type { SmartopsCourse, TurmaComVagas } from "@/types/courses";

type ViewMode = "month" | "week" | "day";
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function turmaDate(t: TurmaComVagas): Date | null {
  const d = t.start_date;
  if (!d) return null;
  const time = (t.start_time || "09:00").substring(0, 5);
  return new Date(`${d}T${time}:00`);
}

function statusOf(t: TurmaComVagas): { label: string; cls: string } {
  const start = turmaDate(t);
  if (!start) return { label: "Sem data", cls: "bg-muted text-muted-foreground" };
  const endDateStr = t.end_date ?? t.start_date!;
  const endTime = (t.end_time || "18:00").substring(0, 5);
  const end = new Date(`${endDateStr}T${endTime}:00`);
  const now = Date.now();
  if (now >= end.getTime()) return { label: "Realizado", cls: "bg-slate-200 text-slate-700 border-slate-300" };
  if (now >= start.getTime()) return { label: "Acontecendo", cls: "bg-blue-100 text-blue-800 border-blue-200" };
  return { label: "Agendado", cls: "bg-green-100 text-green-800 border-green-200" };
}

export function CoursesCalendarTab() {
  const [mode, setMode] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [editCourse, setEditCourse] = useState<SmartopsCourse | null>(null);
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);

  const range = useMemo(() => {
    if (mode === "month") {
      return {
        from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
        to: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
      };
    }
    if (mode === "week") {
      return {
        from: startOfWeek(cursor, { weekStartsOn: 0 }),
        to: endOfWeek(cursor, { weekStartsOn: 0 }),
      };
    }
    return { from: startOfDay(cursor), to: endOfDay(cursor) };
  }, [cursor, mode]);

  const { data: turmas = [], isLoading } = useQuery({
    queryKey: ["calendar_turmas", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_turmas_com_vagas")
        .select("*")
        .gte("start_date", format(range.from, "yyyy-MM-dd"))
        .lte("start_date", format(range.to, "yyyy-MM-dd"))
        .order("start_date");
      if (error) throw error;
      return (data ?? []) as TurmaComVagas[];
    },
  });

  const byDay = useMemo(() => {
    const m = new Map<string, TurmaComVagas[]>();
    for (const t of turmas) {
      const d = turmaDate(t);
      if (!d) continue;
      const key = format(d, "yyyy-MM-dd");
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    }
    return m;
  }, [turmas]);

  const openEdit = async (courseId?: string) => {
    if (!courseId) return;
    setLoadingCourseId(courseId);
    try {
      const { data, error } = await (supabase as any)
        .from("smartops_courses")
        .select("*, turmas:smartops_course_turmas(*, days:smartops_turma_days(*))")
        .eq("id", courseId)
        .maybeSingle();
      if (error) throw error;
      if (data) setEditCourse(data as SmartopsCourse);
    } finally {
      setLoadingCourseId(null);
    }
  };

  const navPrev = () => {
    if (mode === "month") setCursor((d) => addMonths(d, -1));
    else if (mode === "week") setCursor((d) => addWeeks(d, -1));
    else setCursor((d) => addDays(d, -1));
  };
  const navNext = () => {
    if (mode === "month") setCursor((d) => addMonths(d, 1));
    else if (mode === "week") setCursor((d) => addWeeks(d, 1));
    else setCursor((d) => addDays(d, 1));
  };

  const headerLabel = useMemo(() => {
    if (mode === "month") return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
    if (mode === "week") {
      const ws = startOfWeek(cursor, { weekStartsOn: 0 });
      const we = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(ws, "d MMM", { locale: ptBR })} – ${format(we, "d MMM yyyy", { locale: ptBR })}`;
    }
    return format(cursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  }, [cursor, mode]);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navPrev}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
            <Button variant="outline" size="icon" onClick={navNext}><ChevronRight className="w-4 h-4" /></Button>
            <h2 className="text-lg font-semibold ml-2 capitalize">{headerLabel}</h2>
          </div>
          <div className="inline-flex rounded-md border bg-card">
            {(["month", "week", "day"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-sm ${mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {m === "month" ? "Mês" : m === "week" ? "Semana" : "Dia"}
              </button>
            ))}
          </div>
        </div>

        {mode === "month" && <MonthGrid cursor={cursor} byDay={byDay} onClick={openEdit} loadingCourseId={loadingCourseId} />}
        {mode === "week" && <WeekGrid cursor={cursor} byDay={byDay} onClick={openEdit} loadingCourseId={loadingCourseId} />}
        {mode === "day" && <DayList date={cursor} items={byDay.get(format(cursor, "yyyy-MM-dd")) ?? []} onClick={openEdit} loadingCourseId={loadingCourseId} />}

        {isLoading && <div className="text-center text-sm text-muted-foreground py-2">Carregando…</div>}
        {!isLoading && turmas.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-6 flex flex-col items-center gap-2">
            <CalendarDays className="w-8 h-8 opacity-50" />
            Nenhum treinamento neste período.
          </div>
        )}
      </Card>

      {editCourse && (
        <CourseCreateModal
          open={!!editCourse}
          course={editCourse}
          onClose={() => setEditCourse(null)}
        />
      )}
    </div>
  );
}

// ─── Month grid ───
function MonthGrid({ cursor, byDay, onClick, loadingCourseId }: {
  cursor: Date; byDay: Map<string, TurmaComVagas[]>;
  onClick: (id?: string) => void; loadingCourseId: string | null;
}) {
  const days = useMemo(() => {
    const from = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const to = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const arr: Date[] = [];
    let d = from;
    while (d <= to) { arr.push(d); d = addDays(d, 1); }
    return arr;
  }, [cursor]);

  return (
    <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-md overflow-hidden">
      {WEEKDAYS.map((w) => (
        <div key={w} className="bg-muted/50 py-1.5 text-xs font-medium text-center text-muted-foreground">{w}</div>
      ))}
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const items = byDay.get(key) ?? [];
        const inMonth = isSameMonth(d, cursor);
        const today = isSameDay(d, new Date());
        return (
          <div key={key} className={`bg-card min-h-[110px] p-1.5 ${inMonth ? "" : "opacity-50"}`}>
            <div className={`text-xs mb-1 ${today ? "font-bold text-primary" : "text-muted-foreground"}`}>
              {format(d, "d")}
            </div>
            <div className="space-y-1">
              {items.slice(0, 3).map((t) => <EventChip key={t.id} t={t} onClick={onClick} loading={loadingCourseId === (t as any).course_id} />)}
              {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Week grid ───
function WeekGrid({ cursor, byDay, onClick, loadingCourseId }: {
  cursor: Date; byDay: Map<string, TurmaComVagas[]>;
  onClick: (id?: string) => void; loadingCourseId: string | null;
}) {
  const days = useMemo(() => {
    const from = startOfWeek(cursor, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(from, i));
  }, [cursor]);

  return (
    <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-md overflow-hidden">
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const items = byDay.get(key) ?? [];
        const today = isSameDay(d, new Date());
        return (
          <div key={key} className="bg-card min-h-[280px] p-2">
            <div className={`text-xs mb-2 ${today ? "font-bold text-primary" : "text-muted-foreground"}`}>
              <div>{WEEKDAYS[d.getDay()]}</div>
              <div className="text-base">{format(d, "d/MM")}</div>
            </div>
            <div className="space-y-1.5">
              {items.map((t) => <EventChip key={t.id} t={t} onClick={onClick} loading={loadingCourseId === (t as any).course_id} expanded />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Day list ───
function DayList({ date, items, onClick, loadingCourseId }: {
  date: Date; items: TurmaComVagas[];
  onClick: (id?: string) => void; loadingCourseId: string | null;
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
    [items]
  );
  return (
    <div className="space-y-2">
      {sorted.map((t) => {
        const st = statusOf(t);
        const cid = (t as any).course_id as string | undefined;
        return (
          <button
            key={t.id}
            onClick={() => onClick(cid)}
            disabled={loadingCourseId === cid}
            className="w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition flex items-center gap-3"
          >
            <div className="w-20 text-sm font-mono text-muted-foreground">
              {(t.start_time || "").substring(0, 5) || "--:--"}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{(t as any).course_title || t.label}</div>
              <div className="text-xs text-muted-foreground">
                Turma: {t.label} · Vagas: {t.vagas_disponiveis ?? "—"} / {t.slots ?? "—"}
              </div>
            </div>
            <Badge variant="outline" className={st.cls}>{st.label}</Badge>
          </button>
        );
      })}
    </div>
  );
}

// ─── Event chip ───
function EventChip({ t, onClick, loading, expanded }: {
  t: TurmaComVagas; onClick: (id?: string) => void; loading: boolean; expanded?: boolean;
}) {
  const st = statusOf(t);
  const cid = (t as any).course_id as string | undefined;
  const title = (t as any).course_title || t.label;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(cid); }}
      disabled={loading}
      className={`w-full text-left text-[11px] rounded px-1.5 py-1 border truncate ${st.cls} hover:opacity-80 transition disabled:opacity-50`}
      title={`${title} — ${t.label}`}
    >
      <div className="font-medium truncate">{title}</div>
      {expanded && (
        <div className="text-[10px] opacity-80 truncate">
          {(t.start_time || "").substring(0, 5)} · {t.label}
        </div>
      )}
    </button>
  );
}