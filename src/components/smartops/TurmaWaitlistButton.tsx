import React, { useCallback, useEffect, useState } from "react";
import { Hourglass, Send, Trash2, Plus, Loader2 } from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Entry {
  id: string; person_name: string; phone: string | null; email: string | null;
  wa_sent_at: string | null; wa_error: string | null; created_at: string;
}

const sb = supabase as any;

export function TurmaWaitlistButton({ turmaId, courseId, turmaLabel }: { turmaId: string; courseId: string; turmaLabel: string }) {
  const [enabled, setEnabled] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: c }, { data: w }] = await Promise.all([
      sb.from("smartops_courses").select("waitlist_enabled").eq("id", courseId).maybeSingle(),
      sb.from("smartops_turma_waitlist").select("id, person_name, phone, email, wa_sent_at, wa_error, created_at")
        .eq("turma_id", turmaId).order("created_at"),
    ]);
    setEnabled(Boolean(c?.waitlist_enabled));
    setEntries(w ?? []);
  }, [turmaId, courseId]);

  useEffect(() => { load(); }, [load]);

  if (!enabled && entries.length === 0) return null;

  const send = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.functions.invoke("smartops-waitlist-notify", { body: { waitlist_id: id } });
    setBusy(null);
    if (error) {
      const d = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
      let msg = d; try { msg = JSON.parse(d).error ?? d; } catch { /* texto */ }
      toast.error(`Não enviado: ${msg}`);
    } else toast.success("Mensagem enviada pelo WhatsApp do CS");
    load();
  };

  const add = async () => {
    if (!name.trim() || phone.replace(/\D/g, "").length < 10) {
      toast.error("Informe nome e telefone com DDD"); return;
    }
    setBusy("add");
    const digits = phone.replace(/\D/g, "");
    const { data: lead } = await sb.from("lia_attendances").select("id")
      .is("merged_into", null).ilike("telefone_normalized", `%${digits.slice(-9)}`).limit(1).maybeSingle();
    const { data, error } = await sb.from("smartops_turma_waitlist").insert({
      turma_id: turmaId, course_id: courseId, person_name: name.trim().slice(0, 150),
      phone: digits, email: email.trim().slice(0, 255) || null, lead_id: lead?.id ?? null,
    }).select("id").single();
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setName(""); setPhone(""); setEmail("");
    await send(data.id);
  };

  const remove = async (id: string) => {
    await sb.from("smartops_turma_waitlist").delete().eq("id", id);
    load();
  };

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)} title="Lista de espera">
        <Hourglass className="w-3.5 h-3.5" />
        {entries.length}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Lista de espera · {turmaLabel}</DialogTitle></DialogHeader>
          {enabled && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} className="col-span-2" />
              <Input placeholder="WhatsApp com DDD" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input placeholder="E-mail (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button className="col-span-2 gap-1" onClick={add} disabled={busy === "add"}>
                {busy === "add" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adicionar e enviar mensagem
              </Button>
            </div>
          )}
          <div className="space-y-2 max-h-80 overflow-auto">
            {entries.length === 0 && <p className="text-sm text-muted-foreground">Ninguém na lista de espera.</p>}
            {entries.map((e, i) => (
              <div key={e.id} className="flex items-center gap-2 border rounded-md p-2 text-sm">
                <span className="text-muted-foreground w-5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.person_name}</div>
                  <div className="text-xs text-muted-foreground">{e.phone || "—"}</div>
                </div>
                {e.wa_sent_at ? <Badge variant="secondary">Avisado</Badge>
                  : e.wa_error ? <Badge variant="destructive" title={e.wa_error}>Falhou</Badge> : null}
                <Button size="icon" variant="ghost" aria-label="Enviar mensagem" disabled={busy === e.id} onClick={() => send(e.id)}>
                  {busy === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => remove(e.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
