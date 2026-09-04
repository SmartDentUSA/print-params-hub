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

type Session = { date?: string; start_time?: string; end_time?: string };
type Speaker = {
  name?: string;
  theme?: string;
  instagram?: string;
  photo_url?: string;
  sessions?: Session[];
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

function toDate(date?: string, time?: string): Date | null {
  if (!date) return null;
  const t = (time || "00:00").slice(0, 5);
  const d = new Date(`${date}T${t}:00`);
  return isNaN(d.getTime()) ? null : d;
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

const dayKeyOf = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : "";

/** "QUINTA • 17 SET" */
const fmtDayLabel = (d: Date | null) =>
  d
    ? `${WEEK_LONG[d.getDay()].replace("-feira", "").toUpperCase()} • ${String(d.getDate()).padStart(2, "0")} ${MONTH_SHORT[d.getMonth()]}`
    : "";

/** "QUI, 04/09" */
const fmtHeaderDate = (d: Date) =>
  `${WEEK_SHORT[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const fmtTime = (d: Date | null) =>
  d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "";

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
        theme: cleanTheme(sp.theme),
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

const endOf = (s: Slot) =>
  s.end ?? (s.start ? new Date(s.start.getTime() + 45 * 60 * 1000) : null);

const isLive = (s: Slot, now: Date) => {
  const e = endOf(s);
  return !!(s.start && e && now >= s.start && now <= e);
};

/**
 * Contagem regressiva legível:
 *  - < 1 min  -> "começa agora"
 *  - < 1 h    -> "começa em 24min 10s"
 *  - < 24 h   -> "começa em 01h 24min"
 *  - >= 24 h  -> "em 13 dias" / "quinta-feira, 11:56"
 */
function countdownLabel(target: Date | null, now: Date, compact = false): string {
  if (!target) return "";
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "";
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return compact ? "agora" : "começa agora";
  if (totalMin < 60) {
    const s = Math.floor((ms % 60000) / 1000);
    const body = `${totalMin}min ${String(s).padStart(2, "0")}s`;
    return compact ? body : `começa em ${body}`;
  }
  const hours = Math.floor(totalMin / 60);
  if (hours < 24) {
    const body = `${String(hours).padStart(2, "0")}h ${String(totalMin % 60).padStart(2, "0")}min`;
    return compact ? body : `começa em ${body}`;
  }
  const days = Math.round(hours / 24);
  if (days <= 6) return `${WEEK_LONG[target.getDay()]}, ${fmtTime(target)}`;
  return `em ${days} dias`;
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

function Avatar({ slot, size }: { slot: Slot; size: number }) {
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
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-bold uppercase tracking-[0.16em] ${STATUS_CLASS[kind]} ${
        size === "lg" ? "text-[1.25rem]" : "text-[1rem]"
      }`}
    >
      {kind === "live" && (
        <span className="tv-pulse inline-block h-2.5 w-2.5 rounded-full bg-white" />
      )}
      {STATUS_LABEL[kind]}
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
        <header className="relative z-10 flex h-[115px] shrink-0 items-center justify-between gap-10 px-12">
          <div className="flex items-center gap-8">
            <img
              src={SMARTDENT_LOGO_URL}
              alt="Smart Dent"
              className="h-[52px] w-auto object-contain"
            />
            <span className="h-14 w-px bg-[--tv-line]" />
            <div>
              <h1 className="text-[2.5rem] font-bold leading-none tracking-tight text-[--tv-navy]">
                AGENDA AO VIVO
              </h1>
              <p className="pt-1.5 text-[1.35rem] font-semibold leading-none text-[--tv-slate]">
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
                className="h-[56px] w-auto object-contain"
              />
            )}
            <div className="text-right">
              <div className="text-[3.2rem] font-bold leading-none tabular-nums tracking-tight text-[--tv-navy]">
                {fmtTime(now)}
              </div>
              <p className="pt-1 text-[1.2rem] font-semibold uppercase tracking-[0.2em] text-[--tv-slate]">
                {fmtHeaderDate(now)}
              </p>
            </div>
          </div>
        </header>

        {/* ------------------------------ Card principal ------------------------------ */}
        <div className="relative z-10 shrink-0 px-12">
          {hero ? (
            <section className="tv-card flex h-[210px] items-center gap-9 rounded-[22px] px-10">
              <div className="flex shrink-0 items-center gap-6">
                <Avatar slot={hero} size={140} />
                <InstagramQR handle={hero.instagram} size={120} />
              </div>

              <div className="min-w-0 flex-1">
                <StatusPill kind={live ? "live" : "next"} size="lg" />
                <p className="mt-2.5 line-clamp-2 text-[2.5rem] font-bold leading-[1.1] text-[--tv-navy]">
                  {hero.name}
                </p>
                {hero.instagram && (
                  <p className="text-[1.4rem] font-semibold leading-tight text-[--tv-slate]">
                    @{hero.instagram}
                  </p>
                )}
              </div>

              <div className="min-w-0 flex-[1.4] border-l border-[--tv-line] pl-9">
                <p className="text-[1rem] font-semibold uppercase tracking-[0.2em] text-[--tv-slate]">
                  {live ? "Ao vivo agora" : "Próxima demonstração"}
                </p>
                <h2 className="mt-1.5 line-clamp-2 text-[3rem] font-bold leading-[1.08] text-[--tv-navy]">
                  {hero.theme || hero.name}
                </h2>
              </div>

              <div className="w-[300px] shrink-0 border-l border-[--tv-line] pl-9 text-right">
                <p className="text-[1rem] font-semibold uppercase tracking-[0.2em] text-[--tv-slate]">
                  Horário
                </p>
                <p className="text-[3rem] font-bold leading-none tabular-nums text-[--tv-navy]">
                  {fmtTime(hero.start) || "--:--"}
                </p>
                <p className="tv-fade mt-2 text-[1.55rem] font-bold leading-tight text-[--tv-orange]">
                  {live ? "acontecendo agora" : countdownLabel(hero.start, now) || "em instantes"}
                </p>
              </div>
            </section>
          ) : (
            <section className="tv-card flex h-[210px] flex-col items-center justify-center rounded-[22px] px-10 text-center">
              <p className="text-[2.4rem] font-bold text-[--tv-navy]">
                Nenhuma demonstração programada no momento.
              </p>
              <p className="mt-2 text-[1.5rem] font-semibold text-[--tv-slate]">
                Visite o estande {event.company_stand || "Smart Dent"}
                {event.location ? ` • ${event.location}` : ""}.
              </p>
            </section>
          )}
        </div>

        {/* ------------------------------ Próximas ------------------------------ */}
        <main className="relative z-10 min-h-0 flex-1 overflow-hidden px-12 pt-6">
          <div
            className="flex h-full flex-col justify-start gap-3.5 transition-opacity duration-500"
            style={{ opacity: fadeIn ? 1 : 0 }}
          >
            {groups.length === 0 ? (
              <p className="pt-10 text-[1.6rem] font-semibold text-[--tv-slate]">
                Acompanhe as próximas demonstrações no estande.
              </p>
            ) : (
              groups.map((g) => (
                <section key={g.label} className="flex flex-col gap-3.5">
                  <div className="flex items-center gap-4">
                    <h3 className="text-[1.15rem] font-bold uppercase tracking-[0.24em] text-[--tv-blue]">
                      {g.label}
                    </h3>
                    <span className="h-px flex-1 bg-[--tv-line]" />
                  </div>
                  {g.items.map((s) => {
                    const kind = statusOf(s, now, next?.key);
                    return (
                      <article
                        key={s.key}
                        className="tv-card flex h-[155px] items-center gap-7 rounded-[16px] px-8"
                      >
                        <Avatar slot={s} size={96} />
                        <InstagramQR handle={s.instagram} size={88} caption={false} />

                        <div className="w-[300px] shrink-0">
                          <p className="line-clamp-2 text-[1.95rem] font-bold leading-tight text-[--tv-navy]">
                            {s.name}
                          </p>
                          {s.instagram && (
                            <p className="text-[1.3rem] font-semibold leading-tight text-[--tv-slate]">
                              @{s.instagram}
                            </p>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 border-l border-[--tv-line] pl-7">
                          <h4 className="line-clamp-2 text-[2.1rem] font-bold leading-[1.15] text-[--tv-navy]">
                            {s.theme || "Demonstração Smart Dent"}
                          </h4>
                        </div>

                        <div className="w-[250px] shrink-0 border-l border-[--tv-line] pl-7 text-right">
                          <p className="text-[2.4rem] font-bold leading-none tabular-nums text-[--tv-navy]">
                            {fmtTime(s.start) || "--:--"}
                          </p>
                          <div className="mt-2 flex justify-end">
                            <StatusPill kind={kind} />
                          </div>
                          {kind !== "live" && kind !== "done" && (
                            <p className="mt-1.5 text-[1.15rem] font-semibold text-[--tv-orange]">
                              {countdownLabel(s.start, now, true)}
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
              <p className="text-[1.7rem] font-bold leading-tight text-[--tv-navy]">
                Escaneie e acesse a agenda completa
              </p>
              <p className="text-[1.25rem] font-semibold leading-tight text-[--tv-orange]">
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
