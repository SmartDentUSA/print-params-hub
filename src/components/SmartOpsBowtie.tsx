import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SmartOpsGoalsButton, fetchGoals, DEFAULT_GOALS, type GoalsData } from "./SmartOpsGoals";

// ─── Types ───
interface BowtieMetrics {
  mql: number;
  sql: number;
  vendas: number;
  csContratos: number;
  csOnboarding: number;
  csOngoing: number;
}

interface FunnelRow {
  faixa: string;
  label: string;
  color: string;
  curMonth: number;
  nextMonth: number;
  futureMonths: number;
}

interface PipelineHealth {
  meta: number;
  conquistado: number;
  aRealizar: number;
  pipelineNecessario: number;
  pipelineExistente: number;
  saude: number;
}

// Goals loaded from DB, with defaults

const FAIXAS = [
  { key: "em_processo", label: "Em Processo", color: "bg-red-700 text-white", minScore: -Infinity, maxScore: 60 },
  { key: "boas_chances", label: "Boas Chances", color: "bg-orange-500 text-white", minScore: 60, maxScore: 80 },
  { key: "comprometido", label: "Comprometido", color: "bg-yellow-500 text-white", minScore: 80, maxScore: 100 },
  { key: "conquistado", label: "Conquistado", color: "bg-green-600 text-white", minScore: 100, maxScore: Infinity },
];

// ─── Helpers ───
function healthBadge(value: number, goal: number) {
  const pct = goal > 0 ? (value / goal) * 100 : 0;
  if (pct >= 100) return <Badge className="bg-green-600 text-white">Saudável</Badge>;
  if (pct >= 50) return <Badge className="bg-orange-500 text-white">Atenção</Badge>;
  return <Badge variant="destructive">Crítico</Badge>;
}

function conversionPct(from: number, to: number) {
  if (from === 0) return "0%";
  return `${((to / from) * 100).toFixed(1)}%`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, n: number) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

