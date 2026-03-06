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
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    const batchSize = Math.min(Number(url.searchParams.get("batch_size") || 20), 50);

    // Find leads eligible for cognitive analysis:
    // - Has 5+ messages (enough data for analysis)
    // - Never analyzed OR analyzed before last session
    const { data: eligibleLeads, error: queryError } = await supabase
      .from("lia_attendances")
      .select("id, nome, total_messages, cognitive_analyzed_at, ultima_sessao_at")
      .gte("total_messages", 5)
      .or("cognitive_analyzed_at.is.null,cognitive_analyzed_at.lt.ultima_sessao_at")
      .order("intelligence_score_total", { ascending: false, nullsFirst: false })
      .order("total_messages", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(batchSize);

    if (queryError) {
      console.error("[batch-cognitive] Query error:", queryError.message);
      return new Response(JSON.stringify({ error: queryError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!eligibleLeads || eligibleLeads.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, message: "No eligible leads for cognitive analysis", processed: 0 
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[batch-cognitive] Found ${eligibleLeads.length} eligible leads`);

    let processed = 0;
    let errors = 0;
    const results: Array<{ id: string; nome: string; status: string }> = [];

    for (const lead of eligibleLeads) {
      try {
        const fnUrl = `${SUPABASE_URL}/functions/v1/cognitive-lead-analysis`;
        const res = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ lead_id: lead.id }),
        });

        if (res.ok) {
          processed++;
          results.push({ id: lead.id, nome: lead.nome, status: "ok" });

          // Mark cognitive_analyzed_at
          await supabase
            .from("lia_attendances")
            .update({ cognitive_analyzed_at: new Date().toISOString() })
            .eq("id", lead.id);
        } else {
          const errText = await res.text();
          errors++;
          results.push({ id: lead.id, nome: lead.nome, status: `error: ${errText.slice(0, 100)}` });
          console.error(`[batch-cognitive] Lead ${lead.id} error:`, errText.slice(0, 200));
        }

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        errors++;
        results.push({ id: lead.id, nome: lead.nome, status: `exception: ${String(e).slice(0, 100)}` });
      }
    }

    const summary = {
      success: true,
      eligible: eligibleLeads.length,
      processed,
      errors,
      results,
    };

    console.log(`[batch-cognitive] Done: processed=${processed}, errors=${errors}`);

    return new Response(JSON.stringify(summary), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[batch-cognitive] Fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
