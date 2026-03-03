import {
  ETAPA_TO_STAGE,
  piperunPut,
} from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");
    if (!PIPERUN_API_KEY) {
      return new Response(JSON.stringify({ error: "PIPERUN_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { piperun_id, new_status } = await req.json();

    if (!piperun_id || !new_status) {
      return new Response(JSON.stringify({ error: "piperun_id and new_status required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mapping = ETAPA_TO_STAGE[new_status];
    if (!mapping) {
      return new Response(JSON.stringify({
        success: false,
        error: `No PipeRun stage mapping for status: ${new_status}`,
        skipped: true,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dealId = Number(piperun_id);
    const result = await piperunPut(PIPERUN_API_KEY, `deals/${dealId}`, {
      stage_id: mapping.stage_id,
      pipeline_id: mapping.pipeline_id,
    });

    console.log(`[kanban-move] Deal ${dealId} → stage ${mapping.stage_id} (${new_status}): ${result.success}`);

    return new Response(JSON.stringify({
      success: result.success,
      deal_id: dealId,
      stage_id: mapping.stage_id,
      pipeline_id: mapping.pipeline_id,
      new_status,
      piperun_response: result.data,
    }), {
      status: result.success ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[kanban-move] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
