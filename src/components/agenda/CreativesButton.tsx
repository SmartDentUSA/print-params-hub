import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Download, Images, Loader2, Sparkles, Ticket } from "lucide-react";
import { toast } from "sonner";
import { call } from "./CrmInsertionButton";
import { CreativeThumb } from "@/components/admin/catalog/PromotionalCreativesCard";

type Creative = { id: string; file_name: string; mime_type: string; storage_url: string | null; drive_url: string | null; description: string };
type Resp = { table: { id: string; name: string } | null; coupon: { code: string; valid_until: string | null } | null; creatives: Creative[] };

function CreativeItem({ c }: { c: Creative }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const gen = async () => {
    setBusy(true);
    try { const r = await call<{ message: string }>("creative_message", { creative_id: c.id }); setMsg(r.message); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const copy = async () => { await navigator.clipboard.writeText(msg); toast.success("Mensagem copiada."); };
  const href = c.storage_url ?? c.drive_url;
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <CreativeThumb c={c} />
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Descrição para uso</p>
          <p className="whitespace-pre-line text-sm">{c.description || "—"}</p>
          {href && <Button asChild size="sm" variant="outline"><a href={href} download={c.file_name} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Download</a></Button>}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Mensagem para envio no WhatsApp</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={gen} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{msg ? "Gerar de novo" : "Gerar mensagem"}</Button>
            <Button size="sm" onClick={copy} disabled={!msg}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
          </div>
        </div>
        <Textarea rows={8} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Clique em Gerar mensagem: a IA lê a imagem e escreve a mensagem com o seu cupom." />
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
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Images className="h-5 w-5 text-primary" /> Criativos da campanha</DialogTitle>
            <DialogDescription>{d?.table ? d.table.name : "Criativos da tabela vigente"}</DialogDescription>
          </DialogHeader>
          {q.isLoading ? <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
            : q.isError ? <p className="py-6 text-sm text-destructive">{(q.error as Error).message}</p>
            : !d?.table ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma tabela vigente no momento.</p>
            : (
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Ticket className="h-3.5 w-3.5" />{d.coupon ? <>Seu cupom nesta tabela: <span className="font-mono font-medium text-foreground">{d.coupon.code}</span></> : "Você não tem cupom ativo nesta tabela; a mensagem termina só com o convite para equipamentos."}</p>
                {!d.creatives.length ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum criativo cadastrado para esta tabela.</p>
                  : d.creatives.map((c) => <CreativeItem key={c.id} c={c} />)}
              </div>
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
