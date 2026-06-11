import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, MapPin, Video, User, RefreshCw } from "lucide-react";
import { formatDatePtBr } from "@/lib/courseUtils";
import { formatTurmaNumber } from "@/lib/turmaNumber";
import { cn } from "@/lib/utils";
import type { TurmaComVagas } from "@/types/courses";

type AgendaVariant = "presencial" | "online";

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{config.title} | Smart Dent</title>
        <meta name="description" content={config.metaDescription} />
        <link rel="canonical" href={config.canonical} />
      </Helmet>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{config.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{config.subtitle}</p>
          <div className="flex items-center gap-3 mt-2">
            {dataUpdatedAt > 0 && (
              <FreshnessIndicator updatedAt={dataUpdatedAt} fetching={isFetching} />
            )}
            <button
              type="button"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["public_agenda_turmas", variant] });
                queryClient.invalidateQueries({ queryKey: ["public_agenda_courses", variant] });
              }}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80 hover:text-foreground border rounded-full px-2.5 py-1 transition-colors"
            >
              <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
              Atualizar agora
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando...</div>
        ) : turmas.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border rounded-xl bg-card">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{config.emptyLabel}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

  const dateLine = turma.start_date
    ? turma.end_date && turma.end_date !== turma.start_date
      ? `${formatDatePtBr(turma.start_date)} – ${formatDatePtBr(turma.end_date)}`
      : formatDatePtBr(turma.start_date)
    : turma.label;

  return (
    <div className={cn("relative bg-card border rounded-xl p-5 transition-all hover:shadow-md", isMuted && "opacity-60")}>
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {status && (
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", STATUS_PILL[status.variant])}>
            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status.variant])} />
            {status.label}
          </span>
        )}
        {showLiveTimer && (
          <LiveCountdown startDate={turma.start_date} startTime={turma.start_time} />
        )}
        {turmaTag && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
            Turma {turmaTag}
          </span>
        )}
      </div>

      <h3 className="font-semibold text-foreground leading-snug mb-1 line-clamp-2">
        {turma.course_title || "Sem curso"} <span className="text-muted-foreground font-normal">— {turma.label}</span>
      </h3>
      <p className="text-xs text-muted-foreground mb-1">{subtitleParts.join(" · ")}</p>
      <p className="text-xs text-muted-foreground/80 mb-4 flex items-center gap-1">
        {turma.modality === "presencial" ? <MapPin className="w-3 h-3" /> : <Video className="w-3 h-3" />}
        {dateLine}
      </p>

      {isOnline && products && products.length > 0 && (
        <div className="mb-4 -mt-2 flex flex-wrap gap-1">
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

      <div className="grid grid-cols-3 gap-3 pt-3 border-t">
        <Metric label="Vagas" value={turma.slots} />
        <Metric label="Inscritos" value={turma.enrolled_count} />
        <Metric
          label="Ocupação"
          value={lotado ? "Lotado" : `${pct}%`}
          valueClassName={lotado ? "text-rose-600 dark:text-rose-400" : pctColor}
        />
      </div>

      {turma.instructor_name && (
        <div className="mt-3 pt-3 border-t">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <User className="w-3 h-3 shrink-0" />
            {turma.instructor_name}
          </span>
        </div>
      )}
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