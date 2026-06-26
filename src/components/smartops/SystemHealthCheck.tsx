import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Play, RefreshCw, Webhook, Plug, Cpu, Search, CheckCircle2, AlertTriangle, XCircle, CircleOff, HelpCircle } from "lucide-react";

interface StatusRow {
  id: string;
  key: string;
  label: string;
  category: "webhook_in" | "api_out" | "edge_function" | "seo_asset";
  check_type: string;
  target_url: string | null;
  edge_function_name: string | null;
  enabled: boolean;
  display_order: number;
  notes: string | null;
  last_checked_at: string | null;
  status: "ok" | "degraded" | "down" | "inactive" | "unknown" | null;
  http_status: number | null;
  latency_ms: number | null;
  volume_24h: number | null;
  last_event_at: string | null;
  error_message: string | null;
}

const CATEGORY_META: Record<StatusRow["category"], { label: string; icon: typeof Webhook }> = {
  webhook_in: { label: "Webhooks de entrada", icon: Webhook },
  api_out: { label: "APIs externas (saída)", icon: Plug },
  edge_function: { label: "Edge Functions críticas", icon: Cpu },
  seo_asset: { label: "SEO / Bots / LLMs", icon: Search },
};

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function statusBadge(s: StatusRow["status"]) {
  switch (s) {
    case "ok":
      return <Badge className="bg-green-100 text-green-800 border-green-300 gap-1"><CheckCircle2 className="w-3 h-3" /> OK</Badge>;
    case "degraded":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 gap-1"><AlertTriangle className="w-3 h-3" /> Degradado</Badge>;
    case "down":
      return <Badge className="bg-red-100 text-red-800 border-red-300 gap-1"><XCircle className="w-3 h-3" /> Down</Badge>;
    case "inactive":
      return <Badge variant="outline" className="gap-1"><CircleOff className="w-3 h-3" /> Inativo</Badge>;
    default:
      return <Badge variant="outline" className="gap-1"><HelpCircle className="w-3 h-3" /> —</Badge>;
  }
}

export function SystemHealthCheck() {
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("system_integration_status" as never)
      .select("*")
      .order("display_order", { ascending: true });
    if (error) {
      toast.error(`Erro: ${error.message}`);
    } else {
      setRows((data ?? []) as unknown as StatusRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    const channel = supabase
      .channel("integration-checks-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "system_integration_checks" }, () => {
        fetchStatus();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const runCheck = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("smart-ops-integration-check");
      if (error) throw error;
      toast.success("Check executado");
      setTimeout(fetchStatus, 1500);
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  const counts = rows.reduce(
    (acc, r) => {
      acc.total++;
      const s = r.status ?? "unknown";
      if (s === "ok") acc.ok++;
      else if (s === "degraded") acc.degraded++;
      else if (s === "down") acc.down++;
      else if (s === "inactive") acc.inactive++;
      else acc.unknown++;
      return acc;
    },
    { total: 0, ok: 0, degraded: 0, down: 0, inactive: 0, unknown: 0 },
  );

  const byCategory: Record<string, StatusRow[]> = {};
  for (const r of rows) {
    (byCategory[r.category] ??= []).push(r);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">Inventário de Integrações</h3>
          <span className="text-xs text-muted-foreground">Check diário às 00:00 UTC</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={runCheck} disabled={running}>
            <Play className={`w-4 h-4 mr-2 ${running ? "animate-spin" : ""}`} />
            {running ? "Executando..." : "Rodar Check Agora"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{counts.total}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-600">{counts.ok}</div><div className="text-xs text-muted-foreground">OK</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-yellow-600">{counts.degraded}</div><div className="text-xs text-muted-foreground">Degradados</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-red-600">{counts.down}</div><div className="text-xs text-muted-foreground">Down</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-muted-foreground">{counts.inactive + counts.unknown}</div><div className="text-xs text-muted-foreground">Inativos / Sem check</div></CardContent></Card>
      </div>

      {(Object.keys(CATEGORY_META) as Array<StatusRow["category"]>).map((cat) => {
        const list = byCategory[cat] ?? [];
        if (list.length === 0) return null;
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;
        return (
          <Card key={cat}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Icon className="w-4 h-4" /> {meta.label}
                <Badge variant="outline" className="ml-1">{list.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Integração</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Volume 24h</TableHead>
                      <TableHead>Último evento</TableHead>
                      <TableHead>Latência</TableHead>
                      <TableHead>HTTP</TableHead>
                      <TableHead>Checado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{r.label}</div>
                          {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
                          {r.error_message && <div className="text-xs text-red-600 truncate max-w-[280px]" title={r.error_message}>{r.error_message}</div>}
                        </TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{r.volume_24h ?? "—"}</TableCell>
                        <TableCell className="text-xs">{relTime(r.last_event_at)}</TableCell>
                        <TableCell className="text-xs">{r.latency_ms != null ? `${r.latency_ms}ms` : "—"}</TableCell>
                        <TableCell className="text-xs">{r.http_status ?? "—"}</TableCell>
                        <TableCell className="text-xs">{relTime(r.last_checked_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}