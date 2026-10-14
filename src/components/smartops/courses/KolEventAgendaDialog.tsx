import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const db = supabase as any;
type Opt = { id: string; label: string; is_test?: boolean };

export default function KolEventAgendaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [events, setEvents] = useState<Opt[]>([]);
  const [kols, setKols] = useState<Opt[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [eventId, setEventId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [testMode, setTestMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, { type: string; date: string; start: string; end: string }>>({});

  const load = useCallback(async () => {
    const [ev, ct, inv, sl] = await Promise.all([
      db.from("smartops_events").select("id,name,start_date").order("start_date", { ascending: false }).limit(200),
      db.from("kol_contracts").select("lead_id,contract_number,is_test,status").eq("status", "signed"),
      db.from("kol_event_invites").select("*").order("created_at", { ascending: false }).limit(300),
      db.from("kol_event_slots").select("*").order("slot_date").limit(1000),
    ]);
    const evs = (ev.data || []).map((e: any) => ({ id: e.id, label: `${e.name}${e.start_date ? ` · ${new Date(e.start_date).toLocaleDateString("pt-BR")}` : ""}` }));
    setEvents(evs);
    const leadIds = Array.from(new Set([...(ct.data || []).map((c: any) => c.lead_id), ...(inv.data || []).map((i: any) => i.lead_id)])).filter(Boolean);
    const nm: Record<string, string> = {};
    evs.forEach((e: Opt) => (nm[e.id] = e.label));
    if (leadIds.length) {
      const { data } = await db.from("lia_attendances").select("id,nome").in("id", leadIds).is("merged_into", null);
      (data || []).forEach((l: any) => (nm[l.id] = l.nome || l.id));
    }
    setNames(nm);
    setKols((ct.data || []).map((c: any) => ({ id: c.lead_id, label: `${nm[c.lead_id] || c.lead_id} · ${c.contract_number || ""}`, is_test: c.is_test })));
    setInvites(inv.data || []);
    setSlots(sl.data || []);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const run = async (fn: string, args: any, ok: string) => {
    setBusy(true);
    const { error } = await db.rpc(fn, args);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(ok);
    load();
  };

  const hours = (s: any) => {
    const [h1, m1] = String(s.start_time).split(":").map(Number);
    const [h2, m2] = String(s.end_time).split(":").map(Number);
    return ((h2 * 60 + m2 - h1 * 60 - m1) / 60).toFixed(2).replace(".", ",");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Agenda de eventos dos KOLs</DialogTitle></DialogHeader>

        <div className="rounded-md border p-3 space-y-2">
          <p className="text-sm font-medium">Novo convite (só KOL com contrato assinado)</p>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto] items-center">
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">Evento…</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              <option value="">KOL…</option>
              {kols.map((k) => <option key={k.id + k.label} value={k.id}>{k.label}{k.is_test ? " [teste]" : ""}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={testMode} onCheckedChange={(v) => setTestMode(!!v)} /> Modo teste (WhatsApp simulado)</label>
            <Button disabled={busy || !eventId || !leadId} onClick={() => run("fn_kol_invite", { _event_id: eventId, _lead_id: leadId, _test: testMode }, "Convite registrado")}>Convidar</Button>
          </div>
        </div>

        <div className="space-y-3">
          {invites.length === 0 && <p className="text-sm text-muted-foreground">Nenhum convite ainda.</p>}
          {invites.map((inv) => {
            const f = form[inv.id] || { type: "palestra", date: "", start: "", end: "" };
            const set = (p: Partial<typeof f>) => setForm({ ...form, [inv.id]: { ...f, ...p } });
            const mySlots = slots.filter((s) => s.invite_id === inv.id);
            return (
              <div key={inv.id} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{names[inv.lead_id] || inv.lead_id}</span>
                  <span className="text-sm text-muted-foreground">em {names[inv.event_id] || "evento"}</span>
                  <Badge variant="outline">{inv.status}</Badge>
                  {inv.is_test && <Badge variant="secondary">teste</Badge>}
                  {inv.message_mode && <Badge variant="outline">WhatsApp {inv.message_mode}</Badge>}
                  {inv.status === "pending" || inv.status === "pendente" || inv.status === "invited" ? (
                    <span className="ml-auto flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => run("fn_kol_invite_respond", { _invite_id: inv.id, _accept: true, _actor: "equipe" }, "Convite aceito")}>Aceito</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("fn_kol_invite_respond", { _invite_id: inv.id, _accept: false, _actor: "equipe" }, "Convite recusado")}>Recusado</Button>
                    </span>
                  ) : null}
                </div>

                {mySlots.length > 0 && (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground"><th>Tipo</th><th>Dia</th><th>Horário</th><th>Situação</th><th>Horas</th><th /></tr></thead>
                    <tbody>
                      {mySlots.map((s) => (
                        <tr key={s.id} className="border-t">
                          <td>{s.slot_type}</td>
                          <td>{new Date(s.slot_date + "T12:00").toLocaleDateString("pt-BR")}</td>
                          <td>{String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)}</td>
                          <td>{s.status}</td>
                          <td>{s.status === "cancelado" || s.status === "cancelled" ? "não conta" : s.hours_done != null ? String(s.hours_done).replace(".", ",") : `${hours(s)} prev.`}</td>
                          <td className="text-right space-x-1">
                            {!s.done_at && !s.cancelled_at && (
                              <>
                                <Button size="sm" disabled={busy} onClick={() => run("fn_kol_mark_done", { _slot_id: s.id }, "Turno marcado como realizado")}>Marcar realizado</Button>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                                  const r = window.prompt("Motivo do cancelamento");
                                  if (r) run("fn_kol_cancel_slot", { _slot_id: s.id, _reason: r }, "Turno cancelado");
                                }}>Cancelar</Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {(inv.status === "accepted" || inv.status === "aceito") && (
                  <div className="grid gap-2 md:grid-cols-[auto_auto_auto_auto_auto] items-center">
                    <select className="h-9 rounded-md border bg-background px-2 text-sm" value={f.type} onChange={(e) => set({ type: e.target.value })}>
                      <option value="palestra">Palestra</option>
                      <option value="estande">Estande</option>
                    </select>
                    <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
                    <Input type="time" value={f.start} onChange={(e) => set({ start: e.target.value })} />
                    <Input type="time" value={f.end} onChange={(e) => set({ end: e.target.value })} />
                    <Button size="sm" disabled={busy || !f.date || !f.start || !f.end} onClick={() => run("fn_kol_schedule_slot", { _invite_id: inv.id, _type: f.type, _date: f.date, _start: f.start, _end: f.end }, "Turno agendado")}>Agendar turno</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
