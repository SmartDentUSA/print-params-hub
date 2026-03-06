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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fix legacy PipeRun links in batches
    let totalFixed = 0;
    let batch = 0;

    while (true) {
      batch++;
      const { data: leads, error } = await supabase
        .from("lia_attendances")
        .select("id, piperun_id, piperun_link")
        .like("piperun_link", "%/pipeline/gerenciador/visualizar/%")
        .not("piperun_id", "is", null)
        .limit(500);

      if (error) throw error;
      if (!leads || leads.length === 0) break;

      for (const lead of leads) {
        const newLink = `https://app.pipe.run/#/deals/${lead.piperun_id}`;
        await supabase
          .from("lia_attendances")
          .update({ piperun_link: newLink })
          .eq("id", lead.id);
      }

      totalFixed += leads.length;
      console.log(`[fix-piperun-links] Batch ${batch}: fixed ${leads.length} (total: ${totalFixed})`);
    }

    return new Response(JSON.stringify({ success: true, total_fixed: totalFixed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[fix-piperun-links] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
