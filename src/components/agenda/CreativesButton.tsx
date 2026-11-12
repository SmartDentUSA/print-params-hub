import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Copy, Download, Images, Loader2, RotateCcw, Save, Ticket } from "lucide-react";
import { toast } from "sonner";
import { call } from "./CrmInsertionButton";
import { CreativeThumb } from "@/components/admin/catalog/PromotionalCreativesCard";

type Creative = {
  id: string; file_name: string; mime_type: string; storage_url: string | null; drive_url: string | null;
  description: string; message: string; default_message: string; edited: boolean;
};
type Resp = { table: { id: string; name: string } | null; coupon: { code: string; valid_until: string | null } | null; creatives: Creative[] };

function CreativeItem({ c }: { c: Creative }) {
  // Mensagem padrão vem pronta do editor da tabela, já com o cupom do vendedor.
  // A versão editada pelo vendedor fica salva para ele.
  const qc = useQueryClient();
  const [msg, setMsg] = useState(c.message);
  const [saved, setSaved] = useState(c.message);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMsg(c.message); setSaved(c.message); }, [c.message]);

  const dirty = msg !== saved;
  const save = async (text = msg) => {
    if (text === saved) return;
    setBusy(true);
    try {
      await call("creative_save_message", { creative_id: c.id, message: text });
      setSaved(text);
      qc.invalidateQueries({ queryKey: ["agenda-creatives"] });
      toast.success("Mensagem salva.");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const reset = async () => {
    setBusy(true);
    try {
      await call("creative_reset_message", { creative_id: c.id });
      setMsg(c.default_message); setSaved(c.default_message);
      qc.invalidateQueries({ queryKey: ["agenda-creatives"] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada.");
    if (dirty) void save();
  };
  const href = c.storage_url ?? c.drive_url;
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <CreativeThumb c={c} />
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Descrição para uso</p>
          <p className="whitespace-pre-line text-sm">{c.description || "—"}</p>
          {href && <Button asChild size="sm" variant="outline"><a href={href} download={c.file_name} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Download</a></Button>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Mensagem para envio no WhatsApp</p>
        <Textarea className="min-h-[260px] flex-1 text-sm leading-relaxed" value={msg} onChange={(e) => setMsg(e.target.value)} onBlur={() => save()}
          placeholder="A mensagem deste criativo ainda não foi preparada no editor da tabela promocional." />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            {busy ? <><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</> : dirty ? "Alterações não salvas" : c.edited || saved !== c.default_message ? <><Check className="h-3 w-3" /> Sua versão salva</> : null}
          </span>
          {(c.edited || saved !== c.default_message) && <Button size="sm" variant="ghost" onClick={reset} disabled={busy}><RotateCcw className="mr-2 h-4 w-4" />Restaurar padrão</Button>}
          {dirty && <Button size="sm" variant="secondary" onClick={() => save()} disabled={busy}><Save className="mr-2 h-4 w-4" />Salvar</Button>}
          <Button size="sm" onClick={copy} disabled={!msg}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
        </div>
      </div>
    </div>
  );
}

export function CreativesButton() {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["agenda-creatives"], queryFn: () => call<Resp>("creatives"), enabled: open, staleTime: 60_000 });
  const d = q.data;
  return (
    <>
      <Button type="button" variant="outline" className="w-full gap-2 sm:w-auto" onClick={() => setOpen(true)}><Images className="h-4 w-4" /> Criativos</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Images className="h-5 w-5 text-primary" /> Criativos da campanha</DialogTitle>
            <DialogDescription>{d?.table ? d.table.name : "Criativos da tabela vigente"}</DialogDescription>
          </DialogHeader>
          {q.isLoading ? <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
            : q.isError ? <p className="py-6 text-sm text-destructive">{(q.error as Error).message}</p>
            : !d?.table ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma tabela vigente no momento.</p>
            : (
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Ticket className="h-3.5 w-3.5" />{d.coupon ? <>Seu cupom nesta tabela: <span className="font-mono font-medium text-foreground">{d.coupon.code}</span></> : "Você não tem cupom ativo nesta tabela; a mensagem sai sem o bloco do cupom."}</p>
                {!d.creatives.length ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum criativo cadastrado para esta tabela.</p>
                  : <div className="grid gap-3 md:grid-cols-2">{d.creatives.map((c) => <CreativeItem key={c.id} c={c} />)}</div>}
              </div>
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
