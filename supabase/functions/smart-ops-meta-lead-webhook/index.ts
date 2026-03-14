import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // --- Meta Webhook Verification (GET) ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[meta-webhook] Verification successful");
      return new Response(challenge, { status: 200 });
    }

    console.warn("[meta-webhook] Verification failed. Token mismatch.");
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const META_TOKEN = Deno.env.get("META_LEAD_ADS_TOKEN");

    if (!META_TOKEN) {
      console.error("[meta-webhook] META_LEAD_ADS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "Meta token not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("[meta-webhook] Payload:", JSON.stringify(body).slice(0, 500));

    // Meta sends { object: "page", entry: [{ changes: [{ value: { leadgen_id, page_id, form_id } }] }] }
    if (body.object !== "page" && body.object !== "instagram") {
      console.log("[meta-webhook] Not a page/instagram event, ignoring");
      return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const entries = body.entry || [];
    const results: Array<{ leadgen_id: string; status: string; lead_id?: string }> = [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== "leadgen") continue;

        const leadgenId = change.value?.leadgen_id;
        const pageId = change.value?.page_id;
        const formId = change.value?.form_id;

        if (!leadgenId) {
          console.warn("[meta-webhook] No leadgen_id in change");
          continue;
        }

        console.log("[meta-webhook] Processing leadgen_id:", leadgenId);

        // --- Fetch lead data from Graph API ---
        try {
          const graphRes = await fetch(
            `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${META_TOKEN}`
          );

          if (!graphRes.ok) {
            const errText = await graphRes.text();
            console.error("[meta-webhook] Graph API error:", graphRes.status, errText);
            results.push({ leadgen_id: leadgenId, status: "graph_api_error" });
            continue;
          }

          const leadData = await graphRes.json();
          console.log("[meta-webhook] Graph API response:", JSON.stringify(leadData).slice(0, 500));

          // Parse field_data array: [{ name: "email", values: ["x@y.com"] }, ...]
          const fieldData = leadData.field_data || [];
          const fields: Record<string, string> = {};
          for (const field of fieldData) {
            if (field.name && field.values?.[0]) {
              fields[field.name.toLowerCase()] = field.values[0];
            }
          }

          // Determine platform (facebook or instagram)
          const platform = body.object === "instagram" ? "instagram" : "facebook";

          // --- Build normalized payload for ingest-lead ---
          const normalizedPayload: Record<string, unknown> = {
            source: "meta_lead_ads",
            utm_source: platform,
            utm_medium: "paid",
            utm_campaign: formId ? `form_${formId}` : null,
            form_name: leadData.form_name || `Meta Lead Form ${formId || ""}`,
            meta_leadgen_id: leadgenId,
            meta_page_id: pageId,
            meta_form_id: formId,
            meta_created_time: leadData.created_time,
            meta_platform: platform,
            // Map common Meta Lead Ad fields
            email: fields.email || fields.e_mail || fields["e-mail"] || null,
            full_name: fields.full_name || fields.nome_completo || fields.nome || null,
            first_name: fields.first_name || fields.nome || null,
            last_name: fields.last_name || fields.sobrenome || null,
            phone_number: fields.phone_number || fields.telefone || fields.celular || null,
            // Custom fields commonly used in dental/3D printing forms
            especialidade: fields.especialidade || fields.specialty || null,
            area_atuacao: fields.area_de_atuacao || fields.area_atuacao || null,
            city: fields.city || fields.cidade || null,
            state: fields.state || fields.estado || fields.uf || null,
          };

          // --- Call ingest-lead gateway ---
          const ingestRes = await fetch(
            `${SUPABASE_URL}/functions/v1/smart-ops-ingest-lead`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify(normalizedPayload),
            }
          );

          const ingestResult = await ingestRes.json();
          console.log("[meta-webhook] ingest-lead result:", JSON.stringify(ingestResult));

          results.push({
            leadgen_id: leadgenId,
            status: ingestResult.success ? "ok" : "ingest_error",
            lead_id: ingestResult.lead_id,
          });
        } catch (fetchErr) {
          console.error("[meta-webhook] Error processing leadgen_id:", leadgenId, fetchErr);
          results.push({ leadgen_id: leadgenId, status: "error" });
        }
      }
    }

    return new Response(JSON.stringify({ received: true, processed: results.length, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[meta-webhook] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
