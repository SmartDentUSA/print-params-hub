import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface BowtieMetrics {
  mql: number;
  sql: number;
  vendas: number;
  csContratos: number;
  csOnboarding: number;
  csOngoing: number;
}

const GOALS = { mql: 100, sql: 40, vendas: 15, csContratos: 10, csOnboarding: 8, csOngoing: 5 };

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

export function SmartOpsBowtie() {
  const [metrics, setMetrics] = useState<BowtieMetrics>({ mql: 0, sql: 0, vendas: 0, csContratos: 0, csOnboarding: 0, csOngoing: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const [mqlRes, sqlRes, vendasRes, contratosRes, onboardingRes, ongoingRes] = await Promise.all([
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).eq("lead_status", "novo").gte("created_at", thirtyDaysAgo),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).not("resumo_historico_ia", "is", null).gte("created_at", thirtyDaysAgo),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).eq("status_atual_lead_crm", "Ganha").gte("created_at", thirtyDaysAgo),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).not("data_contrato", "is", null).gte("data_contrato", thirtyDaysAgo),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).eq("cs_treinamento", "concluido").or("ativo_scan.eq.true,ativo_notebook.eq.true,ativo_cad.eq.true,ativo_cad_ia.eq.true,ativo_smart_slice.eq.true,ativo_print.eq.true,ativo_cura.eq.true,ativo_insumos.eq.true"),
        supabase.from("lia_attendances").select("id", { count: "exact", head: true }).gte("data_ultima_compra_insumos", ninetyDaysAgo),
      ]);

      setMetrics({
        mql: mqlRes.count ?? 0,
        sql: sqlRes.count ?? 0,
        vendas: vendasRes.count ?? 0,
        csContratos: contratosRes.count ?? 0,
        csOnboarding: onboardingRes.count ?? 0,
        csOngoing: ongoingRes.count ?? 0,
      });
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando métricas...</div>;

  const { mql, sql, vendas, csContratos, csOnboarding, csOngoing } = metrics;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil Ampulheta (Bowtie)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {/* Acquisition (left - red) */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider">Aquisição</h3>
            {[
              { label: "MQL (Novos)", value: mql, goal: GOALS.mql },
              { label: "SQL (Qualificados IA)", value: sql, goal: GOALS.sql },
              { label: "Vendas (Ganha)", value: vendas, goal: GOALS.vendas },
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
            <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-xs font-bold">
              ⟷
            </div>
            <div className="w-0.5 h-16 bg-border" />
          </div>

          {/* Expansion (right - purple) */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Expansão</h3>
            {[
              { label: "CS-Contratos (Live)", value: csContratos, goal: GOALS.csContratos },
              { label: "CS-Onboarding (MRR)", value: csOnboarding, goal: GOALS.csOnboarding },
              { label: "CS-Ongoing (LTV)", value: csOngoing, goal: GOALS.csOngoing },
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

        {/* Conversion summary */}
        <div className="mt-6 p-3 bg-muted rounded-lg text-sm text-muted-foreground text-center">
          MQL → Venda: <strong>{conversionPct(mql, vendas)}</strong> &nbsp;|&nbsp;
          Venda → CS Live: <strong>{conversionPct(vendas, csContratos)}</strong> &nbsp;|&nbsp;
          CS Live → Ongoing: <strong>{conversionPct(csContratos, csOngoing)}</strong>
        </div>
      </CardContent>
    </Card>
  );
}
