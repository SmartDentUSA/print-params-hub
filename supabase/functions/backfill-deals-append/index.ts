import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { lead_id, append_deals } = await req.json();

  if (!lead_id || !Array.isArray(append_deals) || append_deals.length === 0) {
    return new Response(JSON.stringify({ error: "lead_id and append_deals[] required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch current history
  const { data: lead, error: fetchErr } = await supabase
    .from("lia_attendances")
    .select("id, piperun_deals_history, ltv_total, total_deals")
    .eq("id", lead_id)
    .maybeSingle();

  if (fetchErr || !lead) {
    return new Response(JSON.stringify({ error: "Lead not found", detail: fetchErr?.message }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const history = Array.isArray(lead.piperun_deals_history) ? [...lead.piperun_deals_history] : [];
  const existingIds = new Set(history.map((d: any) => String(d.deal_id || d.deal_hash)));

  let added = 0;
  for (const deal of append_deals) {
    const id = String(deal.deal_id || deal.deal_hash);
    if (!existingIds.has(id)) {
      history.push(deal);
      existingIds.add(id);
      added++;
    }
  }

  // Recalculate LTV from all won deals
  const WON = ["ganha", "won", "Ganha"];
  const wonDeals = history.filter((d: any) => WON.includes(d.status || d.situacao || ""));
  const ltv = wonDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);

  const { error: updateErr } = await supabase
    .from("lia_attendances")
    .update({
      piperun_deals_history: history,
      ltv_total: ltv,
      total_deals: wonDeals.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead_id);

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    lead_id,
    deals_added: added,
    total_deals_history: history.length,
    won_deals: wonDeals.length,
    ltv_total: ltv,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
