import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AREA_ATUACAO_OPTIONS, ESPECIALIDADE_OPTIONS } from "@/lib/dentalTaxonomy";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  Clock,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

type Session = { date?: string; start_time?: string; end_time?: string; theme?: string };
type Speaker = {
  name?: string;
  instagram?: string;
  theme?: string;
  photo_url?: string;
  professional_id?: string;
  sessions?: Session[];
  support_sessions?: Session[];
};
type Professional = {
  id: string;
  name: string;
  instagram: string;
  photo_url: string;
  specialty: string;
  cro: string;
  mini_bio: string;
};
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

const SLOTS = Array.from({ length: SLOT_END_HOUR - SLOT_START_HOUR }, (_, i) =>
  `${String(SLOT_START_HOUR + i).padStart(2, "0")}:00`,
);

const DDI_OPTIONS = [
  { value: "55", label: "🇧🇷 +55 (Brasil)" },
  { value: "1", label: "🇺🇸 +1 (EUA/Canadá)" },
  { value: "351", label: "🇵🇹 +351 (Portugal)" },
  { value: "34", label: "🇪🇸 +34 (Espanha)" },
  { value: "54", label: "🇦🇷 +54 (Argentina)" },
  { value: "56", label: "🇨🇱 +56 (Chile)" },
  { value: "57", label: "🇨🇴 +57 (Colômbia)" },
  { value: "52", label: "🇲🇽 +52 (México)" },
];

// Mesmos campos e taxonomias do cadastro de Profissionais em Cursos
const emptyNew = {
  name: "",
  email: "",
  area_atuacao: "",
  specialty: "",
  birth_date: "",
  cro: "",
  course_platform: "",
  instagram: "",
  wa_ddi: "55",
  wa_number: "",
  mini_bio: "",
};

