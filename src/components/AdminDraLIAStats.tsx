import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Legend,
} from "recharts";
import { MessageSquare, ThumbsUp, HelpCircle, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DailyData {
  day: string;
  total: number;
  positive: number;
  negative: number;
}

interface KnowledgeGap {
  id: string;
  question: string;
  frequency: number;
  status: string;
  created_at: string;
  lang: string;
}

interface Stats {
  totalInteractions: number;
  satisfactionRate: number;
  positiveCount: number;
  negativeCount: number;
  noneCount: number;
  unansweredCount: number;
  pendingGapsCount: number;
}

export function AdminDraLIAStats() {
  const [stats, setStats] = useState<Stats>({
    totalInteractions: 0,
    satisfactionRate: 0,
    positiveCount: 0,
    negativeCount: 0,
    noneCount: 0,
    unansweredCount: 0,
    pendingGapsCount: 0,
  });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Fetch all interactions from last 30 days
      const { data: interactions, error: intError } = await supabase
        .from("agent_interactions")
        .select("created_at, feedback, unanswered")
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (intError) throw intError;

      // Compute KPIs
      const total = interactions?.length ?? 0;
      const positive = interactions?.filter((i) => i.feedback === "positive").length ?? 0;
      const negative = interactions?.filter((i) => i.feedback === "negative").length ?? 0;
      const none = interactions?.filter((i) => i.feedback === "none" || !i.feedback).length ?? 0;
      const unanswered = interactions?.filter((i) => i.unanswered === true).length ?? 0;
      const withFeedback = positive + negative;
      const satisfactionRate = withFeedback > 0 ? Math.round((positive / withFeedback) * 100) : 0;

      // Group by day
      const dayMap: Record<string, { total: number; positive: number; negative: number }> = {};
      interactions?.forEach((i) => {
        const day = i.created_at?.slice(0, 10) ?? "";
        if (!dayMap[day]) dayMap[day] = { total: 0, positive: 0, negative: 0 };
        dayMap[day].total += 1;
        if (i.feedback === "positive") dayMap[day].positive += 1;
        if (i.feedback === "negative") dayMap[day].negative += 1;
      });

      const daily = Object.entries(dayMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, v]) => ({
          day: day.slice(5), // MM-DD
          total: v.total,
          positive: v.positive,
          negative: v.negative,
        }));

      // Fetch knowledge gaps
      const { data: gaps, error: gapError } = await supabase
        .from("agent_knowledge_gaps")
        .select("id, question, frequency, status, created_at, lang")
        .order("frequency", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);

      if (gapError) throw gapError;

      const pendingGaps = gaps?.filter((g) => g.status === "pending").length ?? 0;

      setStats({
        totalInteractions: total,
        satisfactionRate,
        positiveCount: positive,
        negativeCount: negative,
        noneCount: none,
        unansweredCount: unanswered,
        pendingGapsCount: pendingGaps,
      });
      setDailyData(daily);
      setKnowledgeGaps((gaps as KnowledgeGap[]) ?? []);
    } catch (err) {
      console.error("Error fetching Dra. L.I.A. stats:", err);
      toast({ title: "Erro ao carregar estatísticas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResolve = async (gapId: string) => {
    setResolvingId(gapId);
    try {
      const { error } = await supabase
        .from("agent_knowledge_gaps")
        .update({ status: "resolved" })
        .eq("id", gapId);

      if (error) throw error;

      setKnowledgeGaps((prev) =>
        prev.map((g) => (g.id === gapId ? { ...g, status: "resolved" } : g))
      );
      setStats((prev) => ({
        ...prev,
        pendingGapsCount: Math.max(0, prev.pendingGapsCount - 1),
      }));
      toast({ title: "Lacuna marcada como resolvida ✓" });
    } catch {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } finally {
      setResolvingId(null);
    }
  };

  const radialData = [
    {
      name: "👍 Positivo",
      value: stats.satisfactionRate,
      fill: "hsl(var(--chart-2))",
    },
  ];

  const kpis = [
    {
      label: "Interações (30 dias)",
      value: stats.totalInteractions,
      icon: MessageSquare,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Taxa de Satisfação",
      value: `${stats.satisfactionRate}%`,
      icon: ThumbsUp,
      color: "text-chart-2",
      bg: "bg-chart-2/10",
    },
    {
      label: "Sem Resposta",
      value: stats.unansweredCount,
      icon: HelpCircle,
      color: "text-chart-3",
      bg: "bg-chart-3/10",
    },
    {
      label: "Lacunas Pendentes",
      value: stats.pendingGapsCount,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">🤖 Dra. L.I.A. — Estatísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              🤖 Dra. L.I.A. — Estatísticas
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily interactions bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Interações por Dia (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                Nenhuma interação registrada ainda
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value, name) => [
                      value,
                      name === "total" ? "Total" : name === "positive" ? "👍 Positivos" : "👎 Negativos",
                    ]}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="total" />
                  <Bar dataKey="positive" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="positive" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Satisfaction radial */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Satisfação 👍 / 👎</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.positiveCount + stats.negativeCount === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm text-center">
                Nenhum feedback registrado ainda
              </div>
            ) : (
              <div className="relative">
                <ResponsiveContainer width="100%" height={160}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="90%"
                    barSize={14}
                    data={radialData}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "hsl(var(--muted))" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{stats.satisfactionRate}%</span>
                  <span className="text-xs text-muted-foreground">positivo</span>
                </div>
                <div className="mt-2 grid grid-cols-3 text-center text-xs gap-1">
                  <div>
                    <div className="font-semibold text-chart-2">{stats.positiveCount}</div>
                    <div className="text-muted-foreground">👍</div>
                  </div>
                  <div>
                    <div className="font-semibold text-destructive">{stats.negativeCount}</div>
                    <div className="text-muted-foreground">👎</div>
                  </div>
                  <div>
                    <div className="font-semibold text-muted-foreground">{stats.noneCount}</div>
                    <div className="text-muted-foreground">sem</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Knowledge gaps table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top 10 Perguntas Sem Resposta</CardTitle>
        </CardHeader>
        <CardContent>
          {knowledgeGaps.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
              Nenhuma lacuna de conhecimento registrada
            </div>
          ) : (
            <div className="space-y-2">
              {knowledgeGaps.map((gap) => (
                <div
                  key={gap.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight line-clamp-2">{gap.question}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {new Date(gap.created_at).toLocaleDateString("pt-BR")}
                      </span>
                      {gap.lang && (
                        <span className="text-xs text-muted-foreground uppercase">{gap.lang}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {gap.frequency}×
                    </Badge>
                    <Badge
                      className={`text-xs ${
                        gap.status === "resolved"
                          ? "bg-chart-2/20 text-chart-2 border-chart-2/30"
                          : "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400"
                      }`}
                      variant="outline"
                    >
                      {gap.status === "resolved" ? "resolvido" : "pendente"}
                    </Badge>
                    {gap.status !== "resolved" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs gap-1"
                        disabled={resolvingId === gap.id}
                        onClick={() => handleResolve(gap.id)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resolver
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
