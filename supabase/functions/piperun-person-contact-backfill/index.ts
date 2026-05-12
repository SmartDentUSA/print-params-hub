import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isFakeEmail } from "../_shared/lead-identity-guard.ts";
import { piperunPut } from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY")!;
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: { days?: number; limit?: number; lead_ids?: string[] } = {};
  try { body = await req.json(); } catch {}
  const days = body.days ?? 3;
  const limit = Math.min(body.limit ?? 50, 200);

  let q = supa
    .from("lia_attendances")
    .select("id,email,nome,telefone_normalized,telefone_raw,pessoa_piperun_id")
    .is("merged_into", null)
    .not("pessoa_piperun_id", "is", null);

  if (body.lead_ids?.length) {
    q = q.in("id", body.lead_ids);
  } else {
    q = q.gte("created_at", new Date(Date.now() - days * 86400_000).toISOString())
         .order("created_at", { ascending: false })
         .limit(limit);
  }

  const { data: leads, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const results: Array<Record<string, unknown>> = [];
  for (const lead of leads ?? []) {
    const personId = Number(lead.pessoa_piperun_id);
    if (!personId) continue;
    const email = lead.email as string | null;
    const phone = (lead.telefone_normalized || lead.telefone_raw) as string | null;
    const payload: Record<string, unknown> = {};
    if (email && !isFakeEmail(email)) payload.emails = [{ email }];
    if (phone) payload.phones = [{ phone }];
    if (Object.keys(payload).length === 0) {
      results.push({ id: lead.id, person_id: personId, skipped: "no_contact_data" });
      continue;
    }
    const res = await piperunPut(PIPERUN_API_KEY, `persons/${personId}`, payload);
    results.push({ id: lead.id, person_id: personId, status: res.status, ok: res.success, sent: payload });
    await supa.from("system_health_logs").insert({
      function_name: "piperun-person-contact-backfill",
      severity: res.success ? "info" : "warning",
      error_type: res.success ? "piperun_person_contact_backfilled" : "piperun_person_contact_backfill_failed",
      lead_id: lead.id,
      lead_email: email,
      details: { person_id: personId, status: res.status, payload },
    });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});