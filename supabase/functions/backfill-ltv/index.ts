import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let totalUpdated = 0;
  let totalErrors = 0;
  let batchNum = 0;
  let hasMore = true;

  while (hasMore) {
    batchNum++;

    // Fetch batch of leads needing backfill
    const { data: leads, error } = await supabase
      .from("lia_attendances")
      .select("id, piperun_deals_history")
      .not("piperun_deals_history", "eq", "[]")
      .not("piperun_deals_history", "is", null)
      .or("ltv_total.is.null,ltv_total.eq.0")
      .limit(BATCH_SIZE);

    if (error || !leads || leads.length === 0) {
      hasMore = false;
      break;
    }

    // Process batch: calculate in JS, update in parallel chunks
    const updates: Promise<void>[] = [];

    for (const lead of leads) {
      const history = lead.piperun_deals_history as any[];
      if (!Array.isArray(history) || history.length === 0) continue;

      let ltv = 0;
      const productCounts: Record<string, { count: number; maxValue: number }> = {};

      for (const deal of history) {
        const val = parseFloat(deal?.value) || 0;
        ltv += val;
        const product = deal?.product;
        if (product && typeof product === "string" && product.trim()) {
          if (!productCounts[product]) productCounts[product] = { count: 0, maxValue: 0 };
          productCounts[product].count++;
          if (val > productCounts[product].maxValue) productCounts[product].maxValue = val;
        }
      }

      let anchor: string | null = null;
      let maxCount = 0;
      let maxValue = 0;
      for (const [prod, stats] of Object.entries(productCounts)) {
        if (stats.count > maxCount || (stats.count === maxCount && stats.maxValue > maxValue)) {
          anchor = prod;
          maxCount = stats.count;
          maxValue = stats.maxValue;
        }
      }

      updates.push(
        supabase
          .from("lia_attendances")
          .update({
            ltv_total: ltv,
            total_deals: history.length,
            anchor_product: anchor,
          })
          .eq("id", lead.id)
          .then(({ error: e }) => {
            if (e) totalErrors++;
            else totalUpdated++;
          })
      );
    }

    // Execute all updates in parallel
    await Promise.all(updates);

    console.log(`[backfill-ltv] Batch ${batchNum}: ${leads.length} leads, updated=${totalUpdated}, errors=${totalErrors}`);

    if (leads.length < BATCH_SIZE) hasMore = false;
    await new Promise((r) => setTimeout(r, 100));
  }

  return new Response(
    JSON.stringify({
      success: true,
      total_updated: totalUpdated,
      total_errors: totalErrors,
      batches: batchNum,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
