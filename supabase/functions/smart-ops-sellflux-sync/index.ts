import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchLeadFromSellFlux, migrateLegacyTags, mergeTagsCrm } from "../_shared/sellflux-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = await req.json();

    // Accept single email or array of emails
    const emails: string[] = Array.isArray(body.emails)
      ? body.emails
      : body.email
        ? [body.email]
        : [];

    if (emails.length === 0) {
      return new Response(JSON.stringify({ error: "email or emails[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap at 50 per batch
    const batch = emails.slice(0, 50).map((e) => e.toLowerCase().trim());
    const results: Array<{ email: string; status: string; tags_added?: string[] }> = [];

    for (const email of batch) {
      try {
        // 1. Fetch from SellFlux API
        const sfData = await fetchLeadFromSellFlux(email);
        if (!sfData) {
          results.push({ email, status: "not_found_in_sellflux" });
          continue;
        }

        // 2. Migrate tags
        const migration = migrateLegacyTags(sfData.tags);

        if (migration.standardizedTags.length === 0 && Object.keys(migration.extractedFields).length === 0) {
          results.push({ email, status: "no_tags_to_sync" });
          continue;
        }

        // 3. Get current lead from DB
        const { data: lead } = await supabase
          .from("lia_attendances")
          .select("id, tags_crm, area_atuacao, tem_impressora, tem_scanner")
          .eq("email", email)
          .maybeSingle();

        if (!lead) {
          results.push({ email, status: "lead_not_in_db" });
          continue;
        }

        // 4. Merge tags
        const mergedTags = mergeTagsCrm(lead.tags_crm, migration.standardizedTags);

        // 5. Build update payload
        const updatePayload: Record<string, unknown> = {
          tags_crm: mergedTags,
          sellflux_synced_at: new Date().toISOString(),
        };

        // Update extracted fields only if currently empty
        const ef = migration.extractedFields;
        if (ef.area_atuacao && !lead.area_atuacao) updatePayload.area_atuacao = ef.area_atuacao;
        if (ef.tem_impressora && !lead.tem_impressora) updatePayload.tem_impressora = ef.tem_impressora;
        if (ef.tem_scanner && !lead.tem_scanner) updatePayload.tem_scanner = ef.tem_scanner;

        // 6. Update DB
        await supabase
          .from("lia_attendances")
          .update(updatePayload)
          .eq("id", lead.id);

        results.push({
          email,
          status: "synced",
          tags_added: migration.standardizedTags,
        });
      } catch (err) {
        console.error(`[sellflux-sync] Error for ${email}:`, err);
        results.push({ email, status: "error: " + String(err) });
      }
    }

    // Log summary
    await supabase.from("system_health_logs").insert({
      function_name: "smart-ops-sellflux-sync",
      severity: "info",
      error_type: "batch_sync",
      details: {
        total: batch.length,
        synced: results.filter((r) => r.status === "synced").length,
        results,
      },
    }).catch(() => {});

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sellflux-sync] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
