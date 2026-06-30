// Generic on-demand translator for KB card rows.
// Translates whitelisted PT fields → EN/ES, persists into <field>_<lang> columns.
// Idempotent: skips fields that already have a non-null translation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Whitelist of tables → translatable fields (with type hint).
// type: "text" | "jsonb_kv" (array of {label,value})
type FieldKind = "text" | "jsonb_kv";
type FieldDef = { name: string; kind: FieldKind };
const TABLES: Record<string, FieldDef[]> = {
  system_a_catalog: [
    { name: "name", kind: "text" },
    { name: "description", kind: "text" },
    { name: "product_category", kind: "text" },
    { name: "product_subcategory", kind: "text" },
    { name: "cta_1_label", kind: "text" },
    { name: "cta_1_description", kind: "text" },
    { name: "cta_2_label", kind: "text" },
    { name: "technical_specs", kind: "jsonb_kv" },
  ],
  resins: [
    { name: "name", kind: "text" },
    { name: "description", kind: "text" },
    { name: "processing_instructions", kind: "text" },
    { name: "cta_1_label", kind: "text" },
    { name: "cta_2_label", kind: "text" },
    { name: "cta_3_label", kind: "text" },
    { name: "cta_4_label", kind: "text" },
    { name: "technical_specs", kind: "jsonb_kv" },
  ],
  products_catalog: [
    { name: "technical_specifications", kind: "jsonb_kv" },
  ],
  knowledge_videos: [
    { name: "title", kind: "text" },
    { name: "description", kind: "text" },
  ],
  distributors: [
    { name: "name", kind: "text" },
    { name: "description", kind: "text" },
    { name: "region", kind: "text" },
    { name: "specialty", kind: "text" },
  ],
  smartops_events: [
    { name: "title", kind: "text" },
    { name: "description", kind: "text" },
    { name: "location", kind: "text" },
  ],
  knowledge_categories: [
    { name: "name", kind: "text" },
    { name: "description", kind: "text" },
  ],
};

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const LANG_NAMES: Record<string, string> = {
  en: "English (United States)",
  es: "Spanish (Español)",
};

async function callTranslator(payload: Record<string, unknown>, target: string): Promise<Record<string, unknown> | null> {
  const system = `You are a professional translator. Translate Portuguese → ${LANG_NAMES[target]}.
RULES:
- Preserve proper nouns, brand names, product codes, URLs, emails, numbers and units exactly.
- Keep the same JSON shape and keys; only translate the string values.
- For arrays of {label, value}, translate both label and value but keep numbers/units intact.
- Do not add explanations. Return ONLY a JSON object with the same keys as the input.`;

  const { aiComplete } = await import("../_shared/ai-router.ts");
  const r = await aiComplete({
    task: "content_seo",
    functionName: "translate-card-row",
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Translate the values in this JSON to ${LANG_NAMES[target]}:\n${JSON.stringify(payload)}` },
    ],
    temperature: 0.2,
    maxTokens: 4000,
    responseFormat: { type: "json_object" },
  });
  if (!r.ok) {
    console.error("[translate-card-row] ai-router error", r.error_code, r.error);
    return null;
  }
  const text = r.text || "";
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = String(text).replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    try { return JSON.parse(cleaned); } catch { return null; }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const table = String(body?.table || "");
    const id = String(body?.id || "");
    const target = String(body?.target || "");
    if (!TABLES[table] || !id || !["en", "es"].includes(target)) {
      return new Response(JSON.stringify({ error: "invalid table/id/target" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fields = TABLES[table];
    const ptCols = fields.map((f) => f.name);
    const trCols = fields.map((f) => `${f.name}_${target}`);
    const selectCols = ["id", ...ptCols, ...trCols].join(",");

    const { data: row, error: selErr } = await sb.from(table).select(selectCols).eq("id", id).maybeSingle();
    if (selErr || !row) {
      return new Response(JSON.stringify({ error: selErr?.message || "row not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build payload of fields needing translation (PT present, translation missing).
    const payload: Record<string, unknown> = {};
    const meta: Record<string, FieldKind> = {};
    for (const f of fields) {
      let ptVal = (row as any)[f.name];
      const trVal = (row as any)[`${f.name}_${target}`];
      if (trVal != null && trVal !== "") continue;
      // Special-case: system_a_catalog.technical_specs canonical data lives in
      // extra_data.system_a_live.technical_specs (array). Fall back to it when
      // the top-level column is empty or not an array.
      if (
        table === "system_a_catalog" &&
        f.name === "technical_specs" &&
        (!Array.isArray(ptVal) || ptVal.length === 0)
      ) {
        const live = (row as any)?.extra_data?.system_a_live?.technical_specs;
        if (Array.isArray(live) && live.length > 0) ptVal = live;
      }
      if (ptVal == null) continue;
      if (f.kind === "text") {
        const s = String(ptVal).trim();
        if (!s) continue;
        payload[f.name] = s;
      } else if (f.kind === "jsonb_kv") {
        // Expect array of {label, value} (or similar). Skip if not array.
        if (!Array.isArray(ptVal) || ptVal.length === 0) continue;
        payload[f.name] = ptVal;
      }
      meta[f.name] = f.kind;
    }

    if (Object.keys(payload).length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const translated = await callTranslator(payload, target);
    if (!translated) {
      return new Response(JSON.stringify({ error: "translation failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update: Record<string, unknown> = { [`translated_at_${target}`]: new Date().toISOString() };
    for (const key of Object.keys(payload)) {
      if (translated[key] === undefined) continue;
      update[`${key}_${target}`] = translated[key];
    }

    const { error: updErr } = await sb.from(table).update(update).eq("id", id);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, updated: Object.keys(update) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[translate-card-row]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});