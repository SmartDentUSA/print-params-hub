import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Shield, Play, RefreshCw, TrendingUp, Flame, AlertTriangle, Swords, Sparkles, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";

type Period = "24h" | "7d" | "30d";
const PERIOD_HOURS: Record<Period, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

interface SentMsg {
  id: string;
  created_at: string;
  message_ts: string | null;
  group_id: string | null;
  group_name: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  message_text: string | null;
  sentiment: string | null;
  intent: string | null;
  urgency: string | null;
  topics: string[] | null;
  product_mentions: string[] | null;
  competitor_mentions: string[] | null;
  buy_signals: boolean;
  relevance_score: number | null;
}

interface Insight {
  id: string;
  created_at: string;
  insight_type: string;
  title: string;
  summary: string;
  detail: string | null;
  category: string | null;
  severity: string;
  reviewed: boolean;
  metrics: any;
  messages_analyzed: number | null;
  groups_analyzed: number | null;
  resolution_note: string | null;
}

interface GroupCfg {
  id?: string;
  group_id: string;
  group_name: string;
  monitoring_active: boolean;
  priority: string;
  member_count: number | null;
}

const SENT_COLORS: Record<string, string> = {
  positive: "#22c55e",
  neutral: "#94a3b8",
  negative: "#ef4444",
  mixed: "#f59e0b",
};

