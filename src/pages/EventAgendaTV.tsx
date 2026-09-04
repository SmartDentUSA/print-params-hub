import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { getStorageImageUrl } from "@/utils/storageImage";

const SMARTDENT_LOGO_URL =
  "https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png";



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
  dateLabel: string;
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

const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const fmtDate = (d: Date | null) =>
  d ? `${WEEK[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : "";
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
        theme: sp.theme || "",
        instagram: handleOf(sp.instagram),
        photo_url: sp.photo_url || "",
        start,
        end,
        dateLabel: fmtDate(start),
        timeLabel: [fmtTime(start), fmtTime(end)].filter(Boolean).join(" – "),
      });
    });
  });
  return out
    .filter((s) => s.name)
    .sort((a, b) => (a.start?.getTime() ?? Infinity) - (b.start?.getTime() ?? Infinity));
}

function countdown(target: Date | null, now: Date): string {
  if (!target) return "";
  let ms = target.getTime() - now.getTime();
  if (ms <= 0) return "";
  const h = Math.floor(ms / 3600000);
  ms -= h * 3600000;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms - m * 60000) / 1000);
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* QR                                                                 */
/* ------------------------------------------------------------------ */

function InstagramQR({ handle, size = 180 }: { handle: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const url = instaUrl(handle);
    if (!url) return setSrc("");
    QRCode.toDataURL(url, { width: size * 2, margin: 2, color: { dark: "#0b1220", light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [handle, size]);
  if (!src) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <img
        src={src}
        alt={`QR code do Instagram @${handle}`}
        width={size}
        height={size}
        className="rounded-2xl bg-background p-2"
        style={{ width: size, height: size }}
      />
      <span className="text-[1.25rem] font-black tracking-wide text-primary-foreground/90">@{handle}</span>
    </div>
  );
}

function FooterQR({ url, size = 90 }: { url: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(url, { width: size * 2, margin: 2, color: { dark: "#0b1220", light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [url, size]);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={`QR code ${url}`}
      width={size}
      height={size}
      className="rounded-xl"
      style={{ width: size, height: size }}
    />
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
  const pagesRef = useRef(1);

  /* Relógio */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
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
  const upcoming = useMemo(() => {
    const t = now.getTime();
    const withDate = slots.filter((s) => {
      if (!s.start) return false;
      const end = s.end ?? new Date(s.start.getTime() + 45 * 60 * 1000);
      return end.getTime() > t;
    });
    const noDate = slots.filter((s) => !s.start);
    return [...withDate, ...noDate];
  }, [slots, now]);

  const perPage = Number(params.get("por") || 4) || 4;
  const pages = Math.max(1, Math.ceil(upcoming.length / perPage));
  pagesRef.current = pages;

  /* Rotação automática das páginas */
  useEffect(() => {
    if (pages <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pagesRef.current), 20_000);
    return () => clearInterval(t);
  }, [pages]);

  const visible = upcoming.slice((page % pages) * perPage, (page % pages) * perPage + perPage);
  const next = upcoming.find((s) => s.start && s.start.getTime() > now.getTime());

  /* Agrupa a tela por dia: o dia corrente vai esvaziando e os próximos dias entram */
  const groups = useMemo(() => {
    const todayLabel = fmtDate(now);
    const out: { label: string; isToday: boolean; items: Slot[] }[] = [];
    visible.forEach((s) => {
      const label = s.dateLabel || "Data a definir";
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(s);
      else out.push({ label, isToday: label === todayLabel, items: [s] });
    });
    return out;
  }, [visible, now]);


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(222_47%_8%)] text-2xl text-primary-foreground/70">
        Carregando agenda…
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(222_47%_8%)] text-2xl text-primary-foreground/70">
        Evento não encontrado.
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[hsl(222_47%_8%)] text-primary-foreground">
      {/* Header */}
      <header className="flex items-center justify-between gap-8 border-b border-white/15 px-12 py-7">
        <div className="flex items-center gap-8">
          {event.event_logo_url && (
            <img
              src={getStorageImageUrl(event.event_logo_url, { width: 260 })}
              alt={event.name}
              className="h-20 w-auto object-contain"
            />
          )}
          <div>
            <h1 className="text-[3.2rem] font-black leading-none tracking-tight text-white">
              Agenda de Demonstrações
            </h1>
            <p className="pt-2 text-[1.6rem] font-bold leading-tight text-primary-foreground/85">
              {event.name}
              {event.company_stand ? ` · Estande ${event.company_stand}` : ""}
              {event.location ? ` · ${event.location}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-4">
          <img
            src={SMARTDENT_LOGO_URL}
            alt="Smart Dent"
            className="h-16 w-auto object-contain brightness-0 invert"
          />
          <div className="text-right">
            <div className="font-mono text-[4rem] font-black leading-none tabular-nums text-white">
              {fmtTime(now)}
              <span className="text-[2rem] text-primary-foreground/60">:{String(now.getSeconds()).padStart(2, "0")}</span>
            </div>
            <p className="text-[1.4rem] font-black uppercase tracking-widest text-primary-foreground/70">
              {fmtDate(now)}
            </p>
          </div>
        </div>
      </header>


      {/* Próxima demonstração */}
      {next && (
        <div className="flex items-center justify-between gap-6 bg-primary/20 px-12 py-5">
          <p className="text-[1.8rem] font-bold text-primary-foreground/95">
            Próxima demonstração: <span className="font-black text-white">{next.name}</span>
            <span className="text-primary-foreground/80"> · {next.timeLabel || fmtTime(next.start)}</span>
          </p>
          <p className="font-mono text-[2.6rem] font-black tabular-nums text-emerald-400">
            começa em {countdown(next.start, now)}
          </p>
        </div>
      )}

      {/* Lista */}
      <main className="flex-1 px-12 py-8">
        {visible.length === 0 ? (
          <p className="pt-24 text-center text-[2.6rem] font-black leading-tight text-primary-foreground/80">
            Nenhuma demonstração programada no momento.<br />
            <span className="text-[1.8rem] font-semibold text-primary-foreground/60">
              Visite o estande {event.company_stand || "Smart Dent"}.
            </span>
          </p>
        ) : (
          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.label} className="space-y-5">
                <div className="flex items-center gap-4">
                  <h3 className="text-[1.6rem] font-black uppercase tracking-[0.25em] text-primary-foreground/80">
                    {g.isToday ? `Hoje · ${g.label}` : g.label}
                  </h3>
                  <span className="h-px flex-1 bg-white/15" />
                </div>
                {g.items.map((s) => {
                  const live = s.start && s.end && now >= s.start && now <= s.end;
                  const cd = countdown(s.start, now);
                  return (
                    <article
                      key={s.key}
                      className={`grid grid-cols-[auto_auto_auto_1fr_auto_auto] items-center gap-8 rounded-[1.75rem] border px-8 py-5 ${
                        live
                          ? "border-emerald-400/60 bg-emerald-400/10 shadow-[0_0_80px_-24px_hsl(var(--primary))]"
                          : "border-white/15 bg-white/[0.05]"
                      }`}
                    >
                      {/* Foto */}
                      <div className="h-[130px] w-[130px] shrink-0 overflow-hidden rounded-2xl bg-white/10 ring-2 ring-white/10">
                        {s.photo_url ? (
                          <img
                            src={getStorageImageUrl(s.photo_url, { width: 400, height: 400, resize: "cover" })}
                            alt={s.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[3rem] font-black text-primary-foreground/50">
                            {s.name.slice(0, 1)}
                          </div>
                        )}
                      </div>

                      {/* QR do Instagram */}
                      <div className="shrink-0">
                        <InstagramQR handle={s.instagram} size={120} />
                      </div>

                      {/* Nome do palestrante */}
                      <div className="shrink-0 max-w-[320px]">
                        {live && (
                          <span className="mb-2 inline-block rounded-full bg-emerald-500 px-4 py-1 text-[1rem] font-black uppercase tracking-widest text-[#0b1220]">
                            Ao vivo
                          </span>
                        )}
                        <p className="text-[1.9rem] font-black leading-tight text-white">
                          {s.name}
                        </p>
                        <p className="mt-1 text-[1.05rem] font-black uppercase tracking-widest text-primary-foreground/70">
                          {s.dateLabel}
                        </p>
                      </div>

                      {/* Tema central — destaque principal */}
                      <div className="min-w-0 px-4 text-center">
                        <h2 className="text-[2.4rem] font-black uppercase leading-tight tracking-tight text-white">
                          {s.theme || "—"}
                        </h2>
                      </div>

                      {/* Início */}
                      <div className="shrink-0 text-center">
                        <p className="text-[1.25rem] font-black uppercase tracking-widest text-primary-foreground/70">
                          Início
                        </p>
                        <p className="mt-1 font-mono text-[3rem] font-black leading-none tabular-nums text-white">
                          {fmtTime(s.start) || "--:--"}
                        </p>
                      </div>

                      {/* Começa em */}
                      <div className="w-[220px] shrink-0 text-center">
                        <p className="text-[1.25rem] font-black uppercase tracking-widest text-primary-foreground/70">
                          {live ? "Status" : "Começa em"}
                        </p>
                        <p className="mt-1 font-mono text-[3rem] font-black leading-none tabular-nums text-emerald-400">
                          {live ? "ao vivo" : cd || "—"}
                        </p>
                      </div>

                    </article>
                  );
                })}
              </section>
            ))}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between gap-8 border-t border-white/15 bg-[hsl(222_47%_8%)] px-12 py-5">
        <div className="flex items-center gap-6">
          <div className="shrink-0 rounded-2xl bg-white p-2">
            <FooterQR url="https://parametros.smartdent.com.br/CIPRO" size={90} />
          </div>
          <div>
            <p className="text-[1.8rem] font-black leading-tight text-white">
              Perdeu alguma demonstração?
            </p>
            <p className="text-[1.5rem] font-bold leading-tight text-primary-foreground/90">
              Escaneie o QR Code e receba o acesso à aula.
            </p>
            <p className="mt-1 text-[1.15rem] font-semibold tracking-wide text-primary-foreground/60">
              parametros.smartdent.com.br/CIPRO
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-right text-[1.25rem] font-black text-primary-foreground/70">
            Smart Dent | Fluxo Digital
            {event.instagram_handle ? <br /> : null}
            {event.instagram_handle ? event.instagram_handle : ""}
          </span>
          {pages > 1 && (
            <span className="flex items-center gap-3">
              {Array.from({ length: pages }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full ${i === page % pages ? "bg-primary" : "bg-white/30"}`}
                />
              ))}
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
