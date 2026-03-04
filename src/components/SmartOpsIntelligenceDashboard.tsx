import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingDown, TrendingUp, Brain, Zap } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316"];

interface TopLead {
  id: string;
  nome: string;
  telefone_normalized: string | null;
  intelligence_score_total: number;
  intelligence_score: Record<string, unknown> | null;
  lead_stage_detected: string | null;
}

interface StageData {
  name: string;
  value: number;
}

interface StateEvent {
  id: string;
  lead_id: string;
  old_stage: string | null;
  new_stage: string | null;
  is_regression: boolean;
  regression_gap_days: number | null;
  changed_at: string;
  source: string;
}

export function SmartOpsIntelligenceDashboard() {
  const [topLeads, setTopLeads] = useState<TopLead[]>([]);
  const [stageDistribution, setStageDistribution] = useState<StageData[]>([]);
  const [recentEvents, setRecentEvents] = useState<StateEvent[]>([]);
  const [metrics, setMetrics] = useState({ avgMqlToSql: 0, regressionRate: 0, totalScored: 0 });
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadTopLeads(), loadStageDistribution(), loadRecentEvents(), loadMetrics()]);
    setLoading(false);
  }

  async function loadTopLeads() {
    const { data } = await supabase
      .from("lia_attendances")
      .select("id, nome, telefone_normalized, intelligence_score_total, intelligence_score, lead_stage_detected")
      .not("intelligence_score_total", "is", null)
      .order("intelligence_score_total", { ascending: false })
      .limit(20);
    setTopLeads((data as unknown as TopLead[]) || []);
  }

  async function loadStageDistribution() {
    const { data } = await supabase
      .from("lia_attendances")
      .select("lead_stage_detected")
      .not("intelligence_score_total", "is", null);

    const counts: Record<string, number> = {};
    (data || []).forEach((l) => {
      const s = (l as { lead_stage_detected: string | null }).lead_stage_detected || "desconhecido";
      counts[s] = (counts[s] || 0) + 1;
    });
    setStageDistribution(Object.entries(counts).map(([name, value]) => ({ name, value })));
  }

  async function loadRecentEvents() {
    const { data } = await supabase
      .from("lead_state_events")
      .select("id, lead_id, old_stage, new_stage, is_regression, regression_gap_days, changed_at, source")
      .order("changed_at", { ascending: false })
      .limit(20);
    setRecentEvents((data as unknown as StateEvent[]) || []);
  }

  async function loadMetrics() {
    const { count: totalScored } = await supabase
      .from("lia_attendances")
      .select("id", { count: "exact", head: true })
      .not("intelligence_score_total", "is", null);

    const { data: events } = await supabase
      .from("lead_state_events")
      .select("is_regression, regression_gap_days, old_stage, new_stage");

    if (!events) {
      setMetrics({ avgMqlToSql: 0, regressionRate: 0, totalScored: totalScored || 0 });
      return;
    }

    const mqlToSql = events.filter(
      (e) => e.old_stage === "MQL_pesquisador" && e.new_stage === "SQL_decisor" && e.regression_gap_days
    );
    const avgMqlToSql =
      mqlToSql.length > 0
        ? Math.round(mqlToSql.reduce((a, e) => a + (e.regression_gap_days || 0), 0) / mqlToSql.length)
        : 0;

    const regressionRate =
      events.length > 0
        ? Math.round((events.filter((e) => e.is_regression).length / events.length) * 100)
        : 0;

    setMetrics({ avgMqlToSql, regressionRate, totalScored: totalScored || 0 });
  }

  async function handleBackfill() {
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("backfill-intelligence-score");
      if (error) throw error;
      toast.success(`Backfill concluído: ${data?.total_success || 0} leads processados`);
      await loadAll();
    } catch (err) {
      toast.error(`Erro no backfill: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBackfilling(false);
    }
  }

  function getScoreColor(score: number) {
    if (score >= 70) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (score >= 40) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }

  function getScoreAxes(lead: TopLead) {
    const score = lead.intelligence_score as { axes?: Record<string, { value?: number }> } | null;
    if (!score?.axes) return null;
    return score.axes;
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">A carregar Intelligence Score...</div>;

  return (
    <div className="space-y-6">
      {/* Header + Backfill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Intelligence Score Dashboard</h3>
          <Badge variant="outline">{metrics.totalScored} leads scored</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleBackfill} disabled={backfilling}>
          <Zap className="w-4 h-4 mr-2" />
          {backfilling ? "Processando..." : "Backfill Scores"}
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads com Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalScored}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tempo médio MQL → SQL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgMqlToSql > 0 ? `${metrics.avgMqlToSql} dias` : "N/D"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Regressão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.regressionRate}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 20 leads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 20 Leads por Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
            {topLeads.map((lead, i) => {
              const axes = getScoreAxes(lead);
              return (
                <div key={lead.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-mono text-muted-foreground w-6">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{lead.nome || lead.telefone_normalized || "—"}</p>
                      <p className="text-xs text-muted-foreground">{lead.lead_stage_detected || "—"}</p>
                      {axes && (
                        <div className="flex gap-1 mt-1">
                          {Object.entries(axes).map(([key, val]) => (
                            <span key={key} className="text-[10px] text-muted-foreground">
                              {key.slice(0, 3).toUpperCase()}:{(val as { value?: number })?.value || 0}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge className={getScoreColor(lead.intelligence_score_total)}>
                    {lead.intelligence_score_total}
                  </Badge>
                </div>
              );
            })}
            {topLeads.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead com score calculado. Execute o Backfill.</p>
            )}
          </CardContent>
        </Card>

        {/* Stage distribution pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {stageDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stageDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {stageDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de distribuição.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent state events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">State Events Recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
          {recentEvents.map((event) => (
            <div key={event.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                {event.is_regression ? (
                  <TrendingDown className="w-4 h-4 text-destructive" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                )}
                <div>
                  <p className="text-sm">
                    {event.old_stage || "—"} → <span className="font-medium">{event.new_stage || "—"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{event.source}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(event.changed_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          ))}
          {recentEvents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento registrado ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
