import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = {
  id: string; kol_nome: string; contrato: string | null; vendedor: string | null; subject_type: string; subject_ref: string | null;
  reason: string; status: string; decision: string | null; staff_response: string | null; due_at: string | null; created_at: string; is_test: boolean;
};

const call = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("kol-staff-ops", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};
const daysLeft = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null);

export default function KolContestationsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<"aberta" | "respondida" | "todas">("aberta");
  const [tests, setTests] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Row | null>(null);
  const [resp, setResp] = useState("");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [alertRes, setAlertRes] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, b] = await Promise.all([call({ action: "list_contests", status, include_tests: tests }), call({ action: "list_blocks" })]);
      setRows(c.rows ?? []); setBlocks(b.rows ?? []);
    } catch (e: any) { toast({ title: "Erro ao carregar", description: e.message, variant: "destructive" }); }
    setLoading(false);
  }, [status, tests, toast]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const answer = async (decision: "acatada" | "negada") => {
    if (!sel) return;
    setBusy(true);
    try {
      const r = await call({ action: "answer_contest", id: sel.id, decision, response: resp });
      toast({ title: `Contestação ${decision}`, description: r.seller_notified ? "Vendedor avisado por WhatsApp." : `Vendedor não avisado: ${r.seller_detail ?? ""}` });
      setSel(null); setResp(""); load();
    } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
    setBusy(false);
  };

  const testAlert = async () => {
    setBusy(true); setAlertRes(null);
    try {
      const r = await call({ action: "test_new_device_alert", phone });
      setAlertRes(r.ok ? `Entregue para ${r.to}` : `Não entregue: ${JSON.stringify(r.detail)}`);
    } catch (e: any) { setAlertRes(`Erro: ${e.message}`); }
    setBusy(false);
  };

  const unblock = async (ip_hash: string) => {
    try { const r = await call({ action: "unblock", ip_hash }); toast({ title: `Liberado (${r.liberados})` }); load(); }
    catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Contestações de KOL</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          {(["aberta", "respondida", "todas"] as const).map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
              {s === "aberta" ? "Abertas" : s === "respondida" ? "Respondidas" : "Todas"}
            </Button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm"><Switch checked={tests} onCheckedChange={setTests} /> Mostrar testes</label>
        </div>

        {loading ? <div className="py-8 text-center text-muted-foreground"><Loader2 className="inline w-4 h-4 animate-spin" /></div> :
          rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma contestação.</p> : (
          <ul className="divide-y rounded-md border">
            {rows.map((r) => {
              const d = daysLeft(r.due_at);
              const late = r.status === "aberta" && d !== null && d <= 5;
              return (
                <li key={r.id} className={cn("p-3 cursor-pointer hover:bg-muted/50", sel?.id === r.id && "bg-muted")} onClick={() => { setSel(r); setResp(r.staff_response ?? ""); }}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <strong>{r.kol_nome}</strong>
                    {r.is_test && <Badge variant="secondary">teste</Badge>}
                    <Badge variant="outline">{r.decision || r.status}</Badge>
                    <span className="text-muted-foreground">{r.subject_type}{r.subject_ref && ` · ${r.subject_ref}`}</span>
                    {r.status === "aberta" && d !== null && (
                      <Badge variant={late ? "destructive" : "outline"} className="ml-auto">
                        {d < 0 ? `Prazo vencido há ${-d} dia(s)` : `Prazo: ${d} dia(s)`}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{r.reason}</p>
                  <p className="text-xs text-muted-foreground">Aberta em {new Date(r.created_at).toLocaleDateString("pt-BR")} · Vendedor: {r.vendedor ?? "—"} · Contrato {r.contrato ?? "—"}</p>
                </li>
              );
            })}
          </ul>
        )}

        {sel && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">Responder a {sel.kol_nome}</p>
            <Textarea rows={4} value={resp} onChange={(e) => setResp(e.target.value)} placeholder="Resposta que o KOL verá no portal" />
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => answer("acatada")}>Acatar</Button>
              <Button disabled={busy} variant="destructive" onClick={() => answer("negada")}>Negar</Button>
              <Button variant="ghost" onClick={() => setSel(null)}>Fechar</Button>
            </div>
          </div>
        )}

        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Teste do aviso de aparelho novo</p>
          <div className="flex gap-2">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Celular com DDD" />
            <Button disabled={busy || !phone} onClick={testAlert}>Enviar teste</Button>
          </div>
          {alertRes && <p className="text-sm">{alertRes}</p>}
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Acessos bloqueados no portal</p>
          {blocks.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum bloqueio ativo.</p> : blocks.map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-sm">
              <code className="text-xs">{b.ip_hash.slice(0, 12)}…</code>
              <span className="text-muted-foreground">até {new Date(b.blocked_until).toLocaleTimeString("pt-BR")}</span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => unblock(b.ip_hash)}>Liberar</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
