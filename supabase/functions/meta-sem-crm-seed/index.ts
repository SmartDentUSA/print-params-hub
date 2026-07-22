// One-shot seed for meta_sem_crm_reprocess_queue.
// Inserts 355 leads (from meta-mes-sem-crm CSV) with staggered
// scheduled_at (10 leads per 30-minute window).
// Idempotent: skips csv_row values already present.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ROWS } from "./rows.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = Date.now();
  const payload = ROWS.map((r, idx) => {
    const [csv_row, nome, email, telefone_raw, telefone_normalized, form_name, produto_interesse, created_time] = r;
    const window = Math.floor(idx / 10);
    const scheduled_at = new Date(now + window * 30 * 60_000).toISOString();
    const skip = !telefone_normalized && !email;
    return {
      csv_row,
      nome: nome || null,
      email: email || null,
      telefone_raw: telefone_raw || null,
      telefone_normalized: telefone_normalized || null,
      form_name: form_name || null,
      produto_interesse: produto_interesse || null,
      created_time: created_time || null,
      status: skip ? "skipped_no_identifier" : "pending",
      scheduled_at,
      skip_reason: skip ? "no email and phone unrecoverable" : null,
    };
  });

  // Skip rows already present (idempotent).
  const { data: existing } = await supabase
    .from("meta_sem_crm_reprocess_queue")
    .select("csv_row");
  const present = new Set<number>((existing || []).map((r: any) => Number(r.csv_row)));
  const toInsert = payload.filter((r) => !present.has(r.csv_row));

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const { error } = await supabase.from("meta_sem_crm_reprocess_queue").insert(chunk);
    if (error) {
      return new Response(JSON.stringify({ inserted, error: error.message, at: i }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    inserted += chunk.length;
  }

  return new Response(JSON.stringify({
    total_rows: ROWS.length,
    already_present: present.size,
    inserted,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});