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
    // Optionally list all custom fields
    if (url.searchParams.get("list") === "1") {
      const all: Array<Record<string, unknown>> = [];
      for (let page = 1; page <= 5; page++) {
        const r = await piperunGet(KEY, "customFields", { show: 200, page });
        const items = ((r.data as any)?.data as Array<Record<string, unknown>>) || [];
        all.push(...items);
        if (items.length < 200) break;
      }
      return new Response(JSON.stringify({
        total: all.length,
        deal_fields: all.filter((f) => f.belongs === 1).map((f) => ({ id: f.id, name: f.name, hash: f.hash, type: f.type })),
      }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Test multiple payload shapes against the EXISTING field "Tem scanner" (549242)
    const FIELD_ID = 549242;
    const FIELD_HASH = "cd2c1cc55889d78f63ed0ff639e6ecbb";
    const shapes: Array<{ name: string; body: Record<string, unknown> }> = [
      { name: "E_flat_hash_only", body: { [FIELD_HASH]: "TEST_E" } },
      { name: "F_array_value", body: { custom_fields: [{ custom_field_id: FIELD_ID, value: "TEST_F" }] } },
      { name: "G_array_values", body: { custom_fields: [{ custom_field_id: FIELD_ID, values: "TEST_G" }] } },
      { name: "H_array_id", body: { custom_fields: [{ id: FIELD_ID, value: "TEST_H" }] } },
      { name: "I_array_hash_value", body: { custom_fields: [{ hash: FIELD_HASH, value: "TEST_I" }] } },
      { name: "J_array_field_value", body: { custom_fields: [{ field_id: FIELD_ID, value: "TEST_J" }] } },
    ];
    for (const s of shapes) {
      const r = await piperunPut(KEY, `deals/${dealId}`, s.body);
      // Read back
      await new Promise((r) => setTimeout(r, 600));
      const after = await piperunGet(KEY, `deals/${dealId}`, {}, { "with[]": ["customFields"] });
      const data = (after.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      const fields = (data?.customFields as Array<Record<string, unknown>> | undefined) || [];
      const probe = fields.find((f) => Number(f.id) === FIELD_ID);
      out[s.name] = {
        put_status: r.status,
        put_success: r.success,
        put_response_excerpt: JSON.stringify(r.data).slice(0, 600),
        scanner_after: probe?.value ?? "(missing)",
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