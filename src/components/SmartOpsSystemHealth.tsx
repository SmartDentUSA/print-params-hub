import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, ShieldAlert, ShieldCheck, ShieldX, RefreshCw, Play, AlertTriangle, CheckCircle, Clock, Brain } from "lucide-react";

interface HealthLog {
  id: string;
  created_at: string;
  function_name: string;
  severity: string;
  error_type: string | null;
  lead_email: string | null;
  details: Record<string, unknown> | null;
  ai_analysis: string | null;
  ai_suggested_action: string | null;
  auto_remediated: boolean;
  resolved: boolean;
  resolved_at: string | null;
}

export function SmartOpsSystemHealth() {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningWatchdog, setRunningWatchdog] = useState(false);
  const [stats, setStats] = useState({
    errors24h: 0,
    criticals: 0,
    warnings: 0,
    unresolved: 0,
    remediated: 0,
  });

  const fetchLogs = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data, error } = await supabase
      .from("system_health_logs")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching health logs:", error);
      toast.error("Erro ao carregar logs de saúde");
    } else {
      const typedData = (data || []) as unknown as HealthLog[];
      setLogs(typedData);

      const last24h = new Date(Date.now() - 86400000).toISOString();
      const recent = typedData.filter(l => l.created_at >= last24h);
      setStats({
        errors24h: recent.filter(l => l.severity === "error" || l.severity === "critical").length,
        criticals: recent.filter(l => l.severity === "critical").length,
        warnings: recent.filter(l => l.severity === "warning").length,
        unresolved: typedData.filter(l => !l.resolved).length,
        remediated: typedData.filter(l => l.auto_remediated).length,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel("system-health-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "system_health_logs" }, (payload) => {
        const newLog = payload.new as unknown as HealthLog;
        setLogs(prev => [newLog, ...prev].slice(0, 100));
        if (newLog.severity === "critical") {
          toast.error(`🚨 Alerta crítico: ${newLog.error_type || newLog.function_name}`);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleRunWatchdog = async () => {
    setRunningWatchdog(true);
    try {
      const { error } = await supabase.functions.invoke("system-watchdog-deepseek");
      if (error) throw error;
      toast.success("Watchdog executado! Atualizando dados...");
      setTimeout(fetchLogs, 2000);
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunningWatchdog(false);
    }
  };

  const handleResolve = async (logId: string) => {
    const { error } = await supabase
      .from("system_health_logs")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", logId);

    if (error) {
      toast.error("Erro ao resolver");
    } else {
      toast.success("Marcado como resolvido");
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, resolved: true, resolved_at: new Date().toISOString() } : l));
    }
  };

  const getTrafficLight = () => {
    if (stats.criticals > 0) return { color: "bg-red-500", label: "CRÍTICO", icon: ShieldX };
    if (stats.errors24h > 0 || stats.warnings > 3) return { color: "bg-yellow-500", label: "ATENÇÃO", icon: ShieldAlert };
    return { color: "bg-green-500", label: "SAUDÁVEL", icon: ShieldCheck };
  };

  const traffic = getTrafficLight();
  const TrafficIcon = traffic.icon;

  const severityBadge = (severity: string) => {
    switch (severity) {
      case "critical": return <Badge variant="destructive">Crítico</Badge>;
      case "error": return <Badge variant="destructive" className="bg-orange-600">Erro</Badge>;
      case "warning": return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">Aviso</Badge>;
      default: return <Badge variant="outline">Info</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with traffic light */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${traffic.color} animate-pulse`} />
          <TrafficIcon className="w-5 h-5" />
          <span className="text-lg font-bold">{traffic.label}</span>
          <span className="text-sm text-muted-foreground">— DeepSeek Watchdog</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleRunWatchdog} disabled={runningWatchdog}>
            <Play className={`w-4 h-4 mr-2 ${runningWatchdog ? "animate-spin" : ""}`} />
            {runningWatchdog ? "Executando..." : "Executar Watchdog"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.errors24h}</div>
            <div className="text-xs text-muted-foreground">Erros 24h</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-800">{stats.criticals}</div>
            <div className="text-xs text-muted-foreground">Críticos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.warnings}</div>
            <div className="text-xs text-muted-foreground">Avisos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.unresolved}</div>
            <div className="text-xs text-muted-foreground">Não Resolvidos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.remediated}</div>
            <div className="text-xs text-muted-foreground">Auto-remediados</div>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Eventos Recentes (últimos 7 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>Nenhum evento registrado. Sistema operando normalmente.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Data</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead className="max-w-[300px]">Análise IA</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id} className={log.severity === "critical" ? "bg-red-50/50" : ""}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell>{severityBadge(log.severity)}</TableCell>
                      <TableCell className="text-xs font-mono">{log.function_name}</TableCell>
                      <TableCell className="text-xs">{log.error_type || "—"}</TableCell>
                      <TableCell className="text-xs">{log.lead_email || "—"}</TableCell>
                      <TableCell className="text-xs max-w-[300px] truncate" title={log.ai_analysis || ""}>
                        {log.ai_analysis ? (
                          <span className="flex items-center gap-1">
                            <Brain className="w-3 h-3 text-purple-500 shrink-0" />
                            {log.ai_analysis.slice(0, 80)}…
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {log.resolved ? (
                          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 gap-1">
                            <CheckCircle className="w-3 h-3" /> Resolvido
                          </Badge>
                        ) : log.auto_remediated ? (
                          <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50 gap-1">
                            <RefreshCw className="w-3 h-3" /> Auto-fix
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50 gap-1">
                            <Clock className="w-3 h-3" /> Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!log.resolved && (
                          <Button variant="ghost" size="sm" onClick={() => handleResolve(log.id)}>
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
