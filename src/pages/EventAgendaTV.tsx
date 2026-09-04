import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { getStorageImageUrl } from "@/utils/storageImage";

const SMARTDENT_LOGO_URL =
  "https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png";

const AGENDA_SHORT_URL = "parametros.smartdent.com.br/CIPRO";
const AGENDA_URL = `https://${AGENDA_SHORT_URL}`;

/* ------------------------------------------------------------------ */
/* Tipos                                                              */
/* ------------------------------------------------------------------ */

type Session = { date?: string; start_time?: string; end_time?: string; theme?: string };
type Speaker = {
  name?: string;
  theme?: string;
  instagram?: string;
  photo_url?: string;
  sessions?: Session[];
  support_sessions?: Session[];
};


type EventRow = {
  id: string;
  name: string;
  slug: string | null;
  location: string | null;
  company_stand: string | null;
  start_date: string | null;
  end_date: string | null;
  event_logo_url: string | null;
  instagram_handle: string | null;
  speakers: Speaker[] | null;
};

type Slot = {
  key: string;
  name: string;
  theme: string;
  instagram: string;
  photo_url: string;
  start: Date | null;
  end: Date | null;
  dayKey: string;
  dayLabel: string;
  timeLabel: string;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const handleOf = (v?: string | null) =>
  String(v || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/^@+/, "")
    .replace(/\s+/g, "");

const instaUrl = (v?: string | null) => {
  const h = handleOf(v);
  return h ? `https://instagram.com/${h}` : "";
};

/* ---- Fuso oficial de Brasília (America/Sao_Paulo) ---- */
const SP_TZ = "America/Sao_Paulo";
const SP_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: SP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hour12: false,
});

const WD_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Componentes de data/hora do instante `d` já convertidos para o horário de Brasília. */
function spParts(d: Date) {
  const o: Record<string, string> = {};
  for (const p of SP_FMT.formatToParts(d)) if (p.type !== "literal") o[p.type] = p.value;
  return {
    year: Number(o.year),
    month: Number(o.month),
    day: Number(o.day),
    hour: Number(o.hour === "24" ? "0" : o.hour),
    minute: Number(o.minute),
    second: Number(o.second),
    weekday: WD_INDEX[o.weekday] ?? 0,
  };
}

/** Offset (min) entre SP e UTC no instante `d`. */
function spOffsetMinutes(d: Date): number {
  const p = spParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - d.getTime()) / 60000);
}

/** Converte "YYYY-MM-DD" + "HH:MM" (hora de Brasília, como cadastrado) no instante real. */
function toDate(date?: string, time?: string): Date | null {
  if (!date) return null;
  const t = (time || "00:00").slice(0, 5);
  const [y, mo, da] = date.slice(0, 10).split("-").map(Number);
  const [hh, mi] = t.split(":").map(Number);
  if (!y || !mo || !da || Number.isNaN(hh) || Number.isNaN(mi)) return null;
  const guess = new Date(Date.UTC(y, mo - 1, da, hh, mi, 0));
  const real = new Date(guess.getTime() - spOffsetMinutes(guess) * 60000);
  return isNaN(real.getTime()) ? null : real;
}


const WEEK_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const WEEK_LONG = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MONTH_SHORT = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

