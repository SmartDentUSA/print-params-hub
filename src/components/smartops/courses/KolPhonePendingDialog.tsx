import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PhoneOff } from "lucide-react";

type Row = {
  lead_id: string;
  nome: string | null;
  prof_cro: string | null;
  prof_wa_ddi: string | null;
  prof_wa_number: string | null;
  wa_phone: string | null;
  telefone_normalized: string | null;
  phone_key: string | null;
  problema: "sem_celular" | "duplicado";
  duplicado_com: string | null;
};

export function useKolPhonePending() {
  return useQuery({
    queryKey: ["kol-phone-pending"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fn_kol_phone_pending");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
}

function PendingRow({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const { toast } = useToast();
  const [ddi, setDdi] = useState(row.prof_wa_ddi || "55");
  const [num, setNum] = useState(row.prof_wa_number || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).rpc("fn_kol_fix_phone", {
      _lead_id: row.lead_id,
      _ddi: ddi,
      _number: num,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Celular corrigido", description: row.nome ?? "" });
    onSaved();
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm">{row.nome || "Sem nome"}</span>
        {row.prof_cro && <span className="text-xs text-muted-foreground">CRO {row.prof_cro}</span>}
        <Badge variant={row.problema === "duplicado" ? "secondary" : "destructive"} className="text-[10px]">
          {row.problema === "duplicado" ? `Duplicado com ${row.duplicado_com ?? "outro"}` : "Sem celular válido"}
        </Badge>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Atual: {row.prof_wa_ddi || row.prof_wa_number ? `${row.prof_wa_ddi ?? ""} ${row.prof_wa_number ?? ""}` : "—"}
        {row.wa_phone ? ` · WhatsApp ${row.wa_phone}` : ""}
        {row.telefone_normalized ? ` · Tel ${row.telefone_normalized}` : ""}
      </div>
      <div className="flex gap-2">
        <Input className="w-20" value={ddi} onChange={(e) => setDdi(e.target.value)} placeholder="DDI" />
        <Input value={num} onChange={(e) => setNum(e.target.value)} placeholder="DDD + celular" inputMode="tel" />
        <Button onClick={save} disabled={saving || num.replace(/\D/g, "").length < 10}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

export default function KolPhonePendingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useKolPhonePending();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PhoneOff className="w-5 h-5" /> Pendências de celular</DialogTitle>
          <DialogDescription>
            O celular é a chave de acesso do profissional. Corrija um a um; cada correção fica registrada na linha do tempo.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando…</div>
        ) : data.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">Nenhuma pendência. Todos os profissionais têm celular único.</div>
        ) : (
          <div className="space-y-2">
            {data.map((r) => (
              <PendingRow key={r.lead_id} row={r} onSaved={() => qc.invalidateQueries({ queryKey: ["kol-phone-pending"] })} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
