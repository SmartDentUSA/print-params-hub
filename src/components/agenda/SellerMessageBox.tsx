import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Copy, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

/** Mensagem de WhatsApp do vendedor: padrão vem pronta; a versão editada fica salva para ele. */
export function SellerMessageBox({ message, defaultMessage, edited, placeholder, onSave, onReset }: {
  message: string; defaultMessage: string; edited: boolean; placeholder: string;
  onSave: (text: string) => Promise<void>; onReset: () => Promise<void>;
}) {
  const [msg, setMsg] = useState(message);
  const [saved, setSaved] = useState(message);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMsg(message); setSaved(message); }, [message]);

  const dirty = msg !== saved;
  const custom = edited || saved !== defaultMessage;
  const save = async (text = msg) => {
    if (text === saved) return;
    setBusy(true);
    try { await onSave(text); setSaved(text); toast.success("Mensagem salva."); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const reset = async () => {
    setBusy(true);
    try { await onReset(); setMsg(defaultMessage); setSaved(defaultMessage); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada.");
    if (dirty) void save();
  };
  return (
    <div className="flex flex-1 flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">Mensagem para envio no WhatsApp</p>
      <Textarea className="min-h-[260px] flex-1 text-sm leading-relaxed" value={msg} onChange={(e) => setMsg(e.target.value)} onBlur={() => save()} placeholder={placeholder} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          {busy ? <><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</> : dirty ? "Alterações não salvas" : custom ? <><Check className="h-3 w-3" /> Sua versão salva</> : null}
        </span>
        {custom && <Button size="sm" variant="ghost" onClick={reset} disabled={busy}><RotateCcw className="mr-2 h-4 w-4" />Restaurar padrão</Button>}
        {dirty && <Button size="sm" variant="secondary" onClick={() => save()} disabled={busy}><Save className="mr-2 h-4 w-4" />Salvar</Button>}
        <Button size="sm" onClick={copy} disabled={!msg}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
      </div>
    </div>
  );
}
