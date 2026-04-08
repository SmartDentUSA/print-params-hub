import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapping stage_name → funnel band
const STAGE_BANDS: Record<string, string> = {
  // em_processo (< 60)
  "Sem contato": "em_processo",
  "Sem Contato": "em_processo",
  "Contato Inicial": "em_processo",
  "Contato Feito": "em_processo",
  "Distribuidor de leads": "em_processo",
  "Etapa 00 - Novos": "em_processo",
  "Etapa 01 - Reativação": "em_processo",
  "Etapa 02 - Reativação": "em_processo",
  "Etapa 03 - Reativção": "em_processo",
  "Etapa 04 - Reativação": "em_processo",
  "Ebook Message Helper": "em_processo",
  "ioConnect": "em_processo",
  // boas_chances (60-80)
  "Em Contato": "boas_chances",
  "Apresentação/Visita": "boas_chances",
  "Apresentação/Visita - Estag": "boas_chances",
  "Astron Testes": "boas_chances",
  "Distirbuidor - Fresadora": "boas_chances",
  // comprometido (90)
  "Negociação": "comprometido",
  "Proposta enviada": "comprometido",
  "Proposta Enviada - Estag": "comprometido",
  "Fechamento": "comprometido",
  "Fechamento - Estag": "comprometido",
  // conquistado (100)
  "Etapa 1": "conquistado",
  "Em espera": "conquistado",
  "Treinamento Agendado": "conquistado",
  "Equipamentos Entregues": "conquistado",
  "Pedir Faturamento": "conquistado",
};

function classifyStage(stageName: string): string {
  return STAGE_BANDS[stageName] || "em_processo";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch all non-deleted deals with stage_name and value
    const allDeals: Array<{ stage_name: string; value: number; status: string; piperun_created_at: string }> = [];
    let offset = 0;
    const BATCH = 1000;
    while (true) {
      const { data, error } = await sb
        .from("deals")
        .select("stage_name, value, status, piperun_created_at")
        .or("is_deleted.is.null,is_deleted.eq.false")
        .not("stage_name", "is", null)
        .range(offset, offset + BATCH - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allDeals.push(...data);
      if (data.length < BATCH) break;
      offset += BATCH;
    }

    const now = new Date();
    const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const bands = ["em_processo", "boas_chances", "comprometido", "conquistado"];
    const bandConfig: Record<string, { label: string; display: string }> = {
      em_processo: { label: "Em Processo", display: "< 60" },
      boas_chances: { label: "Boas Chances", display: "60-80" },
      comprometido: { label: "Comprometido", display: "90" },
      conquistado: { label: "Conquistado", display: "100" },
    };

    const result: Record<string, {
      mes_anterior: { count: number; value: number };
      mes_atual: { count: number; value: number };
      pipeline_atual: { count: number; value: number };
    }> = {};

    for (const b of bands) {
      result[b] = {
        mes_anterior: { count: 0, value: 0 },
        mes_atual: { count: 0, value: 0 },
        pipeline_atual: { count: 0, value: 0 },
      };
    }

    for (const deal of allDeals) {
      const band = classifyStage(deal.stage_name);
      const val = deal.value || 0;
      const created = deal.piperun_created_at ? new Date(deal.piperun_created_at) : null;

      // Pipeline atual = all open deals (status = 'aberta')
      if (deal.status === "aberta") {
        result[band].pipeline_atual.count++;
        result[band].pipeline_atual.value += val;
      }

      // Mês atual
      if (created && created >= curMonthStart) {
        result[band].mes_atual.count++;
        result[band].mes_atual.value += val;
      }

      // Mês anterior
      if (created && created >= prevMonthStart && created < curMonthStart) {
        result[band].mes_anterior.count++;
        result[band].mes_anterior.value += val;
      }
    }

    const funil = bands.map((key) => ({
      key,
      label: bandConfig[key].label,
      display: bandConfig[key].display,
      mes_anterior: result[key].mes_anterior,
      mes_atual: result[key].mes_atual,
      pipeline_atual: result[key].pipeline_atual,
    }));

    const summary = {
      colunas: {
        col1: "Mês Anterior",
        col2: "Mês Atual",
        col3: "Pipeline Atual",
      },
      total_pipeline_atual_value: bands.reduce((s, b) => s + result[b].pipeline_atual.value, 0),
      total_mes_atual_value: bands.reduce((s, b) => s + result[b].mes_atual.value, 0),
      total_mes_anterior_value: bands.reduce((s, b) => s + result[b].mes_anterior.value, 0),
    };

    return new Response(JSON.stringify({ funil, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
