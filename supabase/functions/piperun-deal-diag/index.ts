import { piperunGet, piperunPut } from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const KEY = Deno.env.get("PIPERUN_API_KEY")!;
  const url = new URL(req.url);
  const dealId = url.searchParams.get("deal_id") || "59699720";
  const action = url.searchParams.get("action") || "read";
  const out: Record<string, unknown> = {};

  if (action === "test_put") {
    // Test 4 different payload shapes to find what PipeRun actually persists
    const shapes: Array<{ name: string; body: Record<string, unknown> }> = [
      {
        name: "A_flat_hash",
        body: { f7dc3e9b085802a19fcd444e46e69637: "+5581996391671_A" },
      },
      {
        name: "B_array_objects",
        body: { custom_fields: [{ custom_field_id: 549150, value: "+5581996391671_B" }] },
      },
      {
        name: "C_hash_object",
        body: { custom_fields: { f7dc3e9b085802a19fcd444e46e69637: "+5581996391671_C" } },
      },
      {
        name: "D_id_keyed",
        body: { custom_fields: { "549150": "+5581996391671_D" } },
      },
    ];
    for (const s of shapes) {
      const r = await piperunPut(KEY, `deals/${dealId}`, s.body);
      // Read back
      await new Promise((r) => setTimeout(r, 800));
      const after = await piperunGet(KEY, `deals/${dealId}`, {}, { "with[]": ["customFields"] });
      const data = (after.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      const fields = (data?.customFields as Array<Record<string, unknown>> | undefined) || [];
      const wa = fields.find((f) => Number(f.id) === 549150);
      out[s.name] = {
        put_status: r.status,
        put_success: r.success,
        put_response_excerpt: JSON.stringify(r.data).slice(0, 400),
        whatsapp_after: wa?.value ?? "(missing)",
      };
    }
    return new Response(JSON.stringify(out, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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