import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, MapPin, Video, User, Clock } from "lucide-react";
import { formatDatePtBr } from "@/lib/courseUtils";
import { cn } from "@/lib/utils";

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  online_ao_vivo: "Online ao Vivo",
  online: "Online",
  hibrido: "Híbrido",
  gravado: "Gravado",
};

type PublicTurma = {
  id: string;
  label: string;
  slots: number;
  enrolled_count: number;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
};

type PublicCourse = {
  id: string;
  title: string;
  slug: string;
  modality: string;
  category?: string | null;
  instructor_name?: string | null;
  cover_image_url?: string | null;
  location?: string | null;
  meeting_link?: string | null;
  duration_days?: number | null;
  turmas: PublicTurma[];
};

export default function EmbedTrainings() {
  // Notify parent (when iframed) of content height so the host can auto-resize.
  useEffect(() => {
    const post = () => {
      try {
        const h = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        );
        window.parent?.postMessage(
          { type: "smartdent:embed:treinamentos:height", height: h },
          "*"
        );
      } catch {}
    };
    post();
    window.addEventListener("load", post);
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    // Fallback polling caso o host bloqueie ResizeObserver/imagens carreguem depois
    const interval = window.setInterval(post, 1000);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", post);
      window.clearInterval(interval);
    };
  }, []);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["public_courses_embed"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("smartops_courses")
        .select(`
          id, title, slug, modality, category, instructor_name,
          cover_image_url, location, meeting_link, duration_days,
          turmas:smartops_course_turmas (
            id, label, slots, enrolled_count, active, sort_order,
            days:smartops_turma_days (day_number, date, start_time, end_time)
          )
        `)
        .eq("active", true)
        .eq("public_visible", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      return ((data ?? []) as any[])
        .map((c) => {
          const turmas = (c.turmas ?? [])
            .filter((t: any) => t.active !== false)
            .map((t: any) => {
              const days = (t.days ?? []).sort((a: any, b: any) => a.day_number - b.day_number);
              return {
                id: t.id,
                label: t.label,
                slots: t.slots,
                enrolled_count: t.enrolled_count,
                start_date: days[0]?.date,
                start_time: days[0]?.start_time,
                end_date: days[days.length - 1]?.date,
                end_time: days[days.length - 1]?.end_time,
              } as PublicTurma;
            })
            .filter((t: PublicTurma) => !t.end_date || t.end_date >= today)
            .sort((a: PublicTurma, b: PublicTurma) => (a.start_date || "").localeCompare(b.start_date || ""));
          return { ...c, turmas } as PublicCourse;
        })
        .filter((c: PublicCourse) => c.turmas.length > 0);
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Próximos Treinamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Confira nossos cursos e imersões com vagas abertas.
          </p>
        </header>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando...</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum treinamento disponível no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((c) => (
              <CoursePublicCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CoursePublicCard({ course }: { course: PublicCourse }) {
  const nextTurma = course.turmas[0];
  const totalVagas = useMemo(
    () => course.turmas.reduce((s, t) => s + Math.max(t.slots - t.enrolled_count, 0), 0),
    [course.turmas]
  );

  const subtitle = [
    MODALITY_LABEL[course.modality] || course.modality,
    course.duration_days ? `${course.duration_days} ${course.duration_days === 1 ? "dia" : "dias"}` : null,
    course.modality === "presencial" ? course.location : (course.meeting_link ? "Online" : null),
  ].filter(Boolean).join(" · ");

  return (
    <article className="bg-card border rounded-xl overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
      {course.cover_image_url ? (
        <div className="aspect-[16/9] bg-muted overflow-hidden">
          <img src={course.cover_image_url} alt={course.title} className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="aspect-[16/9] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
          <CalendarDays className="w-10 h-10 text-primary/40" />
        </div>
      )}

      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <h2 className="font-semibold text-lg leading-tight line-clamp-2">{course.title}</h2>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>

        {course.instructor_name && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <User className="w-3 h-3" /> {course.instructor_name}
          </p>
        )}

        <div className="space-y-1.5 border-t pt-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Próximas turmas</div>
          {course.turmas.slice(0, 3).map((t) => (
            <div key={t.id} className="flex items-center justify-between text-xs gap-2">
              <span className="flex items-center gap-1.5 text-foreground/90 truncate">
                {course.modality === "presencial" ? <MapPin className="w-3 h-3 shrink-0" /> : <Video className="w-3 h-3 shrink-0" />}
                <span className="truncate">
                  {t.start_date ? formatDatePtBr(t.start_date) : t.label}
                  {t.end_date && t.end_date !== t.start_date && ` – ${formatDatePtBr(t.end_date)}`}
                </span>
              </span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                (t.slots - t.enrolled_count) <= 0
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              )}>
                {(t.slots - t.enrolled_count) <= 0 ? "Lotado" : `${t.slots - t.enrolled_count} vagas`}
              </span>
            </div>
          ))}
          {course.turmas.length > 3 && (
            <div className="text-[10px] text-muted-foreground">+ {course.turmas.length - 3} outras datas</div>
          )}
        </div>

        <div className="mt-auto pt-3 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {totalVagas > 0 ? `${totalVagas} vagas disponíveis` : "Sem vagas"}
          </span>
          <a
            href={`https://wa.me/5511933221001?text=${encodeURIComponent(`Olá! Tenho interesse no treinamento: ${course.title}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90 transition"
          >
            Quero participar
          </a>
        </div>
      </div>
    </article>
  );
}