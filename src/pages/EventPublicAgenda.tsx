import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Instagram, MapPin, CalendarDays, Clock, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStorageImageUrl } from "@/utils/storageImage";

const SMARTDENT_LOGO_URL =
  "https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png";

/* ---------------- tipos ---------------- */

type Session = { date?: string; start_time?: string; end_time?: string; theme?: string };
type Speaker = {
  name?: string;
  theme?: string;
  instagram?: string;
  photo_url?: string;
  mini_cv?: string;
  specialty?: string;
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

/* ---------------- helpers ---------------- */

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

function spOffsetMinutes(d: Date): number {
  const p = spParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - d.getTime()) / 60000);
}

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

const WEEK_LONG = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const MONTH_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const dayKeyOf = (d: Date) => {
  const p = spParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};
const fmtDayLong = (d: Date) => {
  const p = spParts(d);
  return `${WEEK_LONG[p.weekday]}, ${String(p.day).padStart(2, "0")} ${MONTH_SHORT[p.month - 1]}`;
};
const fmtDayShort = (d: Date) => {
  const p = spParts(d);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}`;
};
const fmtTime = (d: Date | null) => {
  if (!d) return "";
  const p = spParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

const cleanTheme = (v?: string | null) => {
  const t = String(v || "").trim();
  if (!t) return "";
  if (/^[x\-_.\s]{3,}$/i.test(t)) return "";
  if (/^(a\s*definir|tbd|placeholder)$/i.test(t)) return "";
  return t;
};

type Item = {
  key: string;
  name: string;
  theme: string;
  instagram: string;
  photo_url: string;
  specialty: string;
  start: Date;
  end: Date;
};

function buildItems(speakers: Speaker[], field: "sessions" | "support_sessions"): Item[] {
  const out: Item[] = [];
  speakers.forEach((sp, i) => {
    if (!sp.name) return;
    (sp[field] || []).forEach((se, j) => {
      const start = toDate(se.date, se.start_time);
      if (!start) return;
      const rawEnd = toDate(se.date, se.end_time || se.start_time);
      const end =
        rawEnd && rawEnd.getTime() > start.getTime()
          ? rawEnd
          : new Date(start.getTime() + 60 * 60 * 1000);
      out.push({
        key: `${field}-${i}-${j}`,
        name: sp.name || "",
        theme: cleanTheme(se.theme || sp.theme),
        instagram: handleOf(sp.instagram),
        photo_url: sp.photo_url || "",
        specialty: sp.specialty || "",
        start,
        end,
      });
    });
  });
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/* ---------------- peças ---------------- */

function Avatar({ name, photo, size = 56 }: { name: string; photo?: string; size?: number }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full border border-border bg-muted"
      style={{ width: size, height: size }}
    >
      {photo ? (
        <img
          src={getStorageImageUrl(photo, { width: 240, height: 240, resize: "cover" })}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-lg font-bold text-primary">
          {name.slice(0, 1)}
        </div>
      )}
    </div>
  );
}

function InstaLink({ handle }: { handle: string }) {
  if (!handle) return null;
  return (
    <a
      href={instaUrl(handle)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
    >
      <Instagram className="h-3.5 w-3.5" />@{handle}
    </a>
  );
}

/* ---------------- página ---------------- */

export default function EventPublicAgenda({ term }: { term?: string }) {
  const { slug } = useParams<{ slug: string }>();
  const key = (term || slug || "").trim();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [activeDay, setActiveDay] = useState<string>("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const cols =
      "id,name,slug,location,company_stand,start_date,end_date,event_logo_url,instagram_handle,speakers";
    const load = async () => {
      const base = () => supabase.from("smartops_events").select(cols).eq("is_active", true).limit(1);
      let row: EventRow | null = null;
      if (/^[0-9a-f-]{36}$/i.test(key)) {
        const { data } = await base().eq("id", key);
        row = ((data || [])[0] as unknown as EventRow) ?? null;
      }
      if (!row) {
        const { data } = await base().eq("slug", key);
        row = ((data || [])[0] as unknown as EventRow) ?? null;
      }
      if (!row && key) {
        const { data } = await supabase
          .from("smartops_events")
          .select(cols)
          .eq("is_active", true)
          .ilike("name", `%${key}%`)
          .order("start_date", { ascending: false })
          .limit(1);
        row = ((data || [])[0] as unknown as EventRow) ?? null;
      }
      if (!alive) return;
      setEvent(row);
      setLoading(false);
    };
    load();
    const t = setInterval(load, 120_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [key]);

  const speakers = (event?.speakers as Speaker[]) || [];
  const demos = useMemo(() => buildItems(speakers, "sessions"), [event]);
  const support = useMemo(() => buildItems(speakers, "support_sessions"), [event]);

  const days = useMemo(() => {
    const map = new Map<string, Date>();
    [...demos, ...support].forEach((i) => {
      const k = dayKeyOf(i.start);
      if (!map.has(k)) map.set(k, i.start);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [demos, support]);

  useEffect(() => {
    if (!days.length) return;
    const todayKey = dayKeyOf(now);
    const preferred = days.find(([k]) => k >= todayKey) ?? days[0];
    setActiveDay((cur) => (cur && days.some(([k]) => k === cur) ? cur : preferred[0]));
  }, [days.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayDemos = demos.filter((i) => dayKeyOf(i.start) === activeDay);
  const daySupport = support.filter((i) => dayKeyOf(i.start) === activeDay);
  const t = now.getTime();

  const pageTitle = event ? `Agenda de demonstrações — ${event.name}` : "Agenda de demonstrações";

  useEffect(() => {
    document.title = pageTitle.slice(0, 60);
    const desc =
      "Agenda completa de demonstrações e horários dos especialistas Smart Dent no estande do congresso.";
    let m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
    }
    m.setAttribute("content", desc);
  }, [pageTitle]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Agenda não encontrada</h1>
        <p className="text-sm text-muted-foreground">
          Confira o link do evento ou fale com o time Smart Dent.
        </p>
      </div>
    );
  }

  const period = [event.start_date, event.end_date]
    .filter(Boolean)
    .map((d) => fmtDayShort(toDate(d as string, "12:00") as Date))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(" a ");

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
          <div className="flex items-center justify-between gap-3">
            {event.event_logo_url ? (
              <img
                src={getStorageImageUrl(event.event_logo_url, { width: 320 })}
                alt={event.name}
                className="h-10 w-auto max-w-[45%] object-contain"
              />
            ) : (
              <span className="text-sm font-semibold uppercase tracking-widest opacity-80">
                Evento
              </span>
            )}
            <img
              src={SMARTDENT_LOGO_URL}
              alt="Smart Dent"
              className="h-8 w-auto object-contain brightness-0 invert"
            />
          </div>

          <div>
            <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">{event.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-90">
              {period && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {period}
                </span>
              )}
              {event.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.location}
                </span>
              )}
              {event.company_stand && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-0.5 font-semibold">
                  Estande {event.company_stand}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Abas por dia */}
      {days.length > 0 && (
        <nav className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-3">
            {days.map(([k, d]) => {
              const on = k === activeDay;
              return (
                <button
                  key={k}
                  onClick={() => setActiveDay(k)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    on
                      ? "bg-primary text-primary-foreground shadow"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {fmtDayLong(d)}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        {/* Demonstrações */}
        <section className="space-y-3">
          <h2 className="text-base font-bold uppercase tracking-wide text-foreground">
            Demonstrações do dia
          </h2>
          {dayDemos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nenhuma demonstração publicada para este dia.
            </p>
          ) : (
            <ul className="space-y-3">
              {dayDemos.map((i) => {
                const live = t >= i.start.getTime() && t <= i.end.getTime();
                const done = i.end.getTime() < t;
                return (
                  <li
                    key={i.key}
                    className={`rounded-xl border bg-card p-4 shadow-sm ${
                      live ? "border-primary ring-1 ring-primary/40" : "border-border"
                    } ${done ? "opacity-60" : ""}`}
                  >
                    <div className="flex gap-3">
                      <Avatar name={i.name} photo={i.photo_url} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-sm font-bold text-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {fmtTime(i.start)} – {fmtTime(i.end)}
                          </span>
                          {live && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold uppercase text-primary-foreground">
                              Ao vivo
                            </span>
                          )}
                          {done && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold uppercase text-muted-foreground">
                              Encerrado
                            </span>
                          )}
                        </div>
                        {i.theme && (
                          <p className="mt-1.5 text-base font-bold leading-snug text-foreground">
                            {i.theme}
                          </p>
                        )}
                        <p className="mt-0.5 text-sm font-semibold text-foreground/80">{i.name}</p>
                        {i.specialty && (
                          <p className="text-xs text-muted-foreground">{i.specialty}</p>
                        )}
                        <div className="mt-1">
                          <InstaLink handle={i.instagram} />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Especialistas no estande */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold uppercase tracking-wide text-foreground">
            <Users className="h-4 w-4" />
            Especialistas no estande
          </h2>
          <p className="text-sm text-muted-foreground">
            Horários em que os especialistas estarão no estande para tirar suas dúvidas sobre nossas
            soluções.
          </p>
          {daySupport.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nenhuma disponibilidade informada para este dia.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {daySupport.map((i) => {
                const available = t >= i.start.getTime() && t <= i.end.getTime();
                const done = i.end.getTime() < t;
                return (
                  <li
                    key={i.key}
                    className={`flex gap-3 rounded-xl border bg-card p-4 shadow-sm ${
                      available ? "border-primary ring-1 ring-primary/40" : "border-border"
                    } ${done ? "opacity-60" : ""}`}
                  >
                    <Avatar name={i.name} photo={i.photo_url} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{i.name}</p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-foreground/80">
                        <Clock className="h-3.5 w-3.5" />
                        {fmtTime(i.start)} – {fmtTime(i.end)}
                      </p>
                      {available && (
                        <p className="mt-1 text-xs font-bold uppercase text-primary">
                          Disponível agora
                        </p>
                      )}
                      <div className="mt-1">
                        <InstaLink handle={i.instagram} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
