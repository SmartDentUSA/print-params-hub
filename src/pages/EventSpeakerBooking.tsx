import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CalendarDays, CheckCircle2, Clock, Instagram, Loader2, MapPin, RefreshCw, User } from "lucide-react";

type Session = { date?: string; start_time?: string; end_time?: string };
type Speaker = { name?: string; instagram?: string; theme?: string; photo_url?: string; sessions?: Session[] };
type EventInfo = {
  id: string;
  name: string;
  location: string | null;
  company_stand: string | null;
  start_date: string | null;
  end_date: string | null;
  event_logo_url: string | null;
  instagram_handle: string | null;
};

const FN = "event-speaker-booking";
const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 20;

const handleOf = (v?: string | null) =>
  String(v || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .toLowerCase();

const dayLabel = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  const wd = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][dt.getUTCDay()];
  return { wd: wd.toUpperCase(), day: String(dd).padStart(2, "0"), month: String(m).padStart(2, "0") };
};

function buildSlots() {
  const out: string[] = [];
  for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
  }
  return out;
}
const SLOTS = buildSlots();

export default function EventSpeakerBooking() {
  const { eventId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [activeDay, setActiveDay] = useState<string>("");

  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [theme, setTheme] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]); // "YYYY-MM-DD|HH:MM"
  const [done, setDone] = useState(false);
  const identityLoaded = useRef(false);

  const call = useCallback(
    async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke(FN, {
        body: { event_id: eventId, ...payload },
      });
      if (error) {
        const ctx: any = (error as any).context;
        let msg = error.message;
        try {
          const j = await ctx?.json?.();
          if (j?.error) msg = j.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    [eventId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await call({ action: "bootstrap" });
      setEvent(res.event);
      setDays(res.days || []);
      setSpeakers(res.speakers || []);
      setActiveDay((cur) => cur || (res.days?.[0] ?? ""));
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar a agenda.");
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => { load(); }, [load]);

  // Recupera identidade salva no aparelho
  useEffect(() => {
    if (identityLoaded.current) return;
    identityLoaded.current = true;
    try {
      const raw = localStorage.getItem(`kol-agenda:${eventId}`);
      if (raw) {
        const j = JSON.parse(raw);
        setName(j.name || "");
        setInstagram(j.instagram || "");
      }
    } catch { /* ignore */ }
  }, [eventId]);

  const myKey = handleOf(instagram) || name.trim().toLowerCase();

  const mine = useMemo(
    () =>
      speakers.find((s) =>
        handleOf(instagram)
          ? handleOf(s.instagram) === handleOf(instagram)
          : !!name.trim() && (s.name || "").trim().toLowerCase() === name.trim().toLowerCase(),
      ),
    [speakers, instagram, name],
  );

  // Pré-carrega horários e tema já reservados por este palestrante
  useEffect(() => {
    if (!mine || done) return;
    setTheme((cur) => cur || mine.theme || "");
    setSelected(
      (mine.sessions || [])
        .filter((s) => s.date && s.start_time)
        .map((s) => `${s.date}|${String(s.start_time).slice(0, 5)}`),
    );
  }, [mine, done]);

  const takenByOthers = useMemo(() => {
    const toMin = (t?: string) => {
      const [h, m] = String(t || "").slice(0, 5).split(":").map(Number);
      return Number.isFinite(h) ? h * 60 + (m || 0) : null;
    };
    const map = new Map<string, Speaker>();
    for (const s of speakers) {
      const isMe = handleOf(instagram)
        ? handleOf(s.instagram) === handleOf(instagram)
        : !!name.trim() && (s.name || "").trim().toLowerCase() === name.trim().toLowerCase();
      if (isMe) continue;
      for (const ses of s.sessions || []) {
        const start = toMin(ses.start_time);
        if (!ses.date || start === null) continue;
        const end = toMin(ses.end_time) ?? start + 60;
        // Bloqueia todas as células de 1 hora que a sessão ocupa (mesmo horários fora da grade)
        for (const t of SLOTS) {
          const cell = toMin(t)!;
          if (cell < end && cell + 60 > start) map.set(`${ses.date}|${t}`, s);
        }
      }
    }
    return map;
  }, [speakers, instagram, name, myKey]);

  const toggle = (key: string) => {
    if (takenByOthers.has(key)) return;
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  };

  const onPhoto = (f: File | null) => {
    setPhotoFile(f);
    setPhotoPreview(f ? URL.createObjectURL(f) : "");
  };

  const fileToBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(f);
    });

  async function submit() {
    if (name.trim().length < 3) return toast.error("Informe seu nome completo.");
    if (theme.trim().length < 3) return toast.error("Informe o tema da sua demonstração.");
    if (!selected.length) return toast.error("Selecione pelo menos um horário.");
    setSaving(true);
    try {
      let photo_base64: string | undefined;
      let photo_ext: string | undefined;
      if (photoFile) {
        photo_base64 = await fileToBase64(photoFile);
        photo_ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
      }
      const res = await call({
        action: "book",
        name: name.trim(),
        instagram: instagram.trim(),
        theme: theme.trim(),
        photo_base64,
        photo_ext,
        slots: selected.map((k) => {
          const [date, start_time] = k.split("|");
          return { date, start_time };
        }),
      });
      setSpeakers(res.speakers || []);
      setDone(true);
      try {
        localStorage.setItem(`kol-agenda:${eventId}`, JSON.stringify({ name: name.trim(), instagram: instagram.trim() }));
      } catch { /* ignore */ }
      toast.success("Agenda confirmada! Já aparece na TV do estande.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao confirmar");
      load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center bg-background">
        <p className="text-sm text-muted-foreground">{error || "Evento não encontrado."}</p>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente</Button>
      </div>
    );
  }

  const daySlots = activeDay ? SLOTS : [];

  return (
    <div className="min-h-screen bg-muted/30 pb-28">
      <header className="bg-primary text-primary-foreground px-4 py-5">
        <div className="mx-auto max-w-2xl space-y-2">
          {event.event_logo_url && (
            <img src={event.event_logo_url} alt={event.name} className="h-10 w-auto object-contain" />
          )}
          <h1 className="text-lg font-bold leading-tight">{event.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-90">
            {event.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.location}</span>}
            {event.company_stand && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Estande {event.company_stand}</span>}
          </div>
          <p className="text-xs opacity-90 pt-1">
            Escolha seus horários de demonstração no estande Smart Dent e informe o tema. A TV do estande atualiza automaticamente.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <Label className="text-xs">Seu nome completo *</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Nome Sobrenome" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Seu Instagram</Label>
              <div className="relative">
                <Instagram className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@seuperfil" />
              </div>
              <p className="pt-1 text-[11px] text-muted-foreground">Vira o QR Code exibido na TV do estande.</p>
            </div>
            <div>
              <Label className="text-xs">Tema da sua demonstração *</Label>
              <Textarea value={theme} onChange={(e) => setTheme(e.target.value)} rows={2} placeholder="Ex.: Fluxo digital completo em prótese total" />
            </div>
            <div>
              <Label className="text-xs">Sua foto (opcional)</Label>
              <div className="flex items-center gap-3">
                {(photoPreview || mine?.photo_url) && (
                  <img src={photoPreview || mine?.photo_url} alt="" className="h-14 w-14 rounded-full border object-cover" />
                )}
                <Input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => {
            const l = dayLabel(d);
            const count = selected.filter((k) => k.startsWith(`${d}|`)).length;
            return (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                className={cn(
                  "relative min-w-[76px] rounded-xl border px-3 py-2 text-center transition-colors",
                  activeDay === d ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                )}
              >
                <div className="text-[10px] font-semibold opacity-80">{l.wd}</div>
                <div className="text-lg font-bold leading-none">{l.day}</div>
                <div className="text-[10px] opacity-80">/{l.month}</div>
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4" /> Horários de 1 em 1 hora
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {daySlots.map((t) => {
                const key = `${activeDay}|${t}`;
                const other = takenByOthers.get(key);
                const isMine = selected.includes(key);
                return (
                  <button
                    key={key}
                    disabled={!!other}
                    onClick={() => toggle(key)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                      other && "cursor-not-allowed border-dashed bg-muted text-muted-foreground",
                      !other && isMine && "border-emerald-600 bg-emerald-600 text-white",
                      !other && !isMine && "bg-card hover:bg-accent",
                    )}
                    title={other ? `Reservado por ${other.name}` : undefined}
                  >
                    <div className="tabular-nums">{t}</div>
                    {other && <div className="truncate text-[10px] opacity-80">{other.name}</div>}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border bg-card" /> Livre</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-600" /> Seu horário</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border border-dashed bg-muted" /> Ocupado</span>
            </div>
          </CardContent>
        </Card>

        {speakers.length > 0 && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="text-sm font-semibold">Agenda do dia {activeDay ? dayLabel(activeDay).day : ""}</div>
              {speakers
                .flatMap((s) => (s.sessions || []).map((ses) => ({ s, ses })))
                .filter(({ ses }) => ses.date === activeDay)
                .sort((a, b) => String(a.ses.start_time).localeCompare(String(b.ses.start_time)))
                .map(({ s, ses }, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border p-2">
                    <Badge variant="secondary" className="tabular-nums">{String(ses.start_time).slice(0, 5)}</Badge>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{s.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{s.theme}</div>
                    </div>
                  </div>
                ))}
              {!speakers.some((s) => (s.sessions || []).some((x) => x.date === activeDay)) && (
                <p className="text-xs text-muted-foreground">Nenhuma demonstração reservada neste dia ainda.</p>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex-1 text-xs text-muted-foreground">
            {selected.length
              ? `${selected.length} horário${selected.length > 1 ? "s" : ""} selecionado${selected.length > 1 ? "s" : ""}`
              : "Selecione seus horários"}
          </div>
          <Button onClick={submit} disabled={saving} className="min-w-[160px]">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {done ? "Atualizar agenda" : "Confirmar agenda"}
          </Button>
        </div>
      </div>
    </div>
  );
}
