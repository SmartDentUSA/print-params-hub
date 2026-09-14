// Corrige o responsável de deals abertos em VENDAS originados de formulários
// de Feiras e Eventos: o consultor escolhido no estande passa a ser o dono.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { addDealNote, updateDealOwner } from "../_shared/piperun-field-map.ts";

const PIPELINE_VENDAS = 18784;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");
  if (!PIPERUN_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing PIPERUN_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let days = 7;
  let leadIds: string[] | null = null;
  try {
    const body = await req.json();
    if (body?.days) days = Number(body.days);
    if (Array.isArray(body?.lead_ids) && body.lead_ids.length > 0) leadIds = body.lead_ids as string[];
  } catch { /* sem body → padrão */ }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let leadQuery = supabase
    .from("lia_attendances")
    .select("id, nome, event_consultant_team_member_id, proprietario_lead_crm")
    .not("event_consultant_team_member_id", "is", null)
    .is("merged_into", null);
  if (leadIds) leadQuery = leadQuery.in("id", leadIds);
  else leadQuery = leadQuery.gte("created_at", since);

  const { data: leads, error: leadErr } = await leadQuery;
  if (leadErr) {
    return new Response(JSON.stringify({ error: "leads query failed", details: leadErr }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const lead of leads ?? []) {
    const { data: consultant } = await supabase
      .from("team_members")
      .select("id, nome_completo, piperun_owner_id, ativo")
      .eq("id", lead.event_consultant_team_member_id as string)
      .maybeSingle();
    const ownerId = Number(consultant?.piperun_owner_id);
    if (!consultant?.ativo || !Number.isFinite(ownerId) || ownerId <= 0) {
      results.push({ lead_id: lead.id, skipped: "consultor_inativo_ou_sem_piperun_id" });
      continue;
    }

    const { data: deals } = await supabase
      .from("deals")
      .select("id, piperun_deal_id, owner_name, owner_id, stage_name")
      .eq("lead_id", lead.id as string)
      .eq("pipeline_id", PIPELINE_VENDAS)
      .eq("status", "aberta");

    for (const deal of deals ?? []) {
      if (String(deal.owner_name ?? "").trim() === String(consultant.nome_completo).trim()) {
        results.push({ deal_id: deal.piperun_deal_id, skipped: "owner_ja_correto" });
        continue;
      }
      const piperunDealId = Number(deal.piperun_deal_id);
      const putRes = await updateDealOwner(PIPERUN_API_KEY, piperunDealId, ownerId, {});
      if (!putRes.success) {
        results.push({ deal_id: piperunDealId, ok: false, error: putRes.data, status: putRes.status });
        continue;
      }

      try {
        await addDealNote(
          PIPERUN_API_KEY,
          piperunDealId,
          `Responsável corrigido para o consultor escolhido no estande: ${consultant.nome_completo}.`,
        );
      } catch { /* nota nunca derruba a correção */ }

      await supabase
        .from("deals")
        .update({ owner_id: ownerId, owner_name: consultant.nome_completo })
        .eq("id", deal.id as string);

      await supabase
        .from("lia_attendances")
        .update({ proprietario_lead_crm: consultant.nome_completo })
        .eq("id", lead.id as string);

      try {
        await supabase.from("lead_activity_log").insert({
          lead_id: lead.id,
          event_type: "deal_owner_corrigido_consultor_evento",
          entity_type: "deal",
          entity_id: String(piperunDealId),
          entity_name: `Responsável ajustado para ${consultant.nome_completo}`,
          event_data: {
            from: deal.owner_name ?? null,
            to: consultant.nome_completo,
            to_piperun_id: ownerId,
          },
          source_channel: "form",
          event_timestamp: new Date().toISOString(),
        });
      } catch { /* log opcional */ }

      results.push({
        deal_id: piperunDealId,
        ok: true,
        from: deal.owner_name ?? null,
        to: consultant.nome_completo,
      });
    }
  }

  return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