const dayKeyOf = (d: Date | null) => {
  if (!d) return "";
  const p = spParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

/** "QUINTA • 17 SET" (horário de Brasília) */
const fmtDayLabel = (d: Date | null) => {
  if (!d) return "";
  const p = spParts(d);
  return `${WEEK_LONG[p.weekday].replace("-feira", "").toUpperCase()} • ${String(p.day).padStart(2, "0")} ${MONTH_SHORT[p.month - 1]}`;
};

/** "QUI, 04/09/2026" (horário de Brasília) */
const fmtHeaderDate = (d: Date) => {
  const p = spParts(d);
  return `${WEEK_SHORT[p.weekday]}, ${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${p.year}`;
};

/** "11:56" (horário de Brasília, 24h) */
const fmtTime = (d: Date | null) => {
  if (!d) return "";
  const p = spParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};


function flatten(speakers: Speaker[]): Slot[] {
  const out: Slot[] = [];
  speakers.forEach((sp, i) => {
    const sessions = (sp.sessions || []).length ? sp.sessions! : [{}];
    sessions.forEach((se, j) => {
      const start = toDate(se.date, se.start_time);
      const end = toDate(se.date, se.end_time);
      out.push({
        key: `${i}-${j}`,
        name: sp.name || "",
        theme: cleanTheme(se.theme || sp.theme),
        instagram: handleOf(sp.instagram),
        photo_url: sp.photo_url || "",
        start,
        end,
        dayKey: dayKeyOf(start),
        dayLabel: fmtDayLabel(start),
        timeLabel: [fmtTime(start), fmtTime(end)].filter(Boolean).join(" – "),
      });
    });
  });
  return out
    .filter((s) => s.name)
    .sort((a, b) => (a.start?.getTime() ?? Infinity) - (b.start?.getTime() ?? Infinity));
}

/** Ignora temas de preenchimento ("xxxxx", "----", "a definir") vindos do cadastro. */
const cleanTheme = (v?: string | null) => {
  const t = String(v || "").trim();
  if (!t) return "";
  if (/^[x\-_.\s]{3,}$/i.test(t)) return "";
  if (/^(a\s*definir|tbd|placeholder)$/i.test(t)) return "";
  return t;
};

type SupportPerson = {
  key: string;
  name: string;
  instagram: string;
  photo_url: string;
  available: boolean;
  windowLabel: string;
  dayLabel: string;
  sortAt: number;
};

/** Palestrantes com janelas de apoio comercial no estande. */
function buildSupport(speakers: Speaker[], now: Date): SupportPerson[] {
  const t = now.getTime();
  const out: SupportPerson[] = [];
  speakers.forEach((sp, i) => {
    if (!sp.name) return;
    const windows = (sp.support_sessions || [])
      .map((se) => ({
        start: toDate(se.date, se.start_time),
        end: toDate(se.date, se.end_time || se.start_time),
      }))
      .filter((w) => w.start)
      .map((w) => ({
        start: w.start as Date,
        end: w.end && w.end.getTime() > (w.start as Date).getTime()
          ? w.end
          : new Date((w.start as Date).getTime() + 60 * 60 * 1000),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (!windows.length) return;

    const current = windows.find((w) => t >= w.start.getTime() && t <= (w.end as Date).getTime());
    const upcoming = windows.find((w) => w.start.getTime() > t);
    const chosen = current || upcoming;
    if (!chosen) return;

    out.push({
      key: `sup-${i}`,
      name: sp.name,
      instagram: handleOf(sp.instagram),
      photo_url: sp.photo_url || "",
      available: !!current,
      windowLabel: [fmtTime(chosen.start), fmtTime(chosen.end as Date)].filter(Boolean).join(" – "),
      dayLabel: fmtDayLabel(chosen.start),
      sortAt: chosen.start.getTime(),
    });
  });

  return out.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.sortAt - b.sortAt;
  });
}

const endOf = (s: Slot) =>

  s.end ?? (s.start ? new Date(s.start.getTime() + 45 * 60 * 1000) : null);

const isLive = (s: Slot, now: Date) => {
  const e = endOf(s);
  return !!(s.start && e && now >= s.start && now <= e);
};

/**
 * Contagem regressiva em horas + minutos, sempre no total de horas.
 * Ex.: 13 dias, 13h e 1min -> "325h 01min". Nunca negativa, nunca NaN.
 */
function countdownLabel(target: Date | null, now: Date): string {
  if (!target || isNaN(target.getTime())) return "";
  const ms = target.getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}min`;
}


type StatusKind = "live" | "next" | "scheduled" | "done";

function statusOf(s: Slot, now: Date, nextKey?: string): StatusKind {
  if (isLive(s, now)) return "live";
  const e = endOf(s);
  if (e && e.getTime() <= now.getTime()) return "done";
  if (s.key === nextKey) return "next";
  return "scheduled";
}

const STATUS_LABEL: Record<StatusKind, string> = {
  live: "AO VIVO",
  next: "A SEGUIR",
  scheduled: "PROGRAMADO",
  done: "ENCERRADO",
};

const STATUS_CLASS: Record<StatusKind, string> = {
  live: "bg-[--tv-orange] text-white",
  next: "bg-[--tv-blue] text-white",
  scheduled: "bg-[--tv-sky] text-[--tv-navy]",
  done: "bg-[--tv-line] text-[--tv-slate]",
};

/* ------------------------------------------------------------------ */
/* QR                                                                 */
/* ------------------------------------------------------------------ */

function useQr(url: string, size: number) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!url) return setSrc("");
    QRCode.toDataURL(url, {
      width: size * 3,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0B2545", light: "#ffffff" },
    })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [url, size]);
  return src;
}

function InstagramQR({
  handle,
  size,
  caption = true,
}: {
  handle: string;
  size: number;
  caption?: boolean;
}) {
  const src = useQr(instaUrl(handle), size);
  if (!src) return null;
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div
        className="rounded-[12px] border border-[--tv-line] bg-white p-2 shadow-[0_2px_10px_rgba(11,37,69,0.08)]"
        style={{ width: size + 20, height: size + 20 }}
      >
        <img
          src={src}
          alt={`QR code do Instagram @${handle}`}
          width={size}
          height={size}
          style={{ width: size, height: size }}
        />
      </div>
      {caption && (
        <span className="text-[0.95rem] font-semibold uppercase tracking-[0.18em] text-[--tv-slate]">
          Instagram
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Peças de UI                                                        */
/* ------------------------------------------------------------------ */

function Avatar({ slot, size }: { slot: { name: string; photo_url: string }; size: number }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full border-[3px] border-[--tv-slate]/35 bg-[--tv-sky] shadow-[0_4px_16px_rgba(11,37,69,0.12)]"
      style={{ width: size, height: size }}
    >
      {slot.photo_url ? (
        <img
          src={getStorageImageUrl(slot.photo_url, { width: 400, height: 400, resize: "cover" })}
          alt={slot.name}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[2.4rem] font-bold text-[--tv-blue]">
          {slot.name.slice(0, 1)}
        </div>
      )}
    </div>
  );
}

function StatusPill({ kind, size = "md" }: { kind: StatusKind; size?: "md" | "lg" }) {
  const isHero = size === "lg";
  return (
    <span
      className={`inline-flex items-center gap-2.5 rounded-full font-extrabold uppercase tracking-[0.14em] ${
        isHero
          ? `${kind === "live" ? "bg-[--tv-orange]" : "bg-[--tv-orange]"} tv-halo-soft px-6 py-2.5 text-[24px] text-white`
          : `${STATUS_CLASS[kind]} px-4 py-1.5 text-[19px]`
      }`}
    >
      {(kind === "live" || isHero) && (
        <span
          className={`tv-pulse inline-block rounded-full ${
            isHero ? "h-3 w-3" : "h-2.5 w-2.5"
          } ${kind === "live" || isHero ? "bg-white" : "bg-current"}`}
        />
      )}
      {kind === "live" ? (isHero ? "AO VIVO AGORA" : "AO VIVO") : STATUS_LABEL[kind]}
    </span>
  );
}


/* ------------------------------------------------------------------ */
/* Página                                                             */
/* ------------------------------------------------------------------ */

export default function EventAgendaTV() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [page, setPage] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [paused, setPaused] = useState(false);
  const pagesRef = useRef(1);

  /* Relógio */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* Pausa a rotação quando o administrador interage */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onInteract = () => {
      setPaused(true);
      clearTimeout(timer);
      timer = setTimeout(() => setPaused(false), 30_000);
    };
    const evts = ["mousemove", "mousedown", "keydown", "touchstart", "wheel"] as const;
    evts.forEach((e) => window.addEventListener(e, onInteract, { passive: true }));
    return () => {
      evts.forEach((e) => window.removeEventListener(e, onInteract));
      clearTimeout(timer);
    };
  }, []);

  /* Carrega evento + refetch a cada 3 min (TV fica ligada o dia todo) */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const isUuid = /^[0-9a-f-]{36}$/i.test(slug || "");
      const cols =
        "id,name,slug,location,company_stand,start_date,end_date,event_logo_url,instagram_handle,speakers";
      const q = supabase.from("smartops_events").select(cols).eq("is_active", true).limit(1);
      const { data } = isUuid ? await q.eq("id", slug!) : await q.eq("slug", slug!);
      if (!alive) return;
      setEvent(((data || [])[0] as unknown as EventRow) ?? null);
      setLoading(false);
    };
    load();
    const t = setInterval(load, 180_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [slug]);

  const slots = useMemo(() => flatten((event?.speakers as Speaker[]) || []), [event]);

  /* Só o que ainda não terminou: ao encerrar, a demonstração sai da tela */
  const active = useMemo(() => {
    const t = now.getTime();
    const withDate = slots.filter((s) => {
      const e = endOf(s);
      return !!(s.start && e && e.getTime() > t);
    });
    const noDate = slots.filter((s) => !s.start);
    return [...withDate, ...noDate];
  }, [slots, now]);

  /* Card principal: o que está ao vivo; senão, a próxima */
  const live = useMemo(() => active.find((s) => isLive(s, now)) ?? null, [active, now]);
  const next = useMemo(
    () => active.find((s) => s.start && s.start.getTime() > now.getTime()) ?? null,
    [active, now]
  );
  const hero = live ?? next ?? active[0] ?? null;

  const rest = useMemo(() => active.filter((s) => s.key !== hero?.key), [active, hero]);

  const perPage = Math.max(1, Number(params.get("por") || 3) || 3);
  const pages = Math.max(1, Math.ceil(rest.length / perPage));
  pagesRef.current = pages;

  /* Rotação automática com fade suave */
  useEffect(() => {
    if (pages <= 1 || paused) return;
    const t = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setPage((p) => (p + 1) % pagesRef.current);
        setFadeIn(true);
      }, 400);
    }, 10_000);
    return () => clearInterval(t);
  }, [pages, paused]);

  const visible = rest.slice((page % pages) * perPage, (page % pages) * perPage + perPage);

  /* Agrupa por dia */
  const groups = useMemo(() => {
    const out: { label: string; items: Slot[] }[] = [];
    visible.forEach((s) => {
      const label = s.dayLabel || "DATA A DEFINIR";
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(s);
      else out.push({ label, items: [s] });
    });
    return out;
  }, [visible]);

  const support = useMemo(
    () => buildSupport(((event?.speakers as Speaker[]) || []), now).slice(0, 5),
    [event, now]
  );

  const footerQr = useQr(AGENDA_URL, 82);


  const shell =
    "tv-root flex h-screen w-screen flex-col overflow-hidden bg-[--tv-bg] text-[--tv-navy]";

  if (loading || !event) {
    return (
      <>
        <TvStyles />
        <div className={`${shell} items-center justify-center`}>
          <p className="text-[2rem] font-semibold text-[--tv-slate]">
            {loading ? "Carregando agenda…" : "Evento não encontrado."}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <TvStyles />
      <div className={shell}>
        {/* Grafismos curvos translúcidos */}
        <div aria-hidden className="tv-graphics" />

        {/* ------------------------------ Cabeçalho ------------------------------ */}
        <header className="relative z-10 flex h-[124px] shrink-0 items-center justify-between gap-10 px-12">
          <div className="flex items-center gap-8">
            <img
              src={SMARTDENT_LOGO_URL}
              alt="Smart Dent"
              className="h-[56px] w-auto object-contain"
            />
            <span className="h-16 w-px bg-[--tv-line]" />
            <div>
              <h1 className="text-[48px] font-extrabold leading-none tracking-[-0.02em] text-[--tv-navy]">
                AGENDA AO VIVO
              </h1>
              <p className="pt-2 text-[24px] font-semibold leading-none text-[--tv-slate]">
                {event.name}
                {event.company_stand ? ` • Estande ${event.company_stand}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            {event.event_logo_url && (
              <img
                src={getStorageImageUrl(event.event_logo_url, { width: 260 })}
                alt={event.name}
                className="h-[60px] w-auto object-contain"
              />
            )}
            <div className="text-right">
              <div className="text-[56px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-[--tv-navy]">
                {fmtTime(now)}
              </div>
              <p className="pt-1 text-[22px] font-semibold uppercase tracking-[0.18em] text-[--tv-slate]">
                {fmtHeaderDate(now)}
              </p>
            </div>
          </div>
        </header>

        {/* ------------------------------ Card principal ------------------------------ */}
        <div className="relative z-10 shrink-0 px-12 pb-2">
          {hero ? (
            <section className="tv-card next-demo-card flex min-h-[282px] items-center gap-8 rounded-[24px] py-5 pl-12 pr-10">
              <div className="flex shrink-0 items-center gap-5">
                <Avatar slot={hero} size={170} />
                <InstagramQR handle={hero.instagram} size={150} caption={false} />
              </div>

              <div className="w-[330px] shrink-0">
                <StatusPill kind={live ? "live" : "next"} size="lg" />
                <p className="mt-4 line-clamp-2 text-[44px] font-extrabold leading-[1.06] tracking-[-0.02em] text-[--tv-navy]">
                  {hero.name}
                </p>
                {hero.instagram && (
                  <p className="text-[25px] font-semibold leading-tight text-[--tv-slate]">
                    @{hero.instagram}
                  </p>
                )}
              </div>

              <div className="min-w-0 flex-1 self-stretch border-l border-[--tv-line] pl-9 flex flex-col justify-center">
                <p className="text-[22px] font-bold uppercase tracking-[0.2em] text-[--tv-orange]">
                  {live ? "Ao vivo agora" : "Próxima demonstração"}
                </p>
                <h2 className="mt-3 line-clamp-2 text-[clamp(54px,3.3vw,68px)] font-extrabold uppercase leading-[1.04] tracking-[-0.02em] text-[--tv-navy]">
                  {hero.theme || hero.name}
                </h2>
              </div>

              <div className="w-[280px] shrink-0 self-stretch border-l border-[--tv-line] pl-9 text-right flex flex-col justify-center">
                <p className="text-[21px] font-semibold uppercase tracking-[0.2em] text-[--tv-slate]">
                  Horário
                </p>
                <p className="text-[64px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-[--tv-navy]">
                  {fmtTime(hero.start) || "--:--"}
                </p>
                <p className="mt-4 text-[21px] font-semibold uppercase tracking-[0.2em] text-[--tv-slate]">
                  {live ? "Status" : "Começa em"}
                </p>
                <p
                  className={`tv-fade mt-1 min-w-[230px] whitespace-nowrap font-extrabold leading-none tabular-nums text-[--tv-orange] ${
                    live ? "text-[30px]" : "text-[38px]"
                  }`}
                >
                  {live
                    ? "ACONTECENDO AGORA"
                    : countdownLabel(hero.start, now) || "00h 00min"}
                </p>
              </div>

            </section>
          ) : (
            <section className="tv-card flex h-[294px] flex-col items-center justify-center rounded-[24px] px-10 text-center">
              <p className="text-[48px] font-extrabold uppercase text-[--tv-navy]">
                Nenhuma demonstração programada no momento.
              </p>
              <p className="mt-3 text-[26px] font-semibold text-[--tv-slate]">
                Visite o estande {event.company_stand || "Smart Dent"}
                {event.location ? ` • ${event.location}` : ""}.
              </p>
            </section>
          )}
        </div>

        {/* ------------------------------ Próximas ------------------------------ */}
        <main className="relative z-10 min-h-0 flex-1 overflow-hidden px-12 pt-3">
          <div
            className="flex h-full min-h-0 flex-col gap-3 pb-2 transition-opacity duration-500"
            style={{ opacity: fadeIn ? 1 : 0 }}
          >
            {groups.length === 0 ? (
              <p className="pt-10 text-[30px] font-semibold text-[--tv-slate]">
                Acompanhe as próximas demonstrações no estande.
              </p>
            ) : (
              groups.map((g) => (
                <section key={g.label} className="flex min-h-0 flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <h3 className="text-[22px] font-extrabold uppercase tracking-[0.22em] text-[--tv-blue]">
                      {g.label}
                    </h3>
                    <span className="h-px flex-1 bg-[--tv-line]" />
                  </div>
                  {g.items.map((s) => {
                    const kind = statusOf(s, now, next?.key);
                    return (
                      <article
                        key={s.key}
                        className="tv-card flex min-h-[116px] items-center gap-5 rounded-[16px] px-6 py-3"
                      >
                        <Avatar slot={s} size={92} />
                        <InstagramQR handle={s.instagram} size={82} caption={false} />

                        <div className="w-[260px] shrink-0">
                          <p className="line-clamp-2 text-[28px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[--tv-navy]">
                            {s.name}
                          </p>
                          {s.instagram && (
                            <p className="text-[18px] font-semibold leading-tight text-[--tv-slate]">
                              @{s.instagram}
                            </p>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 self-stretch border-l border-[--tv-line] pl-6 flex flex-col justify-center">
                          <h4 className="line-clamp-2 text-[clamp(28px,1.8vw,36px)] font-extrabold uppercase leading-[1.05] tracking-[-0.02em] text-[--tv-navy]">
                            {s.theme || "Demonstração Smart Dent"}
                          </h4>
                        </div>

                        <div className="w-[220px] shrink-0 self-stretch border-l border-[--tv-line] pl-6 text-right flex flex-col justify-center">
                          <p className="text-[42px] font-extrabold leading-none tabular-nums tracking-[-0.02em] text-[--tv-navy]">
                            {fmtTime(s.start) || "--:--"}
                          </p>
                          <div className="mt-1.5 flex justify-end">
                            <StatusPill kind={kind} />
                          </div>
                          {kind !== "live" && kind !== "done" && (
                            <p className="mt-1 whitespace-nowrap text-[20px] font-extrabold tabular-nums text-[--tv-orange]">
                              em {countdownLabel(s.start, now) || "00h 00min"}
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </section>
              ))
            )}
          </div>
        </main>


        {/* ------------------------------ Rodapé ------------------------------ */}
        <footer className="relative z-10 flex h-[104px] shrink-0 items-center justify-between gap-8 px-12">
          <div className="flex items-center gap-6">
            {footerQr && (
              <div className="rounded-[12px] border border-[--tv-line] bg-white p-1.5 shadow-[0_2px_10px_rgba(11,37,69,0.08)]">
                <img
                  src={footerQr}
                  alt={`QR code da agenda completa — ${AGENDA_SHORT_URL}`}
                  width={82}
                  height={82}
                  style={{ width: 82, height: 82 }}
                />
              </div>
            )}
            <div>
              <p className="text-[30px] font-extrabold leading-tight text-[--tv-navy]">
                Escaneie e acesse a agenda completa
              </p>
              <p className="text-[22px] font-semibold leading-tight text-[--tv-orange]">
                {AGENDA_SHORT_URL}
              </p>

            </div>
          </div>
          <div className="flex items-center gap-7">
            {pages > 1 && (
              <span className="flex items-center gap-2.5">
                {Array.from({ length: pages }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      i === page % pages ? "bg-[--tv-orange]" : "bg-[--tv-line]"
                    }`}
                  />
                ))}
              </span>
            )}
            <span className="text-right text-[1.1rem] font-semibold leading-tight text-[--tv-slate]">
              Smart Dent | Fluxo Digital
              {event.instagram_handle ? (
                <>
                  <br />
                  {event.instagram_handle.startsWith("@")
                    ? event.instagram_handle
                    : `@${handleOf(event.instagram_handle)}`}
                </>
              ) : null}
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Estilos da sinalização (escopo da própria tela)                     */
/* ------------------------------------------------------------------ */

function TvStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;500;600;700&display=swap');

.tv-root {
  --tv-bg: #F2F4F7;
  --tv-card: #FFFFFF;
  --tv-navy: #0B2545;
  --tv-slate: #5A7391;
  --tv-blue: #1F5FA9;
  --tv-sky: #E4EEF9;
  --tv-orange: #E8762C;
  --tv-line: #DDE4EC;
  font-family: 'Host Grotesk', 'Poppins', system-ui, -apple-system, sans-serif;
  font-feature-settings: 'ss01';
  position: relative;
}

.tv-card {
  background: rgba(255,255,255,0.94);
  border: 1px solid var(--tv-line);
  box-shadow: 0 6px 26px -12px rgba(11,37,69,0.18);
  backdrop-filter: blur(6px);
}

/* Card da próxima demonstração / ao vivo — destaque com halo laranja */
.next-demo-card {
  position: relative;
  isolation: isolate;
  background: linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 55%, #EEF5FD 100%);
  border: 3px solid rgba(232, 118, 44, 0.9);
  border-left: 8px solid var(--tv-orange);
  box-shadow:
    0 14px 34px rgba(11, 37, 69, 0.16),
    0 0 24px rgba(232, 118, 44, 0.22);
}

.next-demo-card::before {
  content: "";
  position: absolute;
  inset: -5px;
  border-radius: inherit;
  border: 4px solid rgba(232, 118, 44, 0.45);
  box-shadow: 0 0 22px rgba(232, 118, 44, 0.32);
  pointer-events: none;
  z-index: -1;
  animation: smartDentOrangeHalo 1.8s ease-in-out infinite;
}

@keyframes smartDentOrangeHalo {
  0%, 100% { opacity: 0.35; transform: scale(1);     box-shadow: 0 0 12px rgba(232,118,44,0.20); }
  50%      { opacity: 0.90; transform: scale(1.008); box-shadow: 0 0 32px rgba(232,118,44,0.48); }
}

@keyframes tvHaloSoft {
  0%, 100% { box-shadow: 0 0 0 0 rgba(232,118,44,0.34); }
  50%      { box-shadow: 0 0 0 8px rgba(232,118,44,0.05); }
}
.tv-halo-soft { animation: tvHaloSoft 1.8s ease-in-out infinite; }



.tv-graphics {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  background:
    radial-gradient(700px 420px at 96% -8%, rgba(31,95,169,0.10), transparent 70%),
    radial-gradient(620px 380px at -6% 108%, rgba(232,118,44,0.08), transparent 70%);
}
.tv-graphics::before,
.tv-graphics::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(31,95,169,0.10);
}
.tv-graphics::before { width: 1100px; height: 1100px; right: -380px; top: -420px; }
.tv-graphics::after  { width: 860px;  height: 860px;  left: -320px;  bottom: -380px; border-color: rgba(232,118,44,0.12); }

@keyframes tvPulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.35; }
}
.tv-pulse { animation: tvPulse 2.4s ease-in-out infinite; }

@keyframes tvFade { from { opacity: 0.6; } to { opacity: 1; } }
.tv-fade { animation: tvFade 0.4s ease-out; }
`}</style>
  );
}
