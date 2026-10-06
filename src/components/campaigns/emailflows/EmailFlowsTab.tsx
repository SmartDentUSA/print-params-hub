import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, RefreshCw, Trash2, Pencil } from "lucide-react";
import { AudienceBuilder } from "./AudienceBuilder";
import { FlowEditor } from "./FlowEditor";
import { NODE_LABELS, TRIGGERS, WEEKDAYS } from "./types";

const db = supabase as any;

function FlowsQueue({ onOpen }: { onOpen: (id: string | null) => void }) {
  const [flows, setFlows] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [today, setToday] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await db.from("email_flows").select("*, email_audiences(name)").order("status").order("priority");
    setFlows(data || []);
    const ids = (data || []).map((f: any) => f.id);
    const s: Record<string, any> = {};
    if (ids.length) {
      const { data: enr } = await db.from("email_flow_enrollments").select("flow_id, status, current_node_id").in("flow_id", ids).limit(20000);
      for (const r of enr || []) {
        const x = (s[r.flow_id] ||= { active: 0, done: 0, exited: 0, byNode: {} as Record<string, number> });
        if (r.status === "active") { x.active++; const k = r.current_node_id || "origin"; x.byNode[k] = (x.byNode[k] || 0) + 1; }
        else if (r.status === "exited") x.exited++; else x.done++;
      }
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data: ev } = await db.from("email_flow_events").select("flow_id, event_type").in("flow_id", ids).in("event_type", ["email_sent", "email_opened", "email_clicked"]).gte("created_at", since.toISOString()).limit(20000);
      for (const e of ev || []) { const x = (s[e.flow_id] ||= { active: 0, done: 0, exited: 0, byNode: {} }); x[e.event_type] = (x[e.event_type] || 0) + 1; }
    }
    setStats(s);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { count } = await db.from("email_flow_events").select("id", { count: "exact", head: true }).eq("event_type", "email_sent").gte("created_at", start.toISOString());
    setToday(count || 0);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (f: any) => {
    const status = f.status === "active" ? "paused" : "active";
    const { error } = await db.from("email_flows").update({ status, activated_at: status === "active" ? new Date().toISOString() : f.activated_at }).eq("id", f.id);
    if (error) return toast.error(error.message);
    if (status === "active" && f.origin_type === "audience") await db.rpc("fn_email_flow_enroll_audience", { _flow: f.id, _limit: 5000 });
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => onOpen(null)}><Plus className="w-4 h-4 mr-1" /> Nova régua</Button>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar</Button>
        <div className="ml-auto text-xs text-muted-foreground">Rodadas: 08h · 12h · 17h — e-mails hoje: <strong>{today}</strong>/150</div>
      </div>
      {flows.length === 0 && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma régua criada. Crie um público e depois uma régua.</CardContent></Card>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {flows.map((f) => {
          const s = stats[f.id] || { active: 0, done: 0, exited: 0, byNode: {} };
          const nodes: any[] = f.nodes || [];
          return (
            <Card key={f.id} className={f.status === "active" ? "border-primary/50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="truncate">{f.name}</span>
                  <Badge variant={f.status === "active" ? "default" : "secondary"} className="ml-auto">{f.status === "active" ? "Ativa" : f.status === "paused" ? "Pausada" : "Rascunho"}</Badge>
                </CardTitle>
                <div className="text-[11px] text-muted-foreground">
                  {f.origin_type === "trigger" ? `Gatilho: ${TRIGGERS.find((t) => t.v === f.trigger_type)?.l || "—"}` : `Público: ${f.email_audiences?.name || "—"}`}
                  {" · "}Prioridade {f.priority}{" · "}{WEEKDAYS.filter((w) => (f.active_weekdays || []).includes(w.v)).map((w) => w.l).join(" ")}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-4 gap-1 text-center">
                  {[["Na régua", s.active], ["Passos", nodes.length], ["Concluíram", s.done], ["Saíram", s.exited]].map(([l, v]) => (
                    <div key={l as string} className="rounded bg-muted/50 py-1"><div className="text-sm font-semibold">{v as number}</div><div className="text-[10px] text-muted-foreground">{l}</div></div>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground">30 dias: {s.email_sent || 0} enviados · {s.email_opened || 0} aberturas · {s.email_clicked || 0} cliques</div>
                <div className="flex flex-wrap gap-1">
                  {nodes.map((n) => (
                    <Badge key={n.id} variant="outline" className="text-[10px]">{NODE_LABELS[n.type as keyof typeof NODE_LABELS] || n.type}: {s.byNode[n.id] || 0}</Badge>
                  ))}
                </div>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpen(f.id)}><Pencil className="w-3 h-3 mr-1" /> Abrir</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toggle(f)}>{f.status === "active" ? "Pausar" : "Ativar"}</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={async () => { if (!confirm("Excluir régua e seu histórico?")) return; const { error } = await db.from("email_flows").delete().eq("id", f.id); if (error) toast.error(error.message); else load(); }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Tracking() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    db.from("email_flow_events").select("id, event_type, payload, created_at, node_id, email_flows(name), email_flow_enrollments(nome, email)")
      .order("created_at", { ascending: false }).limit(200).then(({ data }: any) => setRows(data || []));
  }, []);
  const label: Record<string, string> = { email_sent: "E-mail enviado", email_failed: "Falha no e-mail", email_opened: "Abriu", email_clicked: "Clicou", whatsapp_sent: "WhatsApp enviado", whatsapp_failed: "Falha no WhatsApp", sms_sent: "SMS enviado", sms_failed: "Falha no SMS", condition_yes: "Condição: sim", condition_no: "Condição: não", exited: "Saiu", completed: "Concluiu", skipped: "Pulado", error: "Erro", moved_to_flow: "Foi para outra régua", warning: "Aviso" };
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y text-xs max-h-[70vh] overflow-auto">
          {rows.length === 0 && <div className="p-6 text-center text-muted-foreground">Sem atividade ainda.</div>}
          {rows.map((r) => (
            <div key={r.id} className="px-3 py-2 grid grid-cols-[140px_160px_1fr_1fr] gap-2">
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              <Badge variant={/failed|error/.test(r.event_type) ? "destructive" : "secondary"} className="w-fit text-[10px]">{label[r.event_type] || r.event_type}</Badge>
              <span className="truncate">{r.email_flows?.name}</span>
              <span className="truncate text-muted-foreground">{r.email_flow_enrollments?.nome || r.email_flow_enrollments?.email}{r.payload?.reason ? ` — ${r.payload.reason}` : r.payload?.error ? ` — ${r.payload.error}` : ""}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EmailFlowsTab() {
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  if (editing !== undefined) return <FlowEditor flowId={editing} onBack={() => setEditing(undefined)} />;
  return (
    <Tabs defaultValue="reguas">
      <TabsList>
        <TabsTrigger value="reguas">Réguas</TabsTrigger>
        <TabsTrigger value="publicos">Públicos</TabsTrigger>
        <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
      </TabsList>
      <TabsContent value="reguas"><FlowsQueue onOpen={(id) => setEditing(id)} /></TabsContent>
      <TabsContent value="publicos"><AudienceBuilder /></TabsContent>
      <TabsContent value="acompanhamento"><Tracking /></TabsContent>
    </Tabs>
  );
}
