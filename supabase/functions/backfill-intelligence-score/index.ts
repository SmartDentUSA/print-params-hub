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

  let batchNumber = 0;
  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalErrors = 0;
  let hasMore = true;

  while (hasMore) {
    batchNumber++;
    const batchStart = new Date().toISOString();

    const { data: leads, error } = await supabase
      .from("lia_attendances")
      .select("id")
      .is("intelligence_score", null)
      .order("updated_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (error || !leads || leads.length === 0) {
      hasMore = false;
      break;
    }

    let batchSuccess = 0;
    let batchErrors = 0;

    for (const lead of leads) {
      try {
        const { error: rpcError } = await supabase.rpc("calculate_lead_intelligence_score", {
          p_lead_id: lead.id,
        });
        if (rpcError) throw rpcError;
        batchSuccess++;
      } catch {
        batchErrors++;
      }
    }

    totalProcessed += leads.length;
    totalSuccess += batchSuccess;
    totalErrors += batchErrors;

    await supabase.from("backfill_log").insert({
      batch_number: batchNumber,
      processed_count: leads.length,
      success_count: batchSuccess,
      error_count: batchErrors,
      started_at: batchStart,
      finished_at: new Date().toISOString(),
    });

    console.log(`[backfill] Batch ${batchNumber}: ${batchSuccess} ok, ${batchErrors} errors`);

    if (leads.length < BATCH_SIZE) hasMore = false;

    // Pause between batches
    await new Promise((r) => setTimeout(r, 500));
  }

  // Mark backfilled leads
  await supabase
    .from("lia_attendances")
    .update({ intelligence_score_backfilled_at: new Date().toISOString() })
    .not("intelligence_score", "is", null)
    .is("intelligence_score_backfilled_at", null);

  return new Response(
    JSON.stringify({
      batches: batchNumber,
      total_processed: totalProcessed,
      total_success: totalSuccess,
      total_errors: totalErrors,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
