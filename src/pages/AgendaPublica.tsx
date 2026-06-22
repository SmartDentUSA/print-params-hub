import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, MapPin, User, RefreshCw, Share2, Clock, Timer, Radio } from "lucide-react";
import { formatDatePtBr, formatWeekday } from "@/lib/courseUtils";
import { formatTurmaNumber } from "@/lib/turmaNumber";
import { cn } from "@/lib/utils";
import type { TurmaComVagas } from "@/types/courses";

type AgendaVariant = "presencial" | "online";

const publicPageStyles = `
  .pp-root {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: #1C1E23;
    background: #EEF1F6;
  }
  .pp-root h1, .pp-root h2, .pp-root h3 { color: #1C1E23; }
  .pp-root .pp-header h1 { font-size: 24px; font-weight: 600; margin: 0 0 5px; letter-spacing: -0.01em; }
  .pp-root .pp-header p  { font-size: 14px; color: #5F6368; margin: 0; }
  .pp-root .pp-refresh {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11px; color: #5F6368;
    border: 1px solid rgba(0,0,0,0.13); background: #FFFFFF;
    border-radius: 999px; padding: 4px 10px; transition: all 0.15s;
  }
  .pp-root .pp-refresh:hover { border-color: #1A73E8; color: #1A73E8; }
  .pp-root .pp-card {
    background: #FFFFFF !important;
    border: 1px solid rgba(0,0,0,0.07) !important;
    border-radius: 14px !important;
    box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
    transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
  }
  .pp-root .pp-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 28px rgba(0,0,0,.13);
    border-color: rgba(26,115,232,0.20) !important;
  }
  .pp-root .pp-empty {
    background: #FFFFFF; border: 1px solid rgba(0,0,0,0.07);
    border-radius: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.06);
    padding: 60px 24px; text-align: center; color: #9AA0A6;
  }
  .pp-root ::-webkit-scrollbar { width: 5px; }
  .pp-root ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.13); border-radius: 3px; }
`;

const VARIANT_CONFIG: Record<AgendaVariant, {
  title: string;
  subtitle: string;
  canonical: string;
  metaDescription: string;
  modalities: string[];
  categories: string[];
  emptyLabel: string;
}> = {
  presencial: {
    title: "Próximos Treinamentos Presenciais",
    subtitle: "Confira nossos treinamentos e imersões presenciais com vagas abertas.",
    canonical: "https://parametros.smartdent.com.br/agenda",
    metaDescription: "Agenda de treinamentos e imersões presenciais Smart Dent com vagas abertas.",
    modalities: ["presencial"],
    categories: ["treinamento", "imersao"],
    emptyLabel: "Nenhum treinamento presencial disponível no momento.",
  },
  online: {
    title: "Próximos Cursos Online",
    subtitle: "Workshops e webinars ao vivo da Smart Dent com inscrições abertas.",
    canonical: "https://parametros.smartdent.com.br/agenda/online",
    metaDescription: "Agenda de workshops e webinars online Smart Dent com vagas abertas.",
    modalities: ["online_ao_vivo", "online"],
    categories: ["workshop", "webinar"],
    emptyLabel: "Nenhum curso online disponível no momento.",
  },
};

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  online_ao_vivo: "Online ao Vivo",
  online: "Online",
  hibrido: "Híbrido",
  gravado: "Gravado",
};

type Variant = "green" | "amber" | "red" | "blue" | "muted";
type CountdownResult = { label: string; variant: Variant } | null;

function useCountdown(tickMs = 60_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return (startDate?: string, startTime?: string, endDate?: string, endTime?: string, modality?: string): CountdownResult => {
    if (!startDate) return null;
    const sTime = startTime?.substring(0, 5) ?? "09:00";
    const eDate = endDate ?? startDate;
    const eTime = endTime?.substring(0, 5) ?? "18:00";
    const startMs = new Date(`${startDate}T${sTime}:00`).getTime();
    const endMs = new Date(`${eDate}T${eTime}:00`).getTime();
    const diffStart = startMs - now;
    const daysUntil = Math.ceil(diffStart / 86400000);
    if (now >= endMs) return { label: "Curso realizado", variant: "muted" };
    if (now >= startMs) return { label: "Acontecendo agora", variant: "blue" };
    if (modality === "presencial") {
      if (daysUntil <= 3) return { label: "Inscrições encerradas", variant: "red" };
      if (daysUntil <= 7) return { label: `Faltam ${daysUntil} dias para encerrar inscrições`, variant: "amber" };
      return { label: "Inscrições abertas", variant: "green" };
    }
    const d = Math.floor(diffStart / 86400000);
    const h = Math.floor((diffStart % 86400000) / 3600000);
    const m = Math.floor((diffStart % 3600000) / 60000);
    return { label: `${d}d ${h}h ${m}m`, variant: "green" };
  };
}

