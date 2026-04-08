import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { toast } from "sonner";
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

interface FunnelBand {
  key: string;
  label: string;
  display: string;
  mes_anterior: { count: number; value: number };
  mes_atual: { count: number; value: number };
  pipeline_atual: { count: number; value: number };
}

interface FunnelData {
  funil: FunnelBand[];
  summary: {
    colunas: { col1: string; col2: string; col3: string };
    total_pipeline_atual_value: number;
    total_mes_atual_value: number;
    total_mes_anterior_value: number;
  };
}

interface PipelineHealth {
  meta: number;
  conquistado: number;
  aRealizar: number;
  pipelineNecessario: number;
  pipelineExistente: number;
  saude: number;
}

interface ProductRow {
  name: string;
  prev: number;
  prevWon: number;
  cur: number;
  curWon: number;
  year: number;
  yearWon: number;
}

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

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
      <path d={arcPath(Math.PI, 0)} fill="none" stroke="#e5e7eb" strokeWidth="18" strokeLinecap="round" />
      <path d={arcPath(Math.PI, 0)} fill="none" stroke="url(#gaugeGrad)" strokeWidth="14" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#1e293b" />
      {ticks.map((t) => {
        const a = Math.PI - (t / max) * Math.PI;
        const tx = cx + (r + 14) * Math.cos(a);
        const ty = cy - (r + 14) * Math.sin(a);
        return <text key={t} x={tx} y={ty} textAnchor="middle" fontSize="9" fill="#64748b">{t}</text>;
      })}
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1e293b">
        {Math.round(value)}
      </text>
      <text x={cx} y={cy + 34} textAnchor="middle" fontSize="9" fill="#64748b">Saúde do Pipeline</text>
    </svg>
  );
}

// ─── Converted stages that count as "won" ───
const WON_STAGES = new Set([
  "Em espera", "Etapa 1", "Treinamento Agendado", "Equipamentos Entregues", "Pedir Faturamento",
]);

