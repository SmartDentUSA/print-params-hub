import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addDealNote } from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getPiperunDealId(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  retries = 4,
  delayMs = 4000,
): Promise<number | null> {
  for (let i = 0; i < retries; i++) {
    const { data } = await supabase
      .from("lia_attendances")
      .select("piperun_id")
      .eq("id", leadId)
      .maybeSingle();

    if (data?.piperun_id) return Number(data.piperun_id);

    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { lead_id, form_name, responses } = await req.json();

    if (!lead_id || !responses?.length) {
      return json({ error: "lead_id and responses are required" }, 400);
    }

    const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY") || Deno.env.get("PIPERUN_API_TOKEN");
    if (!PIPERUN_API_KEY) {
      return json({ error: "PIPERUN_API_KEY not configured" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Wait for lia-assign to populate piperun_id (runs in parallel)
    const dealId = await getPiperunDealId(supabase, lead_id);

    if (!dealId) {
      console.warn(`[deal-form-note] No piperun_id found for lead ${lead_id} after retries`);
      return json({ ok: false, reason: "no_deal_id" });
    }

    // Format note as HTML for PipeRun
    const lines = responses.map(
      (r: { label: string; value: string }) => `• <b>${r.label}:</b> ${r.value}<br>`,
    );
    const noteText = `<b>📝 Respostas do Formulário: ${form_name || "Formulário"}</b><br><br>${lines.join("")}`;

    const result = await addDealNote(PIPERUN_API_KEY, dealId, noteText);

    console.log(`[deal-form-note] Note added to deal ${dealId} for lead ${lead_id}:`, result.success);

    return json({ ok: true, deal_id: dealId });
  } catch (err) {
    console.error("[deal-form-note] Error:", err);
    return json({ error: String(err) }, 500);
  }
});
