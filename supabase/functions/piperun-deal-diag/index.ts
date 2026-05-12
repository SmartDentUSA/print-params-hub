import { piperunGet } from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const KEY = Deno.env.get("PIPERUN_API_KEY")!;
  const url = new URL(req.url);
  const dealId = url.searchParams.get("deal_id") || "59699720";
  const out: Record<string, unknown> = {};

  // Try several `with[]` combos to discover the right way to expand custom_fields
  const combos: Array<Record<string, string[]>> = [
    { "with[]": ["person", "company", "origin", "stage", "customFields"] },
    { "with[]": ["person", "company", "origin", "stage", "custom_fields"] },
    { "with[]": ["person", "company", "origin", "stage", "dealCustomFields"] },
    {},
  ];
  for (let i = 0; i < combos.length; i++) {
    const r = await piperunGet(KEY, `deals/${dealId}`, {}, combos[i]);
    out[`combo_${i}_keys`] = combos[i];
    out[`combo_${i}_status`] = r.status;
    const data = (r.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    if (data) {
      out[`combo_${i}_top_keys`] = Object.keys(data);
      out[`combo_${i}_custom_fields`] = data.custom_fields ?? null;
      out[`combo_${i}_customFields`] = data.customFields ?? null;
      out[`combo_${i}_fields`] = data.fields ?? null;
    }
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});