// ─── Main Component ───
export function SmartOpsBowtie() {
  const [metrics, setMetrics] = useState<BowtieMetrics>({ mql: 0, sql: 0, vendas: 0, csContratos: 0, csOnboarding: 0, csOngoing: 0 });
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [productLeads, setProductLeads] = useState<Array<{ anchor_product: string; real_status: string | null; piperun_created_at: string | null; piperun_stage_name: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [goals, setGoals] = useState<GoalsData>(DEFAULT_GOALS);
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false);
  const [pipelineOverrides, setPipelineOverrides] = useState<{ meta?: string; conquistado?: string; existente?: string }>({});
  const [savedOverrides, setSavedOverrides] = useState<{ meta?: number; conquistado?: number; existente?: number }>({});

  const loadGoals = useCallback(async () => {
    const g = await fetchGoals();
    setGoals(g);
  }, []);

  const loadPipelineOverrides = useCallback(async () => {
    const { data } = await supabase.from("site_settings").select("key, value").in("key", [
      "smartops_pipeline_meta_override",
      "smartops_pipeline_conquistado_override",
      "smartops_pipeline_existente_override",
    ]);
    const ov: typeof savedOverrides = {};
    data?.forEach((r) => {
      const v = r.value ? Number(r.value) : undefined;
      if (v !== undefined && !isNaN(v)) {
        if (r.key === "smartops_pipeline_meta_override") ov.meta = v;
        if (r.key === "smartops_pipeline_conquistado_override") ov.conquistado = v;
        if (r.key === "smartops_pipeline_existente_override") ov.existente = v;
      }
    });
    setSavedOverrides(ov);
  }, []);

  useEffect(() => { loadGoals(); loadPipelineOverrides(); }, [loadGoals, loadPipelineOverrides]);

  const savePipelineOverrides = async () => {
    const entries = [
      { key: "smartops_pipeline_meta_override", value: pipelineOverrides.meta },
      { key: "smartops_pipeline_conquistado_override", value: pipelineOverrides.conquistado },
      { key: "smartops_pipeline_existente_override", value: pipelineOverrides.existente },
    ];
    for (const e of entries) {
      if (e.value !== undefined && e.value !== "") {
        await supabase.from("site_settings").upsert({ key: e.key, value: e.value }, { onConflict: "key" });
      } else {
        await supabase.from("site_settings").delete().eq("key", e.key);
      }
    }
    await loadPipelineOverrides();
    setPipelineModalOpen(false);
    toast.success("Overrides salvos!");
  };

  useEffect(() => {
    const fetchAll = async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const [mqlRes, sqlRes, vendasRes, contratosRes, onboardingRes, ongoingRes, funnelRes, productRes] = await Promise.all([
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).eq("lead_status", "novo").gte("created_at", thirtyDaysAgo),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).not("resumo_historico_ia", "is", null).gte("created_at", thirtyDaysAgo),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).eq("status_atual_lead_crm", "Ganha").gte("created_at", thirtyDaysAgo),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).not("data_contrato", "is", null).gte("data_contrato", thirtyDaysAgo),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).eq("cs_treinamento", "concluido").or("ativo_scan.eq.true,ativo_notebook.eq.true,ativo_cad.eq.true,ativo_cad_ia.eq.true,ativo_smart_slice.eq.true,ativo_print.eq.true,ativo_cura.eq.true,ativo_insumos.eq.true"),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).gte("data_ultima_compra_insumos", ninetyDaysAgo),
        // CORREÇÃO 1: Edge Function for funnel data
        supabase.functions.invoke("pipeline-funnel-data"),
        // CORREÇÃO 3: anchor_product instead of produto_interesse
        fetchProductLeads(),
      ]);

      setMetrics({
        mql: mqlRes.count ?? 0,
        sql: sqlRes.count ?? 0,
        vendas: vendasRes.count ?? 0,
        csContratos: contratosRes.count ?? 0,
        csOnboarding: onboardingRes.count ?? 0,
        csOngoing: ongoingRes.count ?? 0,
      });

      if (funnelRes.data && !funnelRes.error) {
        setFunnelData(funnelRes.data as FunnelData);
      }

      setLoading(false);
    };

    async function fetchProductLeads() {
      const allRows: typeof productLeads = [];
      let offset = 0;
      const BATCH = 1000;
      while (true) {
        const { data } = await supabase
          .from("lia_attendances")
          .select("anchor_product, real_status, piperun_created_at, piperun_stage_name")
          .is("merged_into", null)
          .not("anchor_product", "is", null)
          .neq("anchor_product", "")
          .range(offset, offset + BATCH - 1);
        if (!data || data.length === 0) break;
        allRows.push(...(data as typeof productLeads));
        if (data.length < BATCH) break;
        offset += BATCH;
      }
      setProductLeads(allRows);
    }

    fetchAll();
  }, []);

  // ─── CORREÇÃO 1: Funnel from Edge Function ───
  const FAIXA_COLORS: Record<string, string> = {
    em_processo: "bg-red-700 text-white",
    boas_chances: "bg-orange-500 text-white",
    comprometido: "bg-yellow-500 text-white",
    conquistado: "bg-green-600 text-white",
  };

  // ─── CORREÇÃO 2: Pipeline health from Edge Function data ───
  const pipeline: PipelineHealth = useMemo(() => {
    if (!funnelData) return { meta: 0, conquistado: 0, aRealizar: 0, pipelineNecessario: 0, pipelineExistente: 0, saude: 0 };

    const pipelineExistente = savedOverrides.existente ?? funnelData.summary.total_pipeline_atual_value;
    const conquistadoValue = funnelData.funil[3]?.mes_atual?.value ?? 0;
    const conquistado = savedOverrides.conquistado ?? conquistadoValue;

    // Meta from site_settings (value "2000" = R$ 2.000.000)
    const metaMultiplied = (savedOverrides.meta ?? goals.pipelineMeta) * 1000;
    const meta = metaMultiplied;

    const aRealizar = Math.max(meta - conquistado, 0);
    const pipelineNecessario = aRealizar * 3;
    const saude = pipelineNecessario > 0 ? (pipelineExistente / pipelineNecessario) * 100 : 300;

    return { meta, conquistado, aRealizar, pipelineNecessario, pipelineExistente, saude };
  }, [funnelData, goals, savedOverrides]);

  // ─── CORREÇÃO 3: Leads por Produto (anchor_product) ───
  const productStats = useMemo(() => {
    const now = new Date();
    const curMonthStart = startOfMonth(now);
    const prevMonthStart = addMonths(curMonthStart, -1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const groups: Record<string, { prev: number; prevWon: number; cur: number; curWon: number; year: number; yearWon: number }> = {};

    productLeads.forEach((l) => {
      const prod = l.anchor_product || "Não Informado";
      if (!groups[prod]) groups[prod] = { prev: 0, prevWon: 0, cur: 0, curWon: 0, year: 0, yearWon: 0 };
      const d = l.piperun_created_at ? new Date(l.piperun_created_at) : null;
      const won = l.real_status === "CLIENTE" || WON_STAGES.has(l.piperun_stage_name || "");

      if (d && d >= prevMonthStart && d < curMonthStart) { groups[prod].prev++; if (won) groups[prod].prevWon++; }
      if (d && d >= curMonthStart) { groups[prod].cur++; if (won) groups[prod].curWon++; }
      if (d && d >= yearStart) { groups[prod].year++; if (won) groups[prod].yearWon++; }
    });

    const rows: ProductRow[] = Object.entries(groups)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.year - a.year)
      .slice(0, 10);

    const totals = rows.reduce(
      (t, r) => ({ prev: t.prev + r.prev, prevWon: t.prevWon + r.prevWon, cur: t.cur + r.cur, curWon: t.curWon + r.curWon, year: t.year + r.year, yearWon: t.yearWon + r.yearWon }),
      { prev: 0, prevWon: 0, cur: 0, curWon: 0, year: 0, yearWon: 0 }
    );

    return { rows, totals };
  }, [productLeads]);

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

      {/* ═══ CORREÇÃO 1: Funil de Oportunidades (Edge Function) ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Funil de Oportunidades</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {funnelData ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">🌡️</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">{funnelData.summary.colunas.col1}</TableHead>
                    <TableHead className="text-center">{funnelData.summary.colunas.col2}</TableHead>
                    <TableHead className="text-center">{funnelData.summary.colunas.col3}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funnelData.funil.map((row, i) => {
                    const widths = [100, 85, 70, 55];
                    const color = FAIXA_COLORS[row.key] || "bg-muted";
                    return (
                      <TableRow key={row.key}>
                        <TableCell>
                          <div className={`w-6 h-6 rounded-full ${color} flex items-center justify-center text-[10px] font-bold`}>
                            {row.display}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`${color} px-2 py-0.5 rounded text-xs font-medium`} style={{ width: `${widths[i]}%` }}>
                              {row.label}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <div className="font-semibold">{formatBRL(row.mes_anterior.value)}</div>
                          <div className="text-xs text-muted-foreground">({row.mes_anterior.count})</div>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <div className="font-semibold">{formatBRL(row.mes_atual.value)}</div>
                          <div className="text-xs text-muted-foreground">({row.mes_atual.count})</div>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <div className="font-semibold">{formatBRL(row.pipeline_atual.value)}</div>
                          <div className="text-xs text-muted-foreground">({row.pipeline_atual.count})</div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground text-center">
                <div>Total: <strong>{formatBRL(funnelData.summary.total_mes_anterior_value)}</strong></div>
                <div>Total: <strong>{formatBRL(funnelData.summary.total_mes_atual_value)}</strong></div>
                <div>Total: <strong>{formatBRL(funnelData.summary.total_pipeline_atual_value)}</strong></div>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-4">Erro ao carregar dados do funil</div>
          )}
        </CardContent>
      </Card>

      {/* ═══ CORREÇÃO 2: Saúde do Pipeline ═══ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Saúde do Pipeline</CardTitle>
          <Dialog open={pipelineModalOpen} onOpenChange={(open) => {
            setPipelineModalOpen(open);
            if (open) {
              setPipelineOverrides({
                meta: savedOverrides.meta?.toString() ?? "",
                conquistado: savedOverrides.conquistado?.toString() ?? "",
                existente: savedOverrides.existente?.toString() ?? "",
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajustar Saúde do Pipeline</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Deixe vazio para usar o cálculo automático. Meta em milhares (ex: 2000 = R$ 2.000.000).</p>
                <div className="space-y-2">
                  <Label>Meta (override, em milhares)</Label>
                  <Input type="number" placeholder="Automático" value={pipelineOverrides.meta ?? ""} onChange={(e) => setPipelineOverrides((p) => ({ ...p, meta: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Conquistado (override, R$)</Label>
                  <Input type="number" placeholder="Automático" value={pipelineOverrides.conquistado ?? ""} onChange={(e) => setPipelineOverrides((p) => ({ ...p, conquistado: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Pipeline Existente (override, R$)</Label>
                  <Input type="number" placeholder="Automático" value={pipelineOverrides.existente ?? ""} onChange={(e) => setPipelineOverrides((p) => ({ ...p, existente: e.target.value }))} />
                </div>
                <Button onClick={savePipelineOverrides} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="text-xs text-muted-foreground">Meta (+)</div>
                <div className="text-2xl font-bold text-green-700">{formatBRL(pipeline.meta)}</div>
              </div>
              <div className="text-center text-muted-foreground text-lg">−</div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-xs text-muted-foreground">Conquistado (−)</div>
                <div className="text-2xl font-bold text-blue-700">{formatBRL(pipeline.conquistado)}</div>
              </div>
              <div className="text-center text-muted-foreground text-lg">=</div>
              <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                <div className="text-xs text-muted-foreground">A Realizar (=)</div>
                <div className="text-2xl font-bold text-orange-700">{formatBRL(pipeline.aRealizar)}</div>
              </div>
              <div className="text-center font-bold text-primary">× 3</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted border">
                  <div className="text-xs text-muted-foreground">Pipeline Necessário</div>
                  <div className="text-xl font-bold">{formatBRL(pipeline.pipelineNecessario)}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted border">
                  <div className="text-xs text-muted-foreground">Pipeline Existente</div>
                  <div className="text-xl font-bold">{formatBRL(pipeline.pipelineExistente)}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <GaugeSVG value={pipeline.saude} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ CORREÇÃO 3: Leads por Produto de Interesse (anchor_product) ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Leads por Produto de Interesse</CardTitle>
          <p className="text-xs text-muted-foreground">Top 10 por anchor_product · {productLeads.length.toLocaleString()} leads com produto</p>
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
