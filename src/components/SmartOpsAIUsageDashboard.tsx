import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { Brain, DollarSign, Zap, Activity, RefreshCw, TrendingUp, Cpu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const AI_FUNCTIONS_MAP: Record<string, { label: string; provider: string; description: string }> = {
  "dra-lia": { label: "Dra. L.I.A.", provider: "Lovable + Google", description: "Chat com leads via agente IA" },
  "evaluate-interaction": { label: "Judge IA", provider: "Lovable", description: "Avaliação de qualidade de resposta" },
  "ai-content-formatter": { label: "Formatador", provider: "Lovable", description: "Formatação de conteúdo HTML" },
  "ai-metadata-generator": { label: "Metadados SEO", provider: "Lovable", description: "Geração de título, excerpt, meta" },
  "ai-orchestrate-content": { label: "Orquestrador", provider: "Lovable", description: "Orquestração de conteúdo completo" },
  "ai-enrich-pdf-content": { label: "PDF Enricher", provider: "Lovable", description: "Enriquecimento de PDF" },
  "ai-generate-og-image": { label: "OG Image", provider: "Lovable", description: "Geração de OG Image config" },
  "ai-model-compare": { label: "Comparador", provider: "Lovable + DeepSeek", description: "Comparação de modelos" },
  "translate-content": { label: "Tradutor", provider: "Lovable", description: "Tradução EN/ES de artigos" },
  "reformat-article-html": { label: "Reformatador", provider: "Lovable", description: "Reformatação HTML de artigos" },
  "enrich-article-seo": { label: "SEO Enricher", provider: "Lovable", description: "Enriquecimento SEO de artigos" },
  "extract-pdf-specialized": { label: "PDF Especial", provider: "Lovable", description: "Extração especializada de PDF" },
  "extract-pdf-text": { label: "PDF Texto", provider: "Lovable", description: "Extração de texto de PDF" },
  "extract-pdf-raw": { label: "PDF Raw", provider: "Lovable", description: "Extração raw de PDF" },
  "cognitive-lead-analysis": { label: "Análise Cognitiva", provider: "Lovable", description: "Análise cognitiva de leads" },
  "backfill-lia-leads": { label: "Backfill Leads", provider: "Lovable", description: "Resumo de histórico de leads" },
  "backfill-keywords": { label: "Backfill KW", provider: "Lovable", description: "Geração de keywords" },
  "generate-veredict-data": { label: "Veredito", provider: "Lovable", description: "Geração de dados de veredito" },
  "format-processing-instructions": { label: "Instruções", provider: "Lovable", description: "Formatação de instruções" },
  "heal-knowledge-gaps": { label: "Gap Healer", provider: "Lovable + Google", description: "Geração de drafts para gaps" },
  "extract-commercial-expertise": { label: "Expertise", provider: "Lovable", description: "Extração de expertise comercial" },
  "index-embeddings": { label: "Embeddings", provider: "Google", description: "Geração de embeddings vetoriais" },
  "index-spin-entries": { label: "SPIN Embed", provider: "Google", description: "Embeddings SPIN" },
  "ingest-knowledge-text": { label: "KB Embed", provider: "Google", description: "Embeddings da base de conhecimento" },
};

const PROVIDER_LABELS: Record<string, string> = {
  lovable: "Lovable (Gemini)",
  deepseek: "DeepSeek",
  google: "Google (Embed)",
};

const PROVIDER_COLORS: Record<string, string> = {
  lovable: "text-blue-600",
  deepseek: "text-emerald-600",
  google: "text-amber-600",
};

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    });
  }
  return options;
}

function costPer1k(costUsd: number, tokens: number, rate: number): string {
  if (!tokens) return "—";
  return `R$ ${((costUsd / tokens) * 1000 * rate).toFixed(4)}`;
}

