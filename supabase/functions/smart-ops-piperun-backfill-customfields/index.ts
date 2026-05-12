// Backfill PipeRun deal custom_fields for leads where the initial sync left them empty.
// Reads top-level columns + form_data fallback via mapAttendanceToDealCustomFields.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mapAttendanceToDealCustomFields,
  customFieldsToHashMap,
  piperunPut,
} from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  dry_run?: boolean;
  lead_ids?: string[];
  since?: string; // ISO
  limit?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");
    if (!PIPERUN_API_KEY) {
      return new Response(JSON.stringify({ error: "PIPERUN_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (req.method === "POST" ? await req.json().catch(() => ({})) : {}) as ReqBody;
    const dryRun = body.dry_run !== false; // default safe: dry_run=true
    const limit = Math.min(Math.max(body.limit ?? 500, 1), 2000);
    const since = body.since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let query = supabase
      .from("lia_attendances")
      .select("id, nome, email, telefone_normalized, piperun_id, pessoa_piperun_id, piperun_custom_fields, tem_scanner, tem_impressora, produto_interesse, produto_interesse_auto, area_atuacao, especialidade, pais_origem, id_cliente_smart, form_data, created_at")
      .is("merged_into", null)
      .not("piperun_id", "is", null);

    if (body.lead_ids && body.lead_ids.length > 0) {
      query = query.in("id", body.lead_ids);
    } else {
      query = query.gte("created_at", since).limit(limit);
    }

    const { data: leads, error } = await query;
    if (error) throw error;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ dry_run: dryRun, scanned: 0, candidates: 0, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<Record<string, unknown>> = [];
    let candidates = 0;
    let updated = 0;
    let failed = 0;

    for (const lead of leads) {
      const existing = lead.piperun_custom_fields as unknown;
      const isEmpty = !existing || (Array.isArray(existing) && existing.length === 0);
      if (!isEmpty && !body.lead_ids) continue;

      const customFields = mapAttendanceToDealCustomFields(lead as Record<string, unknown>);
      if (customFields.length === 0) {
        results.push({ lead_id: lead.id, piperun_id: lead.piperun_id, status: "no_fields_resolved" });
        continue;
      }
      candidates++;
      const hashFields = customFieldsToHashMap(customFields);

      if (dryRun) {
        results.push({
          lead_id: lead.id, piperun_id: lead.piperun_id, status: "would_update",
          fields_count: customFields.length, fields: customFields,
        });
        continue;
      }

      const putRes = await piperunPut(PIPERUN_API_KEY, `deals/${lead.piperun_id}`, hashFields);
      if (putRes.success) {
        updated++;
        await supabase
          .from("lia_attendances")
          .update({ piperun_custom_fields: customFields })
          .eq("id", lead.id);
        results.push({ lead_id: lead.id, piperun_id: lead.piperun_id, status: "updated", fields_count: customFields.length });
      } else {
        failed++;
        results.push({ lead_id: lead.id, piperun_id: lead.piperun_id, status: "failed", http: putRes.status, error: String(putRes.data).slice(0, 300) });
      }

      // Be gentle on PipeRun API
      await new Promise((r) => setTimeout(r, 120));
    }

    return new Response(JSON.stringify({
      dry_run: dryRun, scanned: leads.length, candidates, updated, failed, results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[piperun-backfill-customfields] error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});