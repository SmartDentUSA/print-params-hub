import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

type DriftResult = {
  brain_receita: number;
  live_receita: number;
  brain_deals: number;
  live_deals: number;
  diff_pct: number;
  last_refresh: string;
  age_minutes: number;
};

function fmtBRL(v: number) {
  return (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Mostra o estado do Cérebro do Copilot (snapshot vs CRM ao vivo)
 * e expõe um botão para forçar refresh imediato. Aparece no topo
 * do Relatório Mensal e onde mais for útil.
 */
export default function CopilotBrainHealthCard() {
  const [data, setData] = useState<DriftResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("check_copilot_brain_drift" as any);
    if (!error && data) setData(data as DriftResult);
    setLoading(false);
  }, []);

  const forceRefresh = useCallback(async () => {
    setRefreshing(true);
    await supabase.rpc("refresh_copilot_brain" as any, { p_force: true });
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const stale = data ? data.diff_pct > 5 || data.age_minutes > 30 : false;
  const tone = stale
    ? { bg: "#3a1d1d", border: "#7a3a3a", text: "#ff9b9b" }
    : { bg: "#1d3a2a", border: "#3a7a55", text: "#9bffc4" };

  return (
    <div
      style={{
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 8,
        padding: 14,
        margin: "16px 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        color: tone.text,
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {stale ? (
          <AlertTriangle className="w-5 h-5" />
        ) : (
          <CheckCircle2 className="w-5 h-5" />
        )}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {stale
              ? "Cérebro do Copilot defasado vs CRM"
              : "Cérebro do Copilot sincronizado"}
          </div>
          <div style={{ opacity: 0.85, fontSize: 12 }}>
            {loading
              ? "Verificando..."
              : data
              ? `Cérebro: ${fmtBRL(data.brain_receita)} · ${data.brain_deals} ganhos | CRM ao vivo: ${fmtBRL(data.live_receita)} · ${data.live_deals} ganhos | diff ${data.diff_pct}% · há ${Math.round(data.age_minutes)} min`
              : "Sem dados"}
          </div>
        </div>
      </div>
      <button
        onClick={forceRefresh}
        disabled={refreshing}
        style={{
          background: "rgba(255,255,255,0.08)",
          border: `1px solid ${tone.border}`,
          borderRadius: 6,
          color: tone.text,
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: refreshing ? "wait" : "pointer",
        }}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Atualizando..." : "Atualizar Cérebro"}
      </button>
    </div>
  );
}