// ─── Gauge SVG ───
function GaugeSVG({ value, max = 300 }: { value: number; max?: number }) {
  const clamped = Math.min(Math.max(value, 0), max);
  const pct = clamped / max;
  const startAngle = Math.PI;
  const endAngle = 0;
  const sweep = startAngle - endAngle;
  const needleAngle = startAngle - pct * sweep;

  const cx = 120, cy = 110, r = 90;
  const arcPath = (startA: number, endA: number) => {
    const x1 = cx + r * Math.cos(startA);
    const y1 = cy - r * Math.sin(startA);
    const x2 = cx + r * Math.cos(endA);
    const y2 = cy - r * Math.sin(endA);
    const large = endA - startA > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}`;
  };

  const nx = cx + (r - 15) * Math.cos(needleAngle);
  const ny = cy - (r - 15) * Math.sin(needleAngle);

  const ticks = [0, 60, 120, 180, 240, 300];

  return (
    <svg viewBox="0 0 240 140" className="w-full max-w-[280px]">
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="33%" stopColor="#f59e0b" />
          <stop offset="66%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>
      {/* Background arc */}
      <path d={arcPath(Math.PI, 0)} fill="none" stroke="#e5e7eb" strokeWidth="18" strokeLinecap="round" />
      {/* Colored arc */}
      <path d={arcPath(Math.PI, 0)} fill="none" stroke="url(#gaugeGrad)" strokeWidth="14" strokeLinecap="round" />
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#1e293b" />
      {/* Ticks */}
      {ticks.map((t) => {
        const a = Math.PI - (t / max) * Math.PI;
        const tx = cx + (r + 14) * Math.cos(a);
        const ty = cy - (r + 14) * Math.sin(a);
        return <text key={t} x={tx} y={ty} textAnchor="middle" fontSize="9" fill="#64748b">{t}</text>;
      })}
      {/* Value */}
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1e293b">
        {Math.round(value)}
      </text>
      <text x={cx} y={cy + 34} textAnchor="middle" fontSize="9" fill="#64748b">Saúde do Pipeline</text>
    </svg>
  );
}

// ─── Main Component ───
export function SmartOpsBowtie() {
  const [metrics, setMetrics] = useState<BowtieMetrics>({ mql: 0, sql: 0, vendas: 0, csContratos: 0, csOnboarding: 0, csOngoing: 0 });
  const [allLeads, setAllLeads] = useState<{ score: number | null; created_at: string; status_atual_lead_crm: string | null; lead_status: string; produto_interesse: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [goals, setGoals] = useState<GoalsData>(DEFAULT_GOALS);

  const loadGoals = useCallback(async () => {
    const g = await fetchGoals();
    setGoals(g);
  }, []);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  useEffect(() => {
    const fetchAll = async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const [mqlRes, sqlRes, vendasRes, contratosRes, onboardingRes, ongoingRes, leadsRes] = await Promise.all([
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).eq("lead_status", "novo").gte("created_at", thirtyDaysAgo),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).not("resumo_historico_ia", "is", null).gte("created_at", thirtyDaysAgo),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).eq("status_atual_lead_crm", "Ganha").gte("created_at", thirtyDaysAgo),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).not("data_contrato", "is", null).gte("data_contrato", thirtyDaysAgo),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).eq("cs_treinamento", "concluido").or("ativo_scan.eq.true,ativo_notebook.eq.true,ativo_cad.eq.true,ativo_cad_ia.eq.true,ativo_smart_slice.eq.true,ativo_print.eq.true,ativo_cura.eq.true,ativo_insumos.eq.true"),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).gte("data_ultima_compra_insumos", ninetyDaysAgo),
        supabase.from("lia_attendances").select("score, created_at, status_atual_lead_crm, lead_status, produto_interesse").limit(1000),
      ]);

      setMetrics({
        mql: mqlRes.count ?? 0,
        sql: sqlRes.count ?? 0,
        vendas: vendasRes.count ?? 0,
        csContratos: contratosRes.count ?? 0,
        csOnboarding: onboardingRes.count ?? 0,
        csOngoing: ongoingRes.count ?? 0,
      });
      setAllLeads(leadsRes.data || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ─── Funnel data ───
  const funnelRows: FunnelRow[] = useMemo(() => {
    const curStart = selectedMonth;
    const nextStart = addMonths(selectedMonth, 1);
    const futureStart = addMonths(selectedMonth, 2);

    const classify = (score: number | null, status: string | null) => {
      const s = score ?? 0;
      if (s >= 100 || status === "Ganha") return "conquistado";
      if (s >= 80) return "comprometido";
      if (s >= 60) return "boas_chances";
      return "em_processo";
    };

    const countByFaixaAndMonth = (monthStart: Date, monthEnd: Date, faixaKey: string) => {
      return allLeads.filter((l) => {
        const d = new Date(l.created_at);
        return d >= monthStart && d < monthEnd && classify(l.score, l.status_atual_lead_crm) === faixaKey;
      }).length;
    };

    const countFuture = (afterDate: Date, faixaKey: string) => {
      return allLeads.filter((l) => {
        const d = new Date(l.created_at);
        return d >= afterDate && classify(l.score, l.status_atual_lead_crm) === faixaKey;
      }).length;
    };

    return FAIXAS.map((f) => ({
      faixa: f.key,
      label: f.label,
      color: f.color,
      curMonth: countByFaixaAndMonth(curStart, nextStart, f.key),
      nextMonth: countByFaixaAndMonth(nextStart, futureStart, f.key),
      futureMonths: countFuture(futureStart, f.key),
    }));
  }, [allLeads, selectedMonth]);

  // ─── Pipeline health ───
  const pipeline: PipelineHealth = useMemo(() => {
    const curStart = selectedMonth;
    const curEnd = addMonths(selectedMonth, 1);

    const conquistado = allLeads.filter((l) => {
      const d = new Date(l.created_at);
      return d >= curStart && d < curEnd && ((l.score ?? 0) >= 100 || l.status_atual_lead_crm === "Ganha");
    }).length;

    const aRealizar = Math.max(goals.pipelineMeta - conquistado, 0);
    const pipelineNecessario = aRealizar * 3;
    const pipelineExistente = allLeads.filter((l) => (l.score ?? 0) < 100 && l.lead_status !== "perdido").length;
    const saude = pipelineNecessario > 0 ? (pipelineExistente / pipelineNecessario) * 100 : 300;

    return { meta: goals.pipelineMeta, conquistado, aRealizar, pipelineNecessario, pipelineExistente, saude };
  }, [allLeads, selectedMonth, goals]);

  // ─── Leads por Produto de Interesse ───
  const productStats = useMemo(() => {
    const now = new Date();
    const curMonthStart = startOfMonth(now);
    const prevMonthStart = addMonths(curMonthStart, -1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const groups: Record<string, { prev: number; prevWon: number; cur: number; curWon: number; year: number; yearWon: number }> = {};

    allLeads.forEach((l) => {
      const prod = l.produto_interesse || "Não Informado";
      if (!groups[prod]) groups[prod] = { prev: 0, prevWon: 0, cur: 0, curWon: 0, year: 0, yearWon: 0 };
      const d = new Date(l.created_at);
      const won = l.status_atual_lead_crm === "Ganha";

      if (d >= prevMonthStart && d < curMonthStart) { groups[prod].prev++; if (won) groups[prod].prevWon++; }
      if (d >= curMonthStart) { groups[prod].cur++; if (won) groups[prod].curWon++; }
      if (d >= yearStart) { groups[prod].year++; if (won) groups[prod].yearWon++; }
    });

    const rows = Object.entries(groups)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.year - a.year);

    const totals = rows.reduce(
      (t, r) => ({ prev: t.prev + r.prev, prevWon: t.prevWon + r.prevWon, cur: t.cur + r.cur, curWon: t.curWon + r.curWon, year: t.year + r.year, yearWon: t.yearWon + r.yearWon }),
      { prev: 0, prevWon: 0, cur: 0, curWon: 0, year: 0, yearWon: 0 }
    );

    return { rows, totals };
  }, [allLeads]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando métricas...</div>;

  const { mql, sql, vendas, csContratos, csOnboarding, csOngoing } = metrics;

  return (
    <div className="space-y-6">
      {/* ═══ Bowtie original ═══ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Funil Ampulheta (Bowtie)</CardTitle>
          <SmartOpsGoalsButton onSaved={loadGoals} />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
            {/* Acquisition */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider">Aquisição</h3>
              {[
                { label: "MQL (Novos)", value: mql, goal: goals.mql },
                { label: "SQL (Qualificados IA)", value: sql, goal: goals.sql },
                { label: "Vendas (Ganha)", value: vendas, goal: goals.vendas },
              ].map((item, i, arr) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                    <div>
                      <div className="text-sm text-muted-foreground">{item.label}</div>
                      <div className="text-2xl font-bold">{item.value}</div>
                    </div>
                    {healthBadge(item.value, item.goal)}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="text-center text-xs text-muted-foreground my-1">
                      ↓ {conversionPct(arr[i].value, arr[i + 1].value)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottleneck */}
            <div className="flex flex-col items-center justify-center px-4">
              <div className="w-0.5 h-16 bg-border" />
              <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-xs font-bold">⟷</div>
              <div className="w-0.5 h-16 bg-border" />
            </div>

            {/* Expansion */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Expansão</h3>
              {[
                { label: "CS-Contratos (Live)", value: csContratos, goal: goals.csContratos },
                { label: "CS-Onboarding (MRR)", value: csOnboarding, goal: goals.csOnboarding },
                { label: "CS-Ongoing (LTV)", value: csOngoing, goal: goals.csOngoing },
              ].map((item, i, arr) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200">
                    <div>
                      <div className="text-sm text-muted-foreground">{item.label}</div>
                      <div className="text-2xl font-bold">{item.value}</div>
                    </div>
                    {healthBadge(item.value, item.goal)}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="text-center text-xs text-muted-foreground my-1">
                      ↓ {conversionPct(arr[i].value, arr[i + 1].value)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 p-3 bg-muted rounded-lg text-sm text-muted-foreground text-center">
            MQL → Venda: <strong>{conversionPct(mql, vendas)}</strong> &nbsp;|&nbsp;
            Venda → CS Live: <strong>{conversionPct(vendas, csContratos)}</strong> &nbsp;|&nbsp;
            CS Live → Ongoing: <strong>{conversionPct(csContratos, csOngoing)}</strong>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Funil de Oportunidades ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Funil de Oportunidades</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedMonth((m) => addMonths(m, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium capitalize min-w-[140px] text-center">{monthLabel(selectedMonth)}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">🌡️</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Mês Atual</TableHead>
                <TableHead className="text-center">Mês Seguinte</TableHead>
                <TableHead className="text-center">Meses Seguintes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funnelRows.map((row, i) => {
                const widths = [100, 85, 70, 55];
                return (
                  <TableRow key={row.faixa}>
                    <TableCell>
                      <div className={`w-6 h-6 rounded-full ${row.color} flex items-center justify-center text-[10px] font-bold`}>
                        {i + 1}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`${row.color} px-2 py-0.5 rounded text-xs font-medium`} style={{ width: `${widths[i]}%` }}>
                          {row.label}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{row.curMonth}</TableCell>
                    <TableCell className="text-center font-semibold">{row.nextMonth}</TableCell>
                    <TableCell className="text-center font-semibold">{row.futureMonths}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="mt-3 text-xs text-muted-foreground text-center">
            Total mês atual: <strong>{funnelRows.reduce((s, r) => s + r.curMonth, 0)}</strong> leads
          </div>
        </CardContent>
      </Card>

      {/* ═══ Saúde do Pipeline ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Saúde do Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Left: boxes */}
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-xs text-muted-foreground">Meta (+)</div>
                <div className="text-2xl font-bold text-green-700">{pipeline.meta}</div>
              </div>
              <div className="text-center text-muted-foreground text-lg">−</div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-xs text-muted-foreground">Conquistado (−)</div>
                <div className="text-2xl font-bold text-blue-700">{pipeline.conquistado}</div>
              </div>
              <div className="text-center text-muted-foreground text-lg">=</div>
              <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                <div className="text-xs text-muted-foreground">A Realizar (=)</div>
                <div className="text-2xl font-bold text-orange-700">{pipeline.aRealizar}</div>
              </div>
              <div className="text-center font-bold text-primary">× 3</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted border">
                  <div className="text-xs text-muted-foreground">Pipeline Necessário</div>
                  <div className="text-xl font-bold">{pipeline.pipelineNecessario}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted border">
                  <div className="text-xs text-muted-foreground">Pipeline Existente</div>
                  <div className="text-xl font-bold">{pipeline.pipelineExistente}</div>
                </div>
              </div>
            </div>

            {/* Right: gauge */}
            <div className="flex justify-center">
              <GaugeSVG value={pipeline.saude} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Leads por Produto de Interesse ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Leads por Produto de Interesse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto de Interesse</TableHead>
                  <TableHead className="text-center">Mês Anterior</TableHead>
                  <TableHead className="text-center">% Conversão</TableHead>
                  <TableHead className="text-center">Mês Atual</TableHead>
                  <TableHead className="text-center">% Conversão</TableHead>
                  <TableHead className="text-center">Total Ano</TableHead>
                  <TableHead className="text-center">% Conversão (Ano)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productStats.rows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-center">{row.prev}</TableCell>
                    <TableCell className="text-center">{conversionPct(row.prev, row.prevWon)}</TableCell>
                    <TableCell className="text-center">{row.cur}</TableCell>
                    <TableCell className="text-center">{conversionPct(row.cur, row.curWon)}</TableCell>
                    <TableCell className="text-center font-semibold">{row.year}</TableCell>
                    <TableCell className="text-center font-semibold">{conversionPct(row.year, row.yearWon)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold bg-muted/50">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">{productStats.totals.prev}</TableCell>
                  <TableCell className="text-center">{conversionPct(productStats.totals.prev, productStats.totals.prevWon)}</TableCell>
                  <TableCell className="text-center">{productStats.totals.cur}</TableCell>
                  <TableCell className="text-center">{conversionPct(productStats.totals.cur, productStats.totals.curWon)}</TableCell>
                  <TableCell className="text-center">{productStats.totals.year}</TableCell>
                  <TableCell className="text-center">{conversionPct(productStats.totals.year, productStats.totals.yearWon)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