export function SmartOpsAIUsageDashboard() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [exchangeRate, setExchangeRate] = useState(5.80);
  const monthOptions = getMonthOptions();

  const [year, month] = selectedMonth.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

  const { data: usageData, isLoading, refetch } = useQuery({
    queryKey: ["ai-token-usage", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_token_usage")
        .select("*")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Aggregate by provider
  const byProvider = useMemo(() => {
    if (!usageData?.length) return [];
    const map: Record<string, { provider: string; calls: number; total_tokens: number; cost_usd: number }> = {};
    for (const row of usageData) {
      const p = row.provider || "lovable";
      if (!map[p]) map[p] = { provider: p, calls: 0, total_tokens: 0, cost_usd: 0 };
      map[p].calls++;
      map[p].total_tokens += row.total_tokens || 0;
      map[p].cost_usd += Number(row.estimated_cost_usd) || 0;
    }
    return Object.values(map).sort((a, b) => b.total_tokens - a.total_tokens);
  }, [usageData]);

  // Aggregate by function
  const byFunction = useMemo(() => {
    if (!usageData?.length) return [];
    const map: Record<string, { calls: number; prompt_tokens: number; completion_tokens: number; total_tokens: number; cost_usd: number; provider: string }> = {};
    for (const row of usageData) {
      const fn = row.function_name;
      if (!map[fn]) map[fn] = { calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost_usd: 0, provider: row.provider || "lovable" };
      map[fn].calls++;
      map[fn].prompt_tokens += row.prompt_tokens || 0;
      map[fn].completion_tokens += row.completion_tokens || 0;
      map[fn].total_tokens += row.total_tokens || 0;
      map[fn].cost_usd += Number(row.estimated_cost_usd) || 0;
    }
    return Object.entries(map)
      .map(([fn, stats]) => ({ function_name: fn, ...stats, ...(AI_FUNCTIONS_MAP[fn] || {}) }))
      .sort((a, b) => b.total_tokens - a.total_tokens);
  }, [usageData]);

  // Aggregate by day
  const byDay = useMemo(() => {
    if (!usageData?.length) return [];
    const map: Record<string, { date: string; tokens: number; calls: number; cost_usd: number }> = {};
    for (const row of usageData) {
      const day = row.created_at.substring(0, 10);
      if (!map[day]) map[day] = { date: day, tokens: 0, calls: 0, cost_usd: 0 };
      map[day].tokens += row.total_tokens || 0;
      map[day].calls++;
      map[day].cost_usd += Number(row.estimated_cost_usd) || 0;
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [usageData]);

  // Totals
  const totals = useMemo(() => {
    const t = { tokens: 0, calls: 0, cost_usd: 0 };
    for (const row of usageData || []) {
      t.tokens += row.total_tokens || 0;
      t.calls++;
      t.cost_usd += Number(row.estimated_cost_usd) || 0;
    }
    return t;
  }, [usageData]);

  const chartConfig = {
    tokens: { label: "Tokens", color: "hsl(var(--primary))" },
    calls: { label: "Chamadas", color: "hsl(var(--accent))" },
  };

  const barChartConfig = {
    total_tokens: { label: "Tokens", color: "hsl(var(--primary))" },
  };

  return (
    <div className="space-y-6">
      {/* Header / Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">USD→BRL:</span>
          <Input
            type="number"
            step="0.01"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(Number(e.target.value) || 5.80)}
            className="w-[90px]"
          />
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Brain className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.tokens.toLocaleString("pt-BR")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chamadas IA</CardTitle>
            <Zap className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.calls.toLocaleString("pt-BR")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Custo USD</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$ {totals.cost_usd.toFixed(4)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Custo BRL</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {(totals.cost_usd * exchangeRate).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">R$/1K Tokens</CardTitle>
            <Cpu className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{costPer1k(totals.cost_usd, totals.tokens, exchangeRate)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Provider Breakdown */}
      {byProvider.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {byProvider.map((p) => (
            <Card key={p.provider}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span className={PROVIDER_COLORS[p.provider] || ""}>{PROVIDER_LABELS[p.provider] || p.provider}</span>
                  <Badge variant="secondary" className="text-xs">{p.calls} calls</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-lg font-bold">{p.total_tokens.toLocaleString("pt-BR")} tokens</div>
                <div className="text-sm text-muted-foreground">
                  R$ {(p.cost_usd * exchangeRate).toFixed(2)} · {costPer1k(p.cost_usd, p.total_tokens, exchangeRate)}/1K
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      {byDay.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Evolução Diária de Tokens</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <LineChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(v) => v.substring(8)} fontSize={12} />
                  <YAxis fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="tokens" stroke="var(--color-tokens)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Top Funções por Tokens</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={barChartConfig} className="h-[250px]">
                <BarChart data={byFunction.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis dataKey="function_name" type="category" width={140} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total_tokens" fill="var(--color-total_tokens)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Usage Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Consumo por Função
            {isLoading && <Badge variant="secondary">Carregando...</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byFunction.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Função</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Prompt</TableHead>
                    <TableHead className="text-right">Completion</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">R$</TableHead>
                    <TableHead className="text-right">R$/1K tok</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byFunction.map((row) => (
                    <TableRow key={row.function_name}>
                      <TableCell className="font-mono text-xs">{row.function_name}</TableCell>
                      <TableCell className="text-sm">{(row as any).label || row.function_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{(row as any).provider || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{row.calls}</TableCell>
                      <TableCell className="text-right">{row.prompt_tokens.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{row.completion_tokens.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right font-medium">{row.total_tokens.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right font-medium">R$ {(row.cost_usd * exchangeRate).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{costPer1k(row.cost_usd, row.total_tokens, exchangeRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                {isLoading ? "Carregando dados..." : "Nenhum dado de consumo registrado neste mês. Tabela de referência das funções IA instrumentadas:"}
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Função</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(AI_FUNCTIONS_MAP).map(([fn, info]) => (
                      <TableRow key={fn}>
                        <TableCell className="font-mono text-xs">{fn}</TableCell>
                        <TableCell className="text-sm font-medium">{info.label}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{info.provider}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{info.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
