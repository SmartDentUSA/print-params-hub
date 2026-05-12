/**
 * piperun-person-empty-sweeper
 *
 * One-shot/cron remediation for leads stuck in
 *   crm_creation_blocked_reason = 'empty_person_in_piperun'.
 *
 * For each canonical lead:
 *  1) Use findPersonExpanded (strict + name + localpart) to find the rightful
 *     PipeRun Person owning the email/phone/name.
 *  2) If a non-empty owner is found:
 *       - update pessoa_piperun_id, clear the block,
 *       - re-invoke smart-ops-lia-assign so the Deal is finally created.
 *  3) If no owner is found:
 *       - mark raw_payload.empty_person_unresolvable = true (won't retry).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { findPersonExpanded } from "../_shared/piperun-person-resolver.ts";

const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: { limit?: number; lead_id?: string } = {};
  try { body = await req.json(); } catch {}
  const limit = Math.max(1, Math.min(200, body.limit ?? 50));

  let q = supabase
    .from("lia_attendances")
    .select("id, nome, email, telefone_normalized, telefone_raw, pessoa_piperun_id, raw_payload")
    .is("merged_into", null)
    .eq("crm_creation_blocked_reason", "empty_person_in_piperun")
    .limit(limit);
  if (body.lead_id) q = q.eq("id", body.lead_id);

  const { data: leads, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<Record<string, unknown>> = [];
  for (const lead of leads ?? []) {
    const email = (lead.email as string | null) || null;
    const phone = (lead.telefone_normalized as string | null) || (lead.telefone_raw as string | null) || null;
    const name = (lead.nome as string | null) || null;

    let owner: { id: number; company_id: number | null; matched_via: string } | null = null;
    try {
      owner = await findPersonExpanded(PIPERUN_API_KEY, { email, phone, name });
    } catch (e) {
      console.warn(`[sweeper] findPersonExpanded error for ${lead.id}:`, e);
    }

    if (owner) {
      await supabase.from("lia_attendances")
        .update({
          pessoa_piperun_id: owner.id,
          empresa_piperun_id: owner.company_id ?? undefined,
          crm_creation_blocked: false,
          crm_creation_blocked_reason: null,
        })
        .eq("id", lead.id);

      await supabase.from("system_health_logs").insert({
        function_name: "piperun-person-empty-sweeper",
        severity: "info",
        error_type: "empty_person_resolved",
        lead_id: lead.id,
        lead_email: email,
        details: { previous_person_id: lead.pessoa_piperun_id, new_person_id: owner.id, matched_via: owner.matched_via },
      });

      // Re-enqueue lia-assign (fire-and-forget).
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-lia-assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE}` },
          body: JSON.stringify({ lead_id: lead.id, source: "empty_person_sweeper" }),
        });
      } catch (e) { console.warn("[sweeper] re-invoke lia-assign failed:", e); }

      results.push({ lead_id: lead.id, action: "resolved", new_person_id: owner.id, matched_via: owner.matched_via });
    } else {
      const raw = (lead.raw_payload as Record<string, unknown> | null) || {};
      raw.empty_person_unresolvable = true;
      raw.empty_person_unresolvable_at = new Date().toISOString();

      await supabase.from("lia_attendances")
        .update({ raw_payload: raw })
        .eq("id", lead.id);

      await supabase.from("system_health_logs").insert({
        function_name: "piperun-person-empty-sweeper",
        severity: "warning",
        error_type: "empty_person_unresolvable",
        lead_id: lead.id,
        lead_email: email,
        details: { person_id: lead.pessoa_piperun_id, name, email, phone },
      });

      results.push({ lead_id: lead.id, action: "unresolvable" });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
