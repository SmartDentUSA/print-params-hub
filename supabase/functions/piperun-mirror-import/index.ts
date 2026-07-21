import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json();
    const table = body.table as string;
    const rows = body.rows as Record<string, unknown>[];
    if (!table || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "table+rows required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (table !== "piperun_persons_mirror" && table !== "piperun_companies_mirror") {
      return new Response(JSON.stringify({ error: "invalid table" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const conflictKey = table === "piperun_persons_mirror" ? "piperun_person_id" : "piperun_company_id";
    // Dedupe within payload: keep last occurrence per conflict key
    const dedup = new Map<unknown, Record<string, unknown>>();
    for (const r of rows) dedup.set(r[conflictKey], r);
    const deduped = Array.from(dedup.values());
    // Chunk in 500s to avoid payload limits on internal upsert
    let total = 0;
    for (let i = 0; i < deduped.length; i += 500) {
      const chunk = deduped.slice(i, i + 500);
      const { error } = await supa.from(table).upsert(chunk, { onConflict: conflictKey });
      if (error) {
        return new Response(JSON.stringify({ error: error.message, at: i, total }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      total += chunk.length;
    }
    return new Response(JSON.stringify({ ok: true, upserted: total, input: rows.length, deduped: deduped.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});