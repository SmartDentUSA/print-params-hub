import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let hasMore = true;
  let batchNum = 0;

  while (hasMore) {
    batchNum++;

    // Fetch leads that have deals history but ltv_total is NULL or 0
    const { data: leads, error } = await supabase
      .from("lia_attendances")
      .select("id, piperun_deals_history")
      .not("piperun_deals_history", "eq", "[]")
      .not("piperun_deals_history", "is", null)
      .or("ltv_total.is.null,ltv_total.eq.0")
      .limit(BATCH_SIZE);

    if (error) {
      console.error(`[backfill-ltv] Query error batch ${batchNum}:`, error.message);
      hasMore = false;
      break;
    }

    if (!leads || leads.length === 0) {
      hasMore = false;
      break;
    }

    for (const lead of leads) {
      try {
        const history = lead.piperun_deals_history as any[];
        if (!Array.isArray(history) || history.length === 0) continue;

        // The trigger will auto-calculate ltv_total, total_deals, anchor_product
        // We just need to "touch" piperun_deals_history to fire the trigger
        const { error: updateError } = await supabase
          .from("lia_attendances")
          .update({ piperun_deals_history: history })
          .eq("id", lead.id);

        if (updateError) {
          console.error(`[backfill-ltv] Update error lead ${lead.id}:`, updateError.message);
          totalErrors++;
        } else {
          totalUpdated++;
        }
      } catch (e) {
        totalErrors++;
      }
      totalProcessed++;
    }

    console.log(`[backfill-ltv] Batch ${batchNum}: processed=${leads.length}, updated=${totalUpdated}, errors=${totalErrors}`);

    if (leads.length < BATCH_SIZE) hasMore = false;

    // Pause between batches to avoid overloading
    await new Promise((r) => setTimeout(r, 300));
  }

  return new Response(
    JSON.stringify({
      success: true,
      total_processed: totalProcessed,
      total_updated: totalUpdated,
      total_errors: totalErrors,
      batches: batchNum,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