export function SentinelaTab() {
  const [period, setPeriod] = useState<Period>("24h");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<SentMsg[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [groups, setGroups] = useState<GroupCfg[]>([]);
  const [totalGroupCount, setTotalGroupCount] = useState<number>(0);

  const sinceISO = useMemo(
    () => new Date(Date.now() - PERIOD_HOURS[period] * 3600 * 1000).toISOString(),
    [period]
  );

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadMessages(), loadInsights(), loadGroups()]);
    setLoading(false);
  }

  async function loadMessages() {
    const { data, error } = await supabase
      .from("sentinela_group_messages")
      .select("id, created_at, message_ts, group_id, group_name, sender_name, sender_phone, message_text, sentiment, intent, urgency, topics, product_mentions, competitor_mentions, buy_signals, relevance_score")
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      // Sem permissão (não-admin) → tudo bem, deixa vazio
      setMessages([]);
    } else {
      setMessages((data as any) ?? []);
    }
  }

  async function loadInsights() {
    const { data } = await supabase
      .from("sentinela_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setInsights((data as any) ?? []);
  }

  async function loadGroups() {
    const { data: gs } = await supabase
      .from("wa_groups")
      .select("id, name, member_count, ativo, instance_name")
      .eq("instance_name", "Danilo Henrique")
      .eq("ativo", true)
      .order("member_count", { ascending: false })
      .limit(500);

    const { data: cfgs } = await supabase
      .from("sentinela_config")
      .select("id, group_id, monitoring_active, priority");

    const cfgMap = new Map((cfgs ?? []).map((c: any) => [c.group_id, c]));
    const list: GroupCfg[] = (gs ?? []).map((g: any) => {
      const c = cfgMap.get(g.id);
      return {
        id: c?.id,
        group_id: g.id,
        group_name: g.name,
        member_count: g.member_count,
        monitoring_active: c ? c.monitoring_active : false,
        priority: c?.priority ?? "medium",
      };
    });
    setGroups(list);
    setTotalGroupCount(gs?.length ?? 0);
  }

  async function toggleMonitoring(g: GroupCfg, active: boolean) {
    const { error } = await supabase
      .from("sentinela_config")
      .upsert(
        { id: g.id, group_id: g.group_id, monitoring_active: active, priority: g.priority },
        { onConflict: "group_id" }
      );
    if (error) {
      toast.error("Sem permissão: " + error.message);
      return;
    }
    toast.success(active ? "Monitoramento ativado" : "Monitoramento desativado");
    await loadGroups();
  }

  async function runAnalyzer() {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("sentinela-analyzer");
      if (error) throw error;
      toast.success("Analyzer executado");
      await loadAll();
    } catch (e) {
      toast.error("Falha: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // ----- Derived metrics for Momentum
  const metrics = useMemo(() => {
    const total = messages.length;
    const buy = messages.filter((m) => m.buy_signals).length;
    const sentimentCount: Record<string, number> = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    const topicCount: Record<string, number> = {};
    const prodCount: Record<string, number> = {};
    const compCount: Record<string, number> = {};
    const byDay: Record<string, { day: string; total: number; pos: number; neg: number }> = {};
    for (const m of messages) {
      const s = m.sentiment ?? "neutral";
      sentimentCount[s] = (sentimentCount[s] || 0) + 1;
      for (const t of m.topics ?? []) topicCount[t] = (topicCount[t] || 0) + 1;
      for (const p of m.product_mentions ?? []) prodCount[p] = (prodCount[p] || 0) + 1;
      for (const c of m.competitor_mentions ?? []) compCount[c] = (compCount[c] || 0) + 1;
      const day = (m.message_ts ?? m.created_at).slice(0, 10);
      const slot = (byDay[day] ||= { day, total: 0, pos: 0, neg: 0 });
      slot.total++;
      if (s === "positive") slot.pos++;
      if (s === "negative") slot.neg++;
    }
    const top = (obj: Record<string, number>) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
    return {
      total,
      buy,
      groups: new Set(messages.map((m) => m.group_id).filter(Boolean)).size,
      sentiment: Object.entries(sentimentCount).map(([name, value]) => ({ name, value })),
      topTopics: top(topicCount),
      topProducts: top(prodCount),
      topCompetitors: top(compCount),
      series: Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)),
    };
  }, [messages]);

  const buySignals = useMemo(
    () => messages.filter((m) => m.buy_signals).sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0)),
    [messages]
  );

  const atritoInsights = insights.filter((i) => i.insight_type === "atrito");
  const competitivoInsights = insights.filter((i) => i.insight_type === "competitivo");
  const preditivos = insights.filter((i) => i.insight_type === "oportunidade" || i.insight_type === "tendencia");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold">Sentinela — Inteligência de Mercado</h3>
          <Badge variant="outline" className="text-xs">Instância Danilo Henrique</Badge>
          <Badge variant="outline" className="text-xs">{totalGroupCount} grupos ativos</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="h-8">
              <TabsTrigger value="24h" className="text-xs">24h</TabsTrigger>
              <TabsTrigger value="7d" className="text-xs">7 dias</TabsTrigger>
              <TabsTrigger value="30d" className="text-xs">30 dias</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={runAnalyzer} disabled={running}>
            <Play className="w-4 h-4 mr-1" /> {running ? "Analisando…" : "Analisar Agora"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="momentum" className="space-y-3">
        <TabsList className="flex w-full overflow-x-auto justify-start gap-1">
          <TabsTrigger value="momentum"><TrendingUp className="w-4 h-4 mr-1" /> Momentum</TabsTrigger>
          <TabsTrigger value="buy"><Flame className="w-4 h-4 mr-1" /> Sinais de Compra</TabsTrigger>
          <TabsTrigger value="atrito"><AlertTriangle className="w-4 h-4 mr-1" /> Pontos de Atrito</TabsTrigger>
          <TabsTrigger value="comp"><Swords className="w-4 h-4 mr-1" /> Intel Competitiva</TabsTrigger>
          <TabsTrigger value="pred"><Sparkles className="w-4 h-4 mr-1" /> Ações Preditivas</TabsTrigger>
          <TabsTrigger value="cfg"><Settings2 className="w-4 h-4 mr-1" /> Configuração</TabsTrigger>
        </TabsList>

        {/* MOMENTUM */}
        <TabsContent value="momentum" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Mensagens" value={metrics.total} />
            <Kpi label="Grupos ativos" value={metrics.groups} />
            <Kpi label="Sinais de compra" value={metrics.buy} tone="hot" />
            <Kpi label="Insights no período" value={insights.filter((i) => new Date(i.created_at).getTime() >= Date.parse(sinceISO)).length} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-sm">Volume × Sentimento</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer>
                  <LineChart data={metrics.series}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} />
                    <Line type="monotone" dataKey="pos" stroke="#22c55e" strokeWidth={2} />
                    <Line type="monotone" dataKey="neg" stroke="#ef4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Sentimento</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={metrics.sentiment} dataKey="value" nameKey="name" outerRadius={80} label>
                      {metrics.sentiment.map((s) => (
                        <Cell key={s.name} fill={SENT_COLORS[s.name] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ChartCard title="Tópicos em alta" data={metrics.topTopics} color="#6366f1" />
            <ChartCard title="Produtos mencionados" data={metrics.topProducts} color="#22c55e" />
          </div>
        </TabsContent>

        {/* SINAIS DE COMPRA */}
        <TabsContent value="buy" className="space-y-3">
          {buySignals.length === 0 && (
            <Card><CardContent className="py-6 text-sm text-muted-foreground">Nenhum sinal de compra no período. Rode o analyzer.</CardContent></Card>
          )}
          {buySignals.map((m) => (
            <Card key={m.id}>
              <CardContent className="py-3 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{m.group_name ?? "Grupo"}</Badge>
                    <UrgencyBadge urgency={m.urgency} />
                    {m.relevance_score != null && (
                      <Badge variant="secondary" className="text-xs">score {m.relevance_score}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatTs(m.message_ts ?? m.created_at)}</div>
                </div>
                <div className="text-sm">{m.message_text}</div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <span>{anon(m.sender_name)}</span>
                  {(m.product_mentions ?? []).map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ATRITO */}
        <TabsContent value="atrito" className="space-y-3">
          {atritoInsights.length === 0 && (
            <Card><CardContent className="py-6 text-sm text-muted-foreground">Nenhum ponto de atrito detectado.</CardContent></Card>
          )}
          {atritoInsights.map((i) => (
            <InsightCard key={i.id} insight={i} onResolved={loadInsights} />
          ))}
        </TabsContent>

        {/* COMPETITIVA */}
        <TabsContent value="comp" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Concorrentes mencionados ({period})</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer>
                <BarChart data={metrics.topCompetitors}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          {competitivoInsights.map((i) => (
            <InsightCard key={i.id} insight={i} onResolved={loadInsights} />
          ))}
        </TabsContent>

        {/* PREDITIVOS */}
        <TabsContent value="pred" className="space-y-3">
          {preditivos.length === 0 && (
            <Card><CardContent className="py-6 text-sm text-muted-foreground">Nenhuma ação preditiva ainda.</CardContent></Card>
          )}
          {preditivos.map((i) => (
            <InsightCard key={i.id} insight={i} onResolved={loadInsights} />
          ))}
        </TabsContent>

        {/* CONFIGURAÇÃO */}
        <TabsContent value="cfg" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Webhook Evolution</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>Endpoint para registrar na instância <b>Danilo Henrique</b>:</p>
              <code className="block bg-muted p-2 rounded break-all">
                https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/sentinela-webhook-receiver
              </code>
              <p>Evento: <b>MESSAGES_UPSERT</b>. Não sobrescrever webhooks existentes — adicionar como destino adicional.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Grupos monitorados ({groups.filter((g) => g.monitoring_active).length}/{groups.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-[600px] overflow-y-auto">
              {groups.map((g) => (
                <div key={g.group_id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{g.group_name}</div>
                    <div className="text-xs text-muted-foreground">{g.member_count ?? 0} membros · prioridade {g.priority}</div>
                  </div>
                  <Switch
                    checked={g.monitoring_active}
                    onCheckedChange={(v) => toggleMonitoring(g, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: "hot" }) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${tone === "hot" ? "text-orange-600" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, data, color }: { title: string; data: { name: string; value: number }[]; color: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="h-56">
        {data.length === 0 ? (
          <div className="text-xs text-muted-foreground">Sem dados.</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 50 }}>
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="name" fontSize={11} width={120} />
              <Tooltip />
              <Bar dataKey="value" fill={color} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function UrgencyBadge({ urgency }: { urgency: string | null }) {
  const map: Record<string, { c: string; label: string }> = {
    high: { c: "bg-red-100 text-red-700 border-red-200", label: "🔴 alta" },
    medium: { c: "bg-amber-100 text-amber-700 border-amber-200", label: "🟡 média" },
    low: { c: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "🟢 baixa" },
  };
  const u = map[urgency ?? ""] ?? { c: "bg-muted", label: urgency ?? "—" };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${u.c}`}>{u.label}</span>;
}

function InsightCard({ insight, onResolved }: { insight: Insight; onResolved: () => void }) {
  const [note, setNote] = useState(insight.resolution_note ?? "");
  const [saving, setSaving] = useState(false);

  async function markReviewed() {
    setSaving(true);
    const { error } = await supabase
      .from("sentinela_insights")
      .update({ reviewed: true, reviewed_at: new Date().toISOString(), resolution_note: note })
      .eq("id", insight.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Marcado como resolvido");
      onResolved();
    }
  }

  const sevTone =
    insight.severity === "critical" ? "border-red-300 bg-red-50" :
    insight.severity === "warning" ? "border-amber-300 bg-amber-50" :
    "border-border";

  return (
    <Card className={sevTone}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span>{insight.title}</span>
          <div className="flex gap-1">
            {insight.category && <Badge variant="outline" className="text-[10px]">{insight.category}</Badge>}
            <Badge variant="outline" className="text-[10px]">{insight.severity}</Badge>
            {insight.reviewed && <Badge variant="secondary" className="text-[10px]">resolvido</Badge>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm whitespace-pre-wrap">{insight.summary}</div>
        {insight.messages_analyzed != null && (
          <div className="text-xs text-muted-foreground">{insight.messages_analyzed} mensagens analisadas</div>
        )}
        {!insight.reviewed && (
          <div className="flex gap-2">
            <Input
              placeholder="Ação tomada…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-8 text-xs"
            />
            <Button size="sm" variant="outline" disabled={saving} onClick={markReviewed}>Resolver</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function anon(name: string | null) {
  if (!name) return "Membro";
  const parts = name.trim().split(/\s+/);
  return parts[0] + (parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : "");
}

export default SentinelaTab;