/** Timer ao vivo (ticka a cada 1s) exibido junto ao status para criar urgência. */
function LiveCountdown({ startDate, startTime }: { startDate?: string; startTime?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!startDate) return null;
  const sTime = startTime?.substring(0, 5) ?? "09:00";
  const startMs = new Date(`${startDate}T${sTime}:00`).getTime();
  const diff = startMs - now;
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-foreground/5 text-foreground border tabular-nums">
      ⏱ {d > 0 ? `${d}d ` : ""}{pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}

/** Versão inline (sem wrapper) — usada dentro da pill de status para mostrar a contagem regressiva ao vivo. */
function LiveCountdownInline({ startDate, startTime, fallback }: { startDate?: string; startTime?: string; fallback: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!startDate) return <>{fallback}</>;
  const sTime = startTime?.substring(0, 5) ?? "09:00";
  const startMs = new Date(`${startDate}T${sTime}:00`).getTime();
  const diff = startMs - Date.now();
  void now;
  if (diff <= 0) return <>{fallback}</>;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return <>{d > 0 ? `${d}d ` : ""}{pad(h)}:{pad(m)}:{pad(s)}</>;
}

interface AgendaPublicaProps {
  variant?: AgendaVariant;
}

export default function AgendaPublica({ variant = "presencial" }: AgendaPublicaProps) {
  const config = VARIANT_CONFIG[variant];
  const queryClient = useQueryClient();
  const getCountdown = useCountdown();

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

  // Realtime + reconexão + invalidação ao voltar para a aba
  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["public_agenda_turmas"] });
      queryClient.invalidateQueries({ queryKey: ["public_agenda_courses"] });
    };

    let channel: any = null;
    let retryTimer: number | null = null;
    let retryAttempt = 0;

    const subscribe = () => {
      channel = (supabase as any)
        .channel(`agenda-publica-realtime-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "smartops_courses" }, (p: any) => { console.log("[agenda-realtime] courses", p?.eventType); invalidate(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "smartops_course_turmas" }, (p: any) => { console.log("[agenda-realtime] turmas", p?.eventType); invalidate(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "smartops_turma_days" }, (p: any) => { console.log("[agenda-realtime] days", p?.eventType); invalidate(); })
        .subscribe((status: string) => {
          console.log("[agenda-realtime]", status);
          if (status === "SUBSCRIBED") {
            retryAttempt = 0;
            invalidate();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (retryTimer) window.clearTimeout(retryTimer);
            const delay = Math.min(30_000, 2_000 * Math.pow(2, retryAttempt++));
            retryTimer = window.setTimeout(() => {
              try { (supabase as any).removeChannel(channel); } catch {}
              subscribe();
            }, delay);
          }
        });
    };

    subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    const onFocus = () => invalidate();
    const onMessage = (e: MessageEvent) => {
      const data: any = e?.data;
      if (data && typeof data === "object" && data.type === "smartdent:embed:treinamentos:refresh") {
        invalidate();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("message", onMessage);

    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("message", onMessage);
      try { (supabase as any).removeChannel(channel); } catch {}
    };
  }, [queryClient]);

  // Cursos elegíveis filtrados por modalidade + categoria desta variante.
  const { data: publicCourseIds = [] } = useQuery({
    queryKey: ["public_agenda_courses", variant],
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("smartops_courses")
        .select("id, modality, category")
        .eq("active", true)
        .in("modality", config.modalities)
        .in("category", config.categories);
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => c.id as string);
    },
  });

  // Turmas (mesma fonte do admin: v_turmas_com_vagas)
  const { data: allTurmas = [], isLoading, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["public_agenda_turmas", variant],
    refetchOnWindowFocus: true,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_turmas_com_vagas")
        .select("*")
        .eq("active", true)
        .in("modality", config.modalities)
        .order("start_date");
      if (error) throw error;
      return data as TurmaComVagas[];
    },
  });

  const turmas = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const allowed = new Set(publicCourseIds);
    return allTurmas
      .filter((t) => allowed.has(t.course_id))
      .filter((t) => !t.end_date || t.end_date >= today)
      .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
  }, [allTurmas, publicCourseIds]);

  // Para Online ao Vivo / Online: 1 card por curso, com todas as turmas dentro.
  const onlineCourseGroups = useMemo(() => {
    if (variant !== "online") return [];
    const map = new Map<string, TurmaComVagas[]>();
    for (const t of turmas) {
      const arr = map.get(t.course_id) || [];
      arr.push(t);
      map.set(t.course_id, arr);
    }
    return Array.from(map.entries())
      .map(([course_id, list]) => ({
        course_id,
        turmas: list.sort((a, b) => (a.start_date || "").localeCompare(b.start_date || "")),
      }))
      .sort((a, b) => (a.turmas[0]?.start_date || "").localeCompare(b.turmas[0]?.start_date || ""));
  }, [turmas, variant]);

  return (
    <div className="pp-root min-h-screen">
      <style>{publicPageStyles}</style>
      <Helmet>
        <title>{config.title} | Smart Dent</title>
        <meta name="description" content={config.metaDescription} />
        <link rel="canonical" href={config.canonical} />
      </Helmet>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="pp-header mb-8 text-center">
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
          <div className="flex items-center justify-center gap-3 mt-3">
            {dataUpdatedAt > 0 && (
              <FreshnessIndicator updatedAt={dataUpdatedAt} fetching={isFetching} />
            )}
            <button
              type="button"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["public_agenda_turmas", variant] });
                queryClient.invalidateQueries({ queryKey: ["public_agenda_courses", variant] });
              }}
              className="pp-refresh"
            >
              <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
              Atualizar agora
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="pp-empty">Carregando...</div>
        ) : turmas.length === 0 ? (
          <div className="pp-empty">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{config.emptyLabel}</p>
          </div>
        ) : variant === "online" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {onlineCourseGroups.map((g) => (
              <PublicOnlineCourseCard key={g.course_id} sessions={g.turmas} />
            ))}
          </div>
        ) : (
          <div className={cn(
            "grid grid-cols-1 gap-4",
            variant === "online"
              ? "md:grid-cols-2 xl:grid-cols-3"
              : "md:grid-cols-2 xl:grid-cols-3"
          )}>
            {turmas.map((t) => (
              <PublicTurmaCard
                key={t.id}
                turma={t}
                status={getCountdown(t.start_date, t.start_time, t.end_date, t.end_time, t.modality)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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

function PublicTurmaCard({ turma, status }: { turma: TurmaComVagas; status: CountdownResult }) {
  const pct = turma.slots > 0 ? Math.round((turma.enrolled_count / turma.slots) * 100) : 0;
  const lotado = (turma.vagas_disponiveis ?? Math.max(turma.slots - turma.enrolled_count, 0)) === 0;
  const isMuted = status?.variant === "muted";
  const turmaTag = formatTurmaNumber(turma.turma_number, turma.modality);
  const products = (turma as any).related_product_names as string[] | undefined;
  const isOnline = turma.modality === "online" || turma.modality === "online_ao_vivo";
  const coverUrl = (turma as any).cover_image_url as string | undefined;
  // Mostra o cronômetro ao vivo enquanto faltarem inscrições (verde) ou estiver na janela amarela.
  const showLiveTimer = !!status && (status.variant === "green" || status.variant === "amber");

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

  const hhmm = (t?: string | null) => (t ? t.substring(0, 5) : null);
  const startTime = hhmm(turma.start_time);
  const endTime = hhmm(turma.end_time);
  const endDateValue = turma.end_date ?? turma.start_date;

  return (
    <div className={cn("pp-card relative overflow-hidden flex flex-col min-h-[360px]", isMuted && "opacity-60")}>
      {coverUrl && (
        <div className="relative w-full aspect-[16/9] bg-muted overflow-hidden">
          <img
            src={coverUrl}
            alt={turma.course_title || "Curso"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {isOnline && <LiveBadge modality={turma.modality} className="absolute top-2 left-2" />}
          {turmaTag && (
            <span className="absolute top-2 right-2 inline-flex items-center px-1.5 py-0 rounded text-[9px] font-semibold bg-white/90 text-primary border border-primary/20 shadow-sm">
              Turma {turmaTag}
            </span>
          )}
        </div>
      )}
      <ShareButton turma={turma} />
      <div className="p-5 flex flex-col flex-1">
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {isOnline && !coverUrl && <LiveBadge modality={turma.modality} />}
        {status && isOnline && status.variant !== "muted" ? (
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold tabular-nums", STATUS_PILL[status.variant])}>
            <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", STATUS_DOT[status.variant])} />
            <LiveCountdownInline startDate={turma.start_date} startTime={turma.start_time} fallback={status.label} />
          </span>
        ) : status && (
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", STATUS_PILL[status.variant])}>
            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status.variant])} />
            {status.label}
          </span>
        )}
        {turmaTag && !coverUrl && (
          <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
            Turma {turmaTag}
          </span>
        )}
      </div>

      <h3 className="font-semibold text-foreground leading-snug mb-1 line-clamp-2">
        {turma.course_title || "Sem curso"} <span className="text-muted-foreground font-normal">— {turma.label}</span>
      </h3>
      {turma.modality === "presencial" && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{subtitleParts.join(" · ")}</span>
        </p>
      )}

      {isOnline ? (
        <OnlineDateRow
          startDate={turma.start_date}
          endDate={endDateValue}
          startTime={startTime}
          endTime={endTime}
          totalDays={turma.total_days}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 mb-4 rounded-lg border bg-muted/30 p-2.5">
          <DateBlock label="Início" date={turma.start_date} time={startTime} />
          <DateBlock label="Fim" date={endDateValue} time={endTime ?? startTime} />
        </div>
      )}

      {isOnline ? (
        <>
          <div className="flex items-end justify-between gap-3 pt-3 border-t mt-auto">
            <div className="flex flex-col gap-1.5 min-w-0">
              {products && products.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {products.slice(0, 4).map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60"
                      title={name}
                    >
                      {name}
                    </span>
                  ))}
                  {products.length > 4 && (
                    <span className="text-[10.5px] text-muted-foreground self-center">
                      +{products.length - 4}
                    </span>
                  )}
                </div>
              )}
              {turma.instructor_name && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground truncate">
                  <User className="w-4 h-4 shrink-0 text-muted-foreground" />
                  {turma.instructor_name}
                </span>
              )}
            </div>
            <div className="text-right shrink-0">
              <Metric label="Vagas" value={turma.slots} />
            </div>
          </div>

          {(() => {
            const publicEnabled = Boolean((turma as any).public_enrollment_enabled);
            const slug = (turma as any).course_slug as string | undefined;
            const externalUrl = (turma as any).signup_form_url as string | undefined;
            const href = publicEnabled && slug
              ? `/inscricao/${slug}`
              : externalUrl;
            if (!href) return null;
            const isInternal = href.startsWith('/');
            return (
              <div className="mt-4 flex justify-center">
                <a
                  href={href}
                  {...(isInternal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold uppercase tracking-wide hover:shadow-glow transition-smooth hover:scale-[1.02] active:scale-95"
                >
                  Inscreva-se
                </a>
              </div>
            );
          })()}
        </>
      ) : (
        <>
          {(() => {
            const restam = turma.vagas_disponiveis ?? Math.max(turma.slots - turma.enrolled_count, 0);
            const restamColor =
              restam <= 0
                ? 'text-rose-600 dark:text-rose-400'
                : restam <= 5
                ? 'text-amber-600 dark:text-amber-400'
                : undefined;
            return (
              <>
                <div className="grid grid-cols-4 gap-3 pt-3 border-t mt-auto">
                  <Metric label="Vagas" value={turma.slots} />
                  <Metric label="Inscritos" value={turma.enrolled_count} />
                  <Metric label="Acomp." value={(turma as any).companions_count ?? 0} />
                  <Metric label="Restam" value={restam} valueClassName={restamColor} />
                </div>
                {restam <= 0 && (
                  <div className="mt-3 text-center text-xs font-semibold text-rose-600 dark:text-rose-400">
                    Turma lotada
                  </div>
                )}
              </>
            );
          })()}

          {turma.instructor_name && (
            <div className="mt-3 pt-3 border-t">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <User className="w-3 h-3 shrink-0" />
                {turma.instructor_name}
              </span>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}

function DateBlock({ label, date, time }: { label: string; date?: string | null; time?: string | null }) {
  return DateBlockImpl({ label, date, time });
}

function PublicOnlineCourseCard({ sessions }: { sessions: TurmaComVagas[] }) {
  if (sessions.length === 0) return null;
  const first = sessions[0];
  const coverUrl = (first as any).cover_image_url as string | undefined;
  const products = (first as any).related_product_names as string[] | undefined;
  const slug = (first as any).course_slug as string | undefined;
  const publicEnabled = Boolean((first as any).public_enrollment_enabled);
  const externalUrl = (first as any).signup_form_url as string | undefined;
  const href = publicEnabled && slug ? `/inscricao/${slug}` : externalUrl;
  const isInternal = href?.startsWith("/");

  // Próxima sessão (mais perto de hoje) para o cronômetro destacado.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sessions.find((s) => (s.start_date || "") >= today) || first;
  const upcomingStatus = getCountdown(
    upcoming.start_date, upcoming.start_time,
    upcoming.end_date, upcoming.end_time, upcoming.modality,
  );
  const showLiveTimer = upcomingStatus && (upcomingStatus.variant === "green" || upcomingStatus.variant === "amber");

  const hhmm = (t?: string | null) => (t ? t.substring(0, 5) : "");
  const fmtShort = (iso?: string | null) =>
    iso ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${iso}T12:00:00`)) : "—";
  const computeDur = (s?: string | null, e?: string | null) => {
    if (!s || !e) return "";
    const [sh, sm] = s.split(":").map(Number);
    const [eh, em] = e.split(":").map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    const h = Math.floor(mins / 60); const m = mins % 60;
    return m === 0 ? `${h}h` : h === 0 ? `${m}min` : `${h}h${m}`;
  };

  return (
    <div className="pp-card relative overflow-hidden flex flex-col min-h-[360px]">
      {coverUrl && (
        <div className="relative w-full aspect-[16/9] bg-muted overflow-hidden">
          <img src={coverUrl} alt={first.course_title || "Curso"} className="w-full h-full object-cover" loading="lazy" />
          <LiveBadge modality={first.modality} className="absolute top-2 left-2" />
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          {!coverUrl && <LiveBadge modality={first.modality} />}
          {showLiveTimer && (
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold tabular-nums", STATUS_PILL[upcomingStatus.variant])}>
              <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", STATUS_DOT[upcomingStatus.variant])} />
              <LiveCountdownInline startDate={upcoming.start_date} startTime={upcoming.start_time} fallback={upcomingStatus.label} />
            </span>
          )}
          <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
            {sessions.length} {sessions.length === 1 ? "sessão" : "sessões"}
          </span>
        </div>

        <h3 className="font-semibold text-foreground leading-snug mb-3 line-clamp-2">
          {first.course_title || "Sem curso"}
        </h3>

        <div className="rounded-lg border bg-muted/30 divide-y divide-border/70 mb-4">
          {sessions.map((s) => {
            const start = hhmm(s.start_time);
            const end = hhmm(s.end_time);
            const tag = formatTurmaNumber(s.turma_number, s.modality);
            const dur = computeDur(start, end);
            return (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="font-semibold tabular-nums text-foreground min-w-[64px]">{fmtShort(s.start_date)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {start && end ? `${start} — ${end}` : start || ""}
                </span>
                {dur && <span className="text-muted-foreground">· {dur}</span>}
                {tag && (
                  <span className="ml-auto inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                    Turma {tag}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3 border-t">
          <div className="flex flex-col gap-1.5 min-w-0">
            {products && products.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {products.slice(0, 4).map((name) => (
                  <span key={name} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60" title={name}>
                    {name}
                  </span>
                ))}
                {products.length > 4 && (
                  <span className="text-[10.5px] text-muted-foreground self-center">+{products.length - 4}</span>
                )}
              </div>
            )}
            {first.instructor_name && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground truncate">
                <User className="w-4 h-4 shrink-0 text-muted-foreground" />
                {first.instructor_name}
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Vagas/sessão</div>
            <div className="text-2xl font-semibold leading-tight tabular-nums">{first.slots}</div>
          </div>
        </div>

        {href && (
          <div className="mt-4 flex justify-center">
            <a
              href={href}
              {...(isInternal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold uppercase tracking-wide hover:shadow-glow transition-smooth hover:scale-[1.02] active:scale-95"
            >
              Inscreva-se
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function DateBlockImpl({ label, date, time }: { label: string; date?: string | null; time?: string | null }) {
  return (
    <div className="flex flex-col">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
        <CalendarDays className="w-3 h-3" />
        {label}
      </div>
      {date ? (
        <>
          <div className="text-sm font-semibold text-foreground leading-tight tabular-nums">
            {formatDatePtBr(date)}
          </div>
          {time && (
            <div className="text-[11px] text-muted-foreground tabular-nums">{time}</div>
          )}
        </>
      ) : (
        <div className="text-sm font-medium text-muted-foreground/70 italic">A definir</div>
      )}
    </div>
  );
}

function Metric({ label, value, valueClassName }: { label: string; value: React.ReactNode; valueClassName?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">{label}</div>
      <div className={cn("text-2xl font-semibold leading-tight tabular-nums", valueClassName)}>{value}</div>
    </div>
  );
}

function FreshnessIndicator({ updatedAt, fetching }: { updatedAt: number; fetching?: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 5_000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  const label = secs < 60 ? `há ${secs}s` : `há ${Math.floor(secs / 60)}min`;
  return (
    <p className="text-[11px] text-muted-foreground/70">
      {fetching ? "Atualizando…" : `Atualizado ${label}`}
    </p>
  );
}

function LiveBadge({ modality, className }: { modality?: string; className?: string }) {
  const isLive = modality === "online_ao_vivo";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0 rounded-full text-[9px] font-extrabold uppercase tracking-wider shadow-sm bg-[#ED1C24] text-white",
        className,
      )}
    >
      <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-white">
        <svg viewBox="0 0 12 12" className="w-2 h-2 fill-[#ED1C24]" aria-hidden>
          <polygon points="3,2 10,6 3,10" />
        </svg>
      </span>
      LIVE
    </span>
  );
}

function ShareButton({ turma }: { turma: TurmaComVagas }) {
  const handleShare = () => {
    const PUBLIC_BASE = "https://parametros.smartdent.com.br";
    const path = turma.modality === "presencial" ? "/agenda" : "/agenda/online";
    const url = `${PUBLIC_BASE}${path}?turma=${turma.id}`;

    const curso = turma.course_title || "Curso Smart Dent";
    const turmaLabel = turma.label || "";
    const instrutor = turma.instructor_name?.trim() || "";
    const local =
      turma.modality === "presencial"
        ? (turma.location?.trim() || "Local a definir")
        : turma.modality === "online_ao_vivo"
          ? "Online ao vivo"
          : "Online";

    const t = (s?: string | null) => (s ? s.substring(0, 5) : "");
    const fmtBR = (iso?: string | null) => {
      if (!iso) return "";
      const [y, m, d] = iso.split("-");
      return d && m && y ? `${d}/${m}/${y}` : "";
    };
    const fmtBRShort = (iso?: string | null) => {
      if (!iso) return "";
      const [, m, d] = iso.split("-");
      return d && m ? `${d}/${m}` : "";
    };
    const addDaysISO = (iso: string, n: number) => {
      const dt = new Date(iso + "T12:00:00");
      dt.setDate(dt.getDate() + n);
      return dt.toISOString().slice(0, 10);
    };
    const diffDaysISO = (a: string, b: string) => {
      const d1 = new Date(a + "T12:00:00").getTime();
      const d2 = new Date(b + "T12:00:00").getTime();
      return Math.round((d2 - d1) / 86400000);
    };

    const sortedDays = Array.isArray(turma.days) ? [...turma.days].sort((a, b) => a.day_number - b.day_number) : [];

    // Derivar dias quando o array vier vazio mas a turma for multi-dia
    let workDays = sortedDays;
    if (workDays.length === 0 && turma.start_date) {
      const startISO = turma.start_date;
      const endISO = turma.end_date || turma.start_date;
      const total = Math.max(0, diffDaysISO(startISO, endISO)) + 1;
      workDays = Array.from({ length: total }, (_, i) => ({
        day_number: i + 1,
        date: addDaysISO(startISO, i),
        start_time: turma.start_time || "",
        end_time: turma.end_time || "",
      }));
    }

    const first = workDays[0];
    const last = workDays[workDays.length - 1];
    const startDate = first?.date || turma.start_date || "";
    const endDate = last?.date || turma.end_date || startDate;
    const startTime = t(first?.start_time) || t(turma.start_time);
    const endTime = t(last?.end_time) || t(turma.end_time);

    const cronogramaLines: string[] = [];
    if (startDate && endDate && startDate !== endDate) {
      cronogramaLines.push(`📅 Início: ${fmtBR(startDate)} — Fim: ${fmtBR(endDate)}`);
    } else if (startDate) {
      cronogramaLines.push(`📅 Data: ${fmtBR(startDate)} (${formatWeekday(startDate)})`);
    }
    if (startTime && endTime) {
      cronogramaLines.push(`⏰ Horário: ${startTime} às ${endTime}`);
    }
    if (workDays.length > 1) {
      cronogramaLines.push("");
      cronogramaLines.push("🗓 Cronograma:");
      workDays.forEach((d, i) => {
        const wd = formatWeekday(d.date);
        const horario = t(d.start_time) && t(d.end_time) ? ` | ${t(d.start_time)}–${t(d.end_time)}` : "";
        const label = d.topic ? `Dia ${i + 1} — ${d.topic} (${fmtBRShort(d.date)}, ${wd})` : `Dia ${i + 1} — ${fmtBRShort(d.date)} (${wd})`;
        cronogramaLines.push(`• ${label}${horario}`);
      });
    }
    const cronograma = cronogramaLines.join("\n");

    const isPresencial = turma.modality === "presencial";
    const lines = [
      "Opção de treinamento, aqui estão os detalhes:",
      "",
      `📚 *${curso}*`,
      turmaLabel ? `🏷 Turma: *${turmaLabel}*` : "",
      instrutor ? `👨‍🏫 Instrutor: ${instrutor}` : "",
      `📍 ${local}`,
      "",
      cronograma,
      ...(isPresencial ? [] : ["", `Inscreva-se: ${url}`]),
    ];

    const message = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

    const openFallback = () => {
      const text = encodeURIComponent(message);
      window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank", "noopener,noreferrer");
    };
    if (typeof navigator !== "undefined" && typeof (navigator as any).share === "function") {
      (navigator as any).share({ text: message }).catch(() => openFallback());
    } else {
      openFallback();
    }
  };
  return (
    <button
      type="button"
      onClick={handleShare}
      title="Compartilhar no WhatsApp"
      aria-label="Compartilhar no WhatsApp"
      className="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-md transition-colors"
    >
      <Share2 className="w-4 h-4" />
    </button>
  );
}

function OnlineDateRow({
  startDate,
  endDate,
  startTime,
  endTime,
  totalDays,
}: {
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  totalDays?: number | null;
}) {
  const dateLabel = startDate
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${startDate}T12:00:00`))
    : "A definir";

  let duration = "";
  if (startTime && endTime) {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    if (totalDays && totalDays > 1) mins *= totalDays;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    duration = m === 0 ? `${h}h` : h === 0 ? `${m}min` : `${h}h ${m}min`;
  } else if (totalDays && totalDays > 1) {
    duration = `${totalDays} dias`;
  }

  const horario = startTime && endTime ? `${startTime} — ${endTime}` : startTime || "";

  return (
    <div className="mb-4 rounded-lg border bg-muted/30 p-3 grid grid-cols-3 gap-2 text-xs">
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          <CalendarDays className="w-3 h-3" />
          Início
        </span>
        <span className="font-semibold tabular-nums text-foreground">{dateLabel}</span>
      </div>
      {horario ? (
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            <Clock className="w-3 h-3" />
            Horário
          </span>
          <span className="font-semibold tabular-nums text-foreground">{horario}</span>
        </div>
      ) : <div />}
      {duration ? (
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            <Timer className="w-3 h-3" />
            Duração
          </span>
          <span className="font-semibold text-foreground">{duration}</span>
        </div>
      ) : <div />}
    </div>
  );
}