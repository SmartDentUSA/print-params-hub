import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Images, Loader2, Ticket } from "lucide-react";
import { call } from "./CrmInsertionButton";
import { CreativeThumb } from "@/components/admin/catalog/PromotionalCreativesCard";
import { SellerMessageBox } from "./SellerMessageBox";

type Creative = {
  id: string; file_name: string; mime_type: string; storage_url: string | null; drive_url: string | null;
  description: string; message: string; default_message: string; edited: boolean;
};
type Resp = { table: { id: string; name: string } | null; coupon: { code: string; valid_until: string | null } | null; creatives: Creative[] };

function CreativeItem({ c }: { c: Creative }) {
  // Mensagem padrão vem pronta do editor da tabela, já com o cupom do vendedor.
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["agenda-creatives"] });
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
      <SellerMessageBox
        message={c.message} defaultMessage={c.default_message} edited={c.edited}
        placeholder="A mensagem deste criativo ainda não foi preparada no editor da tabela promocional."
        onSave={async (message) => { await call("creative_save_message", { creative_id: c.id, message }); refresh(); }}
        onReset={async () => { await call("creative_reset_message", { creative_id: c.id }); refresh(); }}
      />
    </div>
  );
}

export function CouponLine({ coupon }: { coupon: Resp["coupon"] }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Ticket className="h-3.5 w-3.5" />{coupon ? <>Seu cupom nesta tabela: <span className="font-mono font-medium text-foreground">{coupon.code}</span></> : "Você não tem cupom ativo nesta tabela; a mensagem sai sem o bloco do cupom."}</p>
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
                <CouponLine coupon={d.coupon} />
                {!d.creatives.length ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum criativo cadastrado para esta tabela.</p>
                  : <div className="grid gap-3 md:grid-cols-2">{d.creatives.map((c) => <CreativeItem key={c.id} c={c} />)}</div>}
              </div>
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
