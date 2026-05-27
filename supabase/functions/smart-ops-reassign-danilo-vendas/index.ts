// One-off: reatribuir 8 deals abertos do Danilo Pereira no Funil de Vendas (pipeline 18784)
// para vendedores ativos via Round Robin e mover stage para "Sem contato" (379940).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { piperunPut, addDealNote } from "../_shared/piperun-field-map.ts";

const PIPELINE_VENDAS = 18784;
const STAGE_SEM_CONTATO = 379940;
const INACTIVE_OWNER_NAME = "Danilo Pereira";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");
  if (!PIPERUN_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing PIPERUN_API_KEY" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Vendedores ativos
  const { data: vendedores, error: tmErr } = await supabase
    .from("team_members")
    .select("id, nome_completo, piperun_owner_id")
    .eq("ativo", true)
    .eq("role", "vendedor")
    .not("piperun_owner_id", "is", null);

  const activeVendedores = (vendedores ?? []).filter((v: any) => {
    const n = Number(v.piperun_owner_id);
    return Number.isFinite(n) && n > 0;
  });

  if (tmErr || activeVendedores.length === 0) {
    return new Response(JSON.stringify({ error: "no active vendedores", details: tmErr }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Deals alvo
  const { data: deals, error: dErr } = await supabase
    .from("deals")
    .select("id, piperun_deal_id, lead_id, stage_name, owner_name")
    .eq("pipeline_id", PIPELINE_VENDAS)
    .eq("status", "aberta")
    .ilike("owner_name", `%${INACTIVE_OWNER_NAME}%`);

  if (dErr) {
    return new Response(JSON.stringify({ error: "deals query failed", details: dErr }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  let idx = Math.floor(Math.random() * activeVendedores.length);

  for (const deal of deals ?? []) {
    const newOwner = activeVendedores[idx % activeVendedores.length];
    idx++;
    const newOwnerId = Number(newOwner.piperun_owner_id);
    const piperunDealId = Number((deal as any).piperun_deal_id);
    const previousStage = (deal as any).stage_name as string | null;

    // 2a. PipeRun PUT
    const putRes = await piperunPut(PIPERUN_API_KEY, `deals/${piperunDealId}`, {
      user_id: newOwnerId,
      stage_id: STAGE_SEM_CONTATO,
    });

    if (!putRes.success) {
      results.push({ deal_id: piperunDealId, ok: false, error: putRes.data, status: putRes.status });
      continue;
    }

    // 2b. Note no deal
    try {
      await addDealNote(
        PIPERUN_API_KEY,
        piperunDealId,
        `Reatribuição automática: vendedor anterior (${INACTIVE_OWNER_NAME}) inativo. Novo responsável: ${newOwner.nome_completo}. Card movido para "Sem contato" para retomada do contato inicial.`
      );
    } catch (e) {
      console.warn(`[reassign-danilo] note failed for ${piperunDealId}:`, e);
    }

    // 2c. UPDATE local deals
    await supabase
      .from("deals")
      .update({
        owner_id: newOwnerId,
        owner_name: newOwner.nome_completo,
        stage_id: STAGE_SEM_CONTATO,
        stage_name: "Sem contato",
        last_stage_updated_at: new Date().toISOString(),
      })
      .eq("id", (deal as any).id);

    // 2d. UPDATE lia_attendances (apenas se ainda associado ao Danilo)
    if ((deal as any).lead_id) {
      await supabase
        .from("lia_attendances")
        .update({ proprietario_lead_crm: newOwner.nome_completo })
        .eq("id", (deal as any).lead_id)
        .or(`proprietario_lead_crm.ilike.%${INACTIVE_OWNER_NAME}%,proprietario_lead_crm.eq.102595`);
    }

    // 2e. Activity log
    try {
      await supabase.from("lead_activity_log").insert({
        lead_id: (deal as any).lead_id,
        event_type: "deal_reassigned_inactive_seller",
        payload: {
          from: INACTIVE_OWNER_NAME,
          to: newOwner.nome_completo,
          to_piperun_id: newOwnerId,
          piperun_deal_id: piperunDealId,
          previous_stage: previousStage,
          new_stage: "Sem contato",
          reason: "vendedor_saiu_empresa",
        },
      });
    } catch {}

    results.push({
      deal_id: piperunDealId,
      ok: true,
      to: newOwner.nome_completo,
      previous_stage: previousStage,
    });
  }

  // 3. Resumo em system_health_logs
  try {
    await supabase.from("system_health_logs").insert({
      error_type: "reassign_danilo_vendas",
      error_message: `Reatribuídos ${results.filter((r) => r.ok).length}/${results.length} deals`,
      payload: { results, active_vendedores: activeVendedores.map((v: any) => v.nome_completo) },
    });
  } catch {}

  return new Response(
    JSON.stringify({ success: true, processed: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});