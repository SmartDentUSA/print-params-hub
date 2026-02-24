import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");

    if (!PIPERUN_API_KEY) {
      return new Response(JSON.stringify({ error: "PIPERUN_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Sync deals updated in the last 35 minutes (overlap for safety)
    const since = new Date(Date.now() - 35 * 60 * 1000).toISOString();

    const piperunRes = await fetch(
      `https://api.pipe.run/v1/deals?updated_since=${encodeURIComponent(since)}&show=100`,
      { headers: { "Token": PIPERUN_API_KEY } }
    );

    if (!piperunRes.ok) {
      const errText = await piperunRes.text();
      console.error("[sync-piperun] API error:", piperunRes.status, errText.slice(0, 300));
      return new Response(JSON.stringify({ error: `Piperun API ${piperunRes.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const piperunData = await piperunRes.json();
    const deals = piperunData?.data || [];
    let updated = 0;

    for (const deal of deals) {
      const dealId = String(deal.id);
      const ownerName = deal.owner?.name || null;
      const stageName = deal.stage?.name || null;

      const updatePayload: Record<string, unknown> = {};
      if (ownerName) updatePayload.proprietario_lead_crm = ownerName;
      if (stageName) updatePayload.status_atual_lead_crm = stageName;

      if (Object.keys(updatePayload).length === 0) continue;

      const { error } = await supabase
        .from("lia_attendances")
        .update(updatePayload)
        .eq("piperun_id", dealId);

      if (!error) updated++;
    }

    console.log(`[sync-piperun] Sincronizados: ${updated}/${deals.length}`);
    return new Response(JSON.stringify({ success: true, synced: updated, total_deals: deals.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sync-piperun] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
