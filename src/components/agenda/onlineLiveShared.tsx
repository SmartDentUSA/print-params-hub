import { useEffect, useState } from "react";
import { User, Share2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getPublicOrigin } from "@/utils/publicOrigin";
import type { TurmaComVagas } from "@/types/courses";
import { UploadMidiasDriveButton } from "@/components/smartops/UploadMidiasDriveButton";

/**
 * Fonte única da agenda de lives/cursos online.
 * Usada por /agenda/online e pela aba "Lives" da base de conhecimento,
 * para que as duas telas nunca fiquem divergentes.
 */
export const ONLINE_LIVE_MODALITIES = ["online_ao_vivo", "online"];
export const ONLINE_LIVE_CATEGORIES = ["workshop", "webinar", "live_produtos"];


/** Sessão autenticada + membro da equipe: o upload de mídias é exclusivo de Team Members. */
export function useTeamMemberSession() {
  const [isTeam, setIsTeam] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async (hasSession: boolean) => {
      if (!hasSession) { if (alive) setIsTeam(false); return; }
      const { data, error } = await (supabase as any).rpc("fn_is_team_member");
      if (alive) setIsTeam(!error && data === true);
    };
    supabase.auth.getSession().then(({ data }) => check(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { check(!!s); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return isTeam;
}

export const publicPageStyles = `
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

export type StatusVariant = "green" | "amber" | "red" | "blue" | "muted";
export type CountdownResult = { label: string; variant: StatusVariant } | null;

export function useCountdown(tickMs = 60_000) {
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

/** Versão inline (sem wrapper) — usada dentro da pill de status para mostrar a contagem regressiva ao vivo. */
export function LiveCountdownInline({ startDate, startTime, fallback }: { startDate?: string; startTime?: string; fallback: string }) {
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

export const STATUS_DOT: Record<StatusVariant, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  blue: "bg-sky-500",
  muted: "bg-muted-foreground/50",
};

export const STATUS_PILL: Record<StatusVariant, string> = {
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  red: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  blue: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  muted: "bg-muted text-muted-foreground",
};

export function LiveBadge({ modality, className }: { modality?: string; className?: string }) {
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

/** Status da sessão online: contagem regressiva → AO VIVO (piscando) → Realizado. */
export function SessionStatus({ startDate, startTime, endDate, endTime }: {
  startDate?: string | null; startTime?: string | null;
  endDate?: string | null; endTime?: string | null;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!startDate) return <span className="justify-self-end text-muted-foreground">—</span>;
  const sTime = (startTime || "09:00").substring(0, 5);
  const eTime = (endTime || "18:00").substring(0, 5);
  const startMs = new Date(`${startDate}T${sTime}:00`).getTime();
  const endMs = new Date(`${endDate || startDate}T${eTime}:00`).getTime();

  if (now >= endMs) {
    return (
      <span className="justify-self-end inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
        Realizado
      </span>
    );
  }
  if (now >= startMs) {
    return (
      <span className="justify-self-end inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Ao vivo
      </span>
    );
  }
  const diff = startMs - now;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="justify-self-end inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold tabular-nums bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      {d > 0 ? `${d}d ` : ""}{pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}

export function PublicOnlineCourseCard({
  sessions,
  course,
  description,
  canUpload = false,
  driveFolders = {},
}: {
  sessions: TurmaComVagas[];
  course?: any;
  description?: string;
  canUpload?: boolean;
  driveFolders?: Record<string, { id: string | null; url: string | null }>;
}) {
  const getCountdown = useCountdown();
  const [shared, setShared] = useState(false);
  if (sessions.length === 0 && !course) return null;
  // Metadados vêm da turma quando existe; senão, do próprio curso.
  const first = (sessions[0] ?? {
    id: (course as any)?.id,
    course_id: (course as any)?.id,
    course_title: (course as any)?.title,
    modality: (course as any)?.modality,
    instructor_name: (course as any)?.instructor_name,
  }) as TurmaComVagas;
  const meta = (sessions[0] ?? course ?? {}) as any;
  const coverUrl = (meta.cover_image_url ?? (course as any)?.cover_image_url) as string | undefined;
  const products = (meta.related_product_names ?? (course as any)?.related_product_names) as string[] | undefined;
  const slug = (meta.course_slug ?? (course as any)?.slug) as string | undefined;
  const publicEnabled = Boolean(meta.public_enrollment_enabled ?? (course as any)?.public_enrollment_enabled);
  const externalUrl = (meta.signup_form_url ?? (course as any)?.signup_form_url) as string | undefined;
  const href = publicEnabled && slug ? `/inscricao/${slug}` : externalUrl;
  const isInternal = href?.startsWith("/");

  const shareUrl = href ? (isInternal ? `${getPublicOrigin()}${href}` : href) : getPublicOrigin();
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const title = first.course_title || "Live Smart Dent";
    const text = description || `Inscreva-se em ${title}`;
    try {
      if (navigator.share && isInternal) {
        await navigator.share({ title, text, url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // usuário cancelou ou share não disponível
    }
  };

  // Ordenação canônica (crescente por data/hora) — mesma da tela de edição do curso.
  const today = new Date().toISOString().slice(0, 10);
  const byDateAsc = (a: TurmaComVagas, b: TurmaComVagas) =>
    `${a.start_date || ""}T${(a.start_time || "").substring(0, 5)}`.localeCompare(
      `${b.start_date || ""}T${(b.start_time || "").substring(0, 5)}`,
    );
  const allSorted = [...sessions].sort(byDateAsc);
  // Sessões já realizadas não aparecem no card público.
  const nextSessions = allSorted.filter((s) => (s.end_date || s.start_date || "") >= today);

  // Próxima sessão (mais perto de hoje) para o cronômetro destacado.
  const upcoming = nextSessions[0] || allSorted[allSorted.length - 1];
  const upcomingStatus = upcoming
    ? getCountdown(upcoming.start_date, upcoming.start_time, upcoming.end_date, upcoming.end_time, upcoming.modality)
    : null;
  const showLiveTimer = !!upcoming && !!upcomingStatus && (upcomingStatus.variant === "green" || upcomingStatus.variant === "amber");

  // Card público mostra apenas as sessões vigentes, em ordem cronológica.
  const orderedSessions = nextSessions;


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
          <button
            type="button"
            onClick={handleShare}
            className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 text-foreground shadow-sm hover:bg-white hover:scale-105 transition"
            aria-label="Compartilhar"
            title="Compartilhar"
          >
            {shared ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          {!coverUrl && <LiveBadge modality={first.modality} />}
          {!coverUrl && (
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background border text-[11px] font-medium text-foreground hover:bg-accent transition"
              aria-label="Compartilhar"
              title="Compartilhar"
            >
              {shared ? <Check className="w-3 h-3 text-emerald-600" /> : <Share2 className="w-3 h-3" />}
              {shared ? "Link copiado" : "Compartilhar"}
            </button>
          )}
          {upcoming && upcomingStatus && showLiveTimer && (
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold tabular-nums", STATUS_PILL[upcomingStatus.variant])}>
              <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", STATUS_DOT[upcomingStatus.variant])} />
              <LiveCountdownInline startDate={upcoming.start_date} startTime={upcoming.start_time} fallback={upcomingStatus.label} />
            </span>
          )}
          <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
            {nextSessions.length === 0 ? "Datas em breve" : `${nextSessions.length} ${nextSessions.length === 1 ? "sessão" : "sessões"}`}
          </span>
        </div>

        <h3 className="font-semibold text-foreground leading-snug mb-2 line-clamp-2">
          {first.course_title || "Sem curso"}
        </h3>

        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground mb-3 line-clamp-4 whitespace-pre-line">
            {description}
          </p>
        )}

        {products && products.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
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
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground truncate mb-3">
            <User className="w-4 h-4 shrink-0 text-muted-foreground" />
            {first.instructor_name}
          </span>
        )}

        <div className="rounded-lg border bg-muted/30 divide-y divide-border/70 mb-4">
          <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted/50">
            <span>Dia</span>
            <span>Início</span>
            <span>Fim</span>
            <span>Duração</span>
            <span className="text-right">Status</span>
          </div>
          {orderedSessions.map((s) => {
            const start = hhmm(s.start_time);
            const end = hhmm(s.end_time);
            const dur = computeDur(start, end);
            return (
              <div key={s.id} className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-3 px-3 py-2 text-xs">
                <span className="font-semibold tabular-nums text-foreground">{fmtShort(s.start_date)}</span>
                <span className="text-muted-foreground tabular-nums">{start || "—"}</span>
                <span className="text-muted-foreground tabular-nums">{end || "—"}</span>
                <span className="text-muted-foreground tabular-nums">{dur || "—"}</span>
                <SessionStatus
                  startDate={s.start_date}
                  startTime={s.start_time}
                  endDate={s.end_date}
                  endTime={s.end_time}
                />
              </div>
            );
          })}
          {orderedSessions.length === 0 && (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">
              Novas datas em breve — inscreva-se para ser avisado.
            </div>
          )}
        </div>




        {canUpload && (
          <div className="mb-4 rounded-lg border border-dashed bg-muted/20 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Upload de mídias · equipe Smart Dent
            </p>
            <div className="flex flex-wrap gap-2">
              {sessions.map((s) => (
                <UploadMidiasDriveButton
                  key={s.id}
                  turmaId={s.id}
                  turmaNumber={s.turma_number}
                  turmaLabel={s.label ?? undefined}
                  courseTitle={s.course_title ?? undefined}
                  startDate={s.start_date}
                  endDate={s.end_date}
                  folderId={driveFolders[s.id]?.id ?? null}
                  folderUrl={driveFolders[s.id]?.url ?? null}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto" />

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