export default function EventSpeakerBooking() {
  const { eventId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [activeDay, setActiveDay] = useState<string>("");

  const [personId, setPersonId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Modal de tema por horário
  const [slotDialog, setSlotDialog] = useState<{ date: string; time: string; theme: string; existing: boolean } | null>(null);

  // Modal de novo palestrante
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ ...emptyNew });
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  const restored = useRef(false);

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
      setProfessionals(res.professionals || []);
      setActiveDay((cur) => cur || (res.days?.[0] ?? ""));
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar a agenda.");
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => { load(); }, [load]);

  // Recupera palestrante escolhido neste aparelho
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = localStorage.getItem(`kol-agenda:${eventId}`);
      if (saved) setPersonId(JSON.parse(saved)?.professional_id || "");
    } catch { /* ignore */ }
  }, [eventId]);

  const person = useMemo(() => professionals.find((p) => p.id === personId) ?? null, [professionals, personId]);

  const mine = useMemo(() => {
    if (!person) return null;
    return (
      speakers.find((s) => s.professional_id === person.id) ??
      speakers.find((s) => handleOf(s.instagram) && handleOf(s.instagram) === handleOf(person.instagram)) ??
      speakers.find((s) => (s.name || "").trim().toLowerCase() === person.name.trim().toLowerCase()) ??
      null
    );
  }, [speakers, person]);

  const mySessions = useMemo<Session[]>(
    () => (mine?.sessions || []).filter((s) => s.date && s.start_time),
    [mine],
  );

  const mySupport = useMemo<Session[]>(
    () => (mine?.support_sessions || []).filter((s) => s.date && s.start_time),
    [mine],
  );

  const mySupportAt = (date: string, time: string) =>
    mySupport.find((s) => s.date === date && String(s.start_time).slice(0, 5) === time) ?? null;

  const mySlotAt = (date: string, time: string) =>
    mySessions.find((s) => s.date === date && String(s.start_time).slice(0, 5) === time) ?? null;

  const takenByOthers = useMemo(() => {
    const toMin = (t?: string) => {
      const [h, m] = String(t || "").slice(0, 5).split(":").map(Number);
      return Number.isFinite(h) ? h * 60 + (m || 0) : null;
    };
    const map = new Map<string, Speaker>();
    for (const s of speakers) {
      if (mine && s === mine) continue;
      for (const ses of s.sessions || []) {
        const start = toMin(ses.start_time);
        if (!ses.date || start === null) continue;
        const end = toMin(ses.end_time) ?? start + 60;
        for (const t of SLOTS) {
          const cell = toMin(t)!;
          if (cell < end && cell + 60 > start) map.set(`${ses.date}|${t}`, s);
        }
      }
    }
    return map;
  }, [speakers, mine]);

  const persist = useCallback(
    async (slots: Session[], support: Session[] = mySupport) => {
      if (!person) return;
      setSaving(true);
      try {
        const res = await call({
          action: slots.length || support.length ? "book" : "release",
          professional_id: person.id,
          name: person.name,
          instagram: person.instagram,
          photo_url: person.photo_url,
          slots: slots.map((s) => ({ date: s.date, start_time: String(s.start_time).slice(0, 5), theme: s.theme })),
          support_slots: support.map((s) => ({ date: s.date, start_time: String(s.start_time).slice(0, 5) })),
        });
        setSpeakers(res.speakers || []);
        try {
          localStorage.setItem(`kol-agenda:${eventId}`, JSON.stringify({ professional_id: person.id }));
        } catch { /* ignore */ }
        return true;
      } catch (e: any) {
        toast.error(e?.message || "Falha ao salvar horário");
        load();
        return false;
      } finally {
        setSaving(false);
      }
    },
    [call, person, eventId, load, mySupport],
  );

  function openSlot(date: string, time: string) {
    if (!person) return toast.error("Selecione o palestrante primeiro.");
    if (takenByOthers.has(`${date}|${time}`)) return;
    const existing = mySlotAt(date, time);
    setSlotDialog({
      date,
      time,
      theme: existing?.theme || mySessions[0]?.theme || "",
      existing: !!existing,
    });
  }

  async function confirmSlot() {
    if (!slotDialog) return;
    const theme = slotDialog.theme.trim();
    if (theme.length < 3) return toast.error("Informe o tema da demonstração.");
    const rest = mySessions.filter(
      (s) => !(s.date === slotDialog.date && String(s.start_time).slice(0, 5) === slotDialog.time),
    );
    const next = [...rest, { date: slotDialog.date, start_time: slotDialog.time, theme }].sort((a, b) =>
      `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`),
    );
    const ok = await persist(next);
    if (ok) {
      setSlotDialog(null);
      toast.success("Horário confirmado! Já aparece na TV do estande.");
    }
  }

  async function removeSlot() {
    if (!slotDialog) return;
    const next = mySessions.filter(
      (s) => !(s.date === slotDialog.date && String(s.start_time).slice(0, 5) === slotDialog.time),
    );
    const ok = await persist(next);
    if (ok) {
      setSlotDialog(null);
      toast.success("Horário liberado.");
    }
  }

  async function toggleSupport(date: string, time: string) {
    if (!person) return toast.error("Selecione o palestrante primeiro.");
    if (mySlotAt(date, time)) return; // já estará no estande palestrando
    const exists = mySupportAt(date, time);
    const next = exists
      ? mySupport.filter((s) => !(s.date === date && String(s.start_time).slice(0, 5) === time))
      : [...mySupport, { date, start_time: time }].sort((a, b) =>
          `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`),
        );
    const ok = await persist(mySessions, next);
    if (ok) toast.success(exists ? "Apoio removido." : "Apoio comercial confirmado!");
  }

  const fileToBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(f);
    });

  async function createProfessional() {
    if (newForm.name.trim().length < 3) return toast.error("Informe o nome completo.");
    setCreating(true);
    try {
      let photo_base64: string | undefined;
      let photo_ext: string | undefined;
      if (newPhoto) {
        photo_base64 = await fileToBase64(newPhoto);
        photo_ext = (newPhoto.name.split(".").pop() || "jpg").toLowerCase();
      }
      const res = await call({ action: "create_professional", ...newForm, photo_base64, photo_ext });
      setProfessionals(res.professionals || []);
      setPersonId(res.professional?.id || "");
      setNewOpen(false);
      setNewForm({ ...emptyNew });
      setNewPhoto(null);
      toast.success("Palestrante cadastrado e disponível na lista de Profissionais.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao cadastrar palestrante");
    } finally {
      setCreating(false);
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

  return (
    <div className="min-h-screen bg-muted/30 pb-10">
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
            Selecione o palestrante, toque no dia e no horário e informe o tema. A TV do estande atualiza automaticamente.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {/* Seleção do palestrante */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <Label className="text-xs">Palestrante *</Label>
            <div className="flex gap-2">
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                    <span className={cn("truncate", !person && "text-muted-foreground")}>
                      {person ? person.name : "Selecione o palestrante…"}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar profissional…" />
                    <CommandList className="max-h-72">
                      <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
                      <CommandGroup heading="Profissionais liberados">
                        {professionals.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.name} ${p.specialty} ${p.instagram}`}
                            onSelect={() => {
                              setPersonId(p.id);
                              setPickerOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", personId === p.id ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{p.name}</span>
                            {p.specialty && (
                              <span className="ml-2 truncate text-xs text-muted-foreground">{p.specialty}</span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button variant="secondary" onClick={() => setNewOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Novo
              </Button>
            </div>

            {person && (
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                {person.photo_url ? (
                  <img src={person.photo_url} alt={person.name} className="h-12 w-12 rounded-full border object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted text-sm font-bold">
                    {person.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{person.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[person.specialty, person.instagram].filter(Boolean).join(" • ") || "Perfil cadastrado"}
                  </div>
                </div>
                <Badge variant="secondary" className="ml-auto shrink-0">
                  {mySessions.length} horário{mySessions.length === 1 ? "" : "s"}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendário de demonstrações */}
        <div>
          <h2 className="text-base font-bold">Calendário de demonstrações</h2>
          <p className="text-xs text-muted-foreground">
            Escolha os horários em que você vai palestrar no estande. A TV atualiza automaticamente.
          </p>
        </div>

        {/* Dias */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => {
            const l = dayLabel(d);
            const count = mySessions.filter((s) => s.date === d).length;
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

        {/* Grade de horários */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4" /> Horários de 1 em 1 hora
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(activeDay ? SLOTS : []).map((t) => {
                const key = `${activeDay}|${t}`;
                const other = takenByOthers.get(key);
                const own = mySlotAt(activeDay, t);
                return (
                  <button
                    key={key}
                    disabled={!!other || saving}
                    onClick={() => openSlot(activeDay, t)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                      other && "cursor-not-allowed border-dashed bg-muted text-muted-foreground",
                      !other && own && "border-emerald-600 bg-emerald-600 text-white",
                      !other && !own && "bg-card hover:bg-accent",
                    )}
                    title={other ? `Reservado por ${other.name}` : own?.theme || undefined}
                  >
                    <div className="tabular-nums">{t}</div>
                    {other && <div className="truncate text-[10px] opacity-80">{other.name}</div>}
                    {!other && own?.theme && <div className="truncate text-[10px] opacity-90">{own.theme}</div>}
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

        {/* Calendário de apoio comercial */}
        <div className="pt-2">
          <h2 className="text-base font-bold">Disponibilidade para apoio comercial durante o evento</h2>
          <p className="text-xs text-muted-foreground">
            Selecione os horários em que você estará disponível no estande da Smart Dent para apoio do time comercial.
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4" /> Apoio comercial — {activeDay ? `${dayLabel(activeDay).day}/${dayLabel(activeDay).month}` : ""}
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(activeDay ? SLOTS : []).map((t) => {
                const talk = mySlotAt(activeDay, t);
                const sup = mySupportAt(activeDay, t);
                return (
                  <button
                    key={`sup-${activeDay}|${t}`}
                    disabled={!!talk || saving}
                    onClick={() => toggleSupport(activeDay, t)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                      talk && "cursor-not-allowed bg-muted text-muted-foreground opacity-50",
                      !talk && sup && "border-sky-600 bg-sky-600 text-white",
                      !talk && !sup && "bg-card hover:bg-accent",
                    )}
                    title={talk ? "Você já estará no estande palestrando neste horário" : undefined}
                  >
                    <div className="tabular-nums">{t}</div>
                    {talk && <div className="truncate text-[10px] opacity-80">No estande (palestra)</div>}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border bg-card" /> Disponível p/ marcar</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-600" /> Apoio confirmado</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-muted opacity-50" /> Já estará no estande (palestra)</span>
            </div>
          </CardContent>
        </Card>

        {/* Agenda do dia */}
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
                      <div className="truncate text-xs text-muted-foreground">{ses.theme || s.theme}</div>
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

      {/* Modal do tema do horário */}
      <Dialog open={!!slotDialog} onOpenChange={(o) => !o && setSlotDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Tema da demonstração — {slotDialog ? `${dayLabel(slotDialog.date).day}/${dayLabel(slotDialog.date).month} às ${slotDialog.time}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Tema *</Label>
            <Textarea
              rows={3}
              autoFocus
              value={slotDialog?.theme ?? ""}
              onChange={(e) => setSlotDialog((cur) => (cur ? { ...cur, theme: e.target.value } : cur))}
              placeholder="Ex.: Fluxo digital completo em prótese total"
            />
            <p className="text-[11px] text-muted-foreground">Aparece na TV do estande junto ao seu nome e QR Code.</p>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {slotDialog?.existing ? (
              <Button variant="outline" onClick={removeSlot} disabled={saving} className="text-destructive">
                <Trash2 className="mr-1.5 h-4 w-4" /> Liberar horário
              </Button>
            ) : <span />}
            <Button onClick={confirmSlot} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de novo palestrante */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar novo palestrante</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome completo *</Label>
              <Input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="Dr. Nome Sobrenome" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Instagram</Label>
                <Input value={newForm.instagram} onChange={(e) => setNewForm({ ...newForm, instagram: e.target.value })} placeholder="@perfil" />
              </div>
              <div>
                <Label className="text-xs">CRO</Label>
                <Input value={newForm.cro} onChange={(e) => setNewForm({ ...newForm, cro: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">WhatsApp</Label>
                <Input value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Especialidade</Label>
              <Input value={newForm.specialty} onChange={(e) => setNewForm({ ...newForm, specialty: e.target.value })} placeholder="Ex.: Prótese dentária" />
            </div>
            <div>
              <Label className="text-xs">Mini CV</Label>
              <Textarea rows={3} value={newForm.mini_bio} onChange={(e) => setNewForm({ ...newForm, mini_bio: e.target.value })} placeholder="Formação, experiência, cursos ministrados…" />
            </div>
            <div>
              <Label className="text-xs">Foto</Label>
              <div className="flex items-center gap-3">
                {newPhoto && <img src={URL.createObjectURL(newPhoto)} alt="" className="h-14 w-14 rounded-full border object-cover" />}
                <Input type="file" accept="image/*" onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={createProfessional} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
