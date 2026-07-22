// redeployed 2026-07-21 — accent-safe field parsing + canonical taxonomy
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildMetaFieldMap, pickMetaField } from "../_shared/meta-field-utils.ts";
import {
  canonicalizeArea,
  canonicalizeSpecialty,
  canonicalizeScanner,
  canonicalizePrinter,
} from "../_shared/dental-taxonomy.ts";
import {
  normalizeZernioLead,
  metaFieldDataArrayToRecord,
  mapFormToProduct,
} from "../_shared/zernio-field-normalizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // --- Meta Webhook Verification (GET) ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = (url.searchParams.get("hub.verify_token") || "").trim();
    const challenge = url.searchParams.get("hub.challenge");

    const VERIFY_TOKEN = (Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "").trim();

    console.log(`[meta-webhook] GET verification: mode=${mode}, token_len=${token.length}, expected_len=${VERIFY_TOKEN.length}, match=${token === VERIFY_TOKEN}`);

    if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      console.log("[meta-webhook] ✅ Verification successful");
      return new Response(challenge, { status: 200 });
    }

    console.warn(`[meta-webhook] ❌ Verification failed. mode=${mode}, token_match=${token === VERIFY_TOKEN}, has_challenge=${!!challenge}`);
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
            `https://graph.facebook.com/v21.0/${leadgenId}?fields=field_data,form_name,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,created_time,platform&access_token=${META_TOKEN}`
          );

          if (!graphRes.ok) {
            const errText = await graphRes.text();
            console.error("[meta-webhook] Graph API error:", graphRes.status, errText);
            results.push({ leadgen_id: leadgenId, status: "graph_api_error" });
            continue;
          }

          const leadData = await graphRes.json();
          console.log("[meta-webhook] Graph API response:", JSON.stringify(leadData).slice(0, 500));

          // Parse field_data array with accent-safe key normalization.
          // Meta sends keys like `área_de_atuação`, `como_digitaliza_suas_moldagens?`
          // and values like `clínica_ou_consultório` — buildMetaFieldMap strips
          // diacritics, collapses non-alnum to `_` and unslugs values.
          const fieldData = leadData.field_data || [];
          const fields = buildMetaFieldMap(fieldData);

          // Determine platform (facebook or instagram)
          const platform = body.object === "instagram" ? "instagram" : "facebook";

          // --- Campaign / Ad / Adset enrichment (fallback if Graph didn't return them) ---
          const adId = leadData.ad_id || change.value?.ad_id || null;
          let campaignName: string | null = leadData.campaign_name || null;
          let campaignId: string | null = leadData.campaign_id || null;
          let adsetName: string | null = leadData.adset_name || null;
          let adsetId: string | null = leadData.adset_id || null;
          let adName: string | null = leadData.ad_name || null;

          if ((!campaignName || !adsetName) && adId) {
            try {
              const adRes = await fetch(
                `https://graph.facebook.com/v21.0/${adId}?fields=name,campaign{id,name},adset{id,name}&access_token=${META_TOKEN}`
              );
              if (adRes.ok) {
                const adData = await adRes.json();
                adName = adName || adData.name || null;
                campaignName = campaignName || adData.campaign?.name || null;
                campaignId = campaignId || adData.campaign?.id || null;
                adsetName = adsetName || adData.adset?.name || null;
                adsetId = adsetId || adData.adset?.id || null;
                console.log("[meta-webhook] Ad metadata:", { campaignName, adsetName, adName });
              } else {
                console.warn("[meta-webhook] Ad fetch failed:", adRes.status);
              }
            } catch (e) {
              console.warn("[meta-webhook] Ad metadata fetch error:", e);
            }
          }

          // Origin label = real campaign name (fallback chain)
          const originLabel = campaignName
            ? `Meta Ads — ${campaignName}`
            : (leadData.form_name ? `Meta Ads — ${leadData.form_name}` : `Meta Ads — Form ${formId || ""}`);

          // Product of interest (cascade: form answer → keyword inference → campaign name)
          const KEYWORDS_RE_LOCAL = /anycubic|phrozen|bite|glaze|nano|vitality|resina|impressora|scanner|cadcam|zirc[oô]nia|miicraft|primeprint|formlabs|asiga|creality|elegoo|wash|cure|exocad|medit|3shape/gi;
          const directProduct = pickMetaField(fields, "produto_de_interesse", "produto_interesse", "produto",
            "equipamento", "interesse", "solucao");
          const allFieldValuesPre = Object.values(fields).join(' ');
          const inferredMatches = allFieldValuesPre.match(KEYWORDS_RE_LOCAL);
          const inferredProduct = inferredMatches?.length
            ? [...new Set(inferredMatches.map(m => m.toLowerCase()))].join(', ')
            : null;
          const campaignProduct = campaignName?.match(KEYWORDS_RE_LOCAL)?.[0]?.toLowerCase() || null;
          const produtoInteresse = directProduct || inferredProduct || campaignProduct || null;

          // --- Build normalized payload for ingest-lead ---
          const normalizedPayload: Record<string, unknown> = {
            source: "meta_lead_ads",
            new_conversion_confirmed: true,
            conversion_key: `meta_leadgen:${leadgenId}`,
            utm_source: platform,
            utm_medium: "paid",
            utm_campaign: campaignName || (formId ? `form_${formId}` : null),
            utm_content: adName || null,
            utm_term: adsetName || null,
            // form_name = origin label used by lia-assign to create/reuse a Piperun origin per campaign
            form_name: originLabel,
            origem_campanha: originLabel,
            produto_interesse: produtoInteresse,
            // Meta-specific metadata (auto-forwarded if columns exist; preserved in raw_payload otherwise)
            meta_campaign_id: campaignId,
            meta_campaign_name: campaignName,
            meta_adset_id: adsetId,
            meta_adset_name: adsetName,
            meta_ad_id: adId,
            meta_ad_name: adName,
            meta_leadgen_id: leadgenId,
            meta_page_id: pageId,
            meta_form_id: formId,
            meta_created_time: leadData.created_time,
            meta_platform: platform,
            // Map common Meta Lead Ad fields (accent-safe pickMetaField)
            email: pickMetaField(fields, "email", "e_mail"),
            full_name: pickMetaField(fields, "full_name", "nome_completo", "nome"),
            first_name: pickMetaField(fields, "first_name", "nome"),
            last_name: pickMetaField(fields, "last_name", "sobrenome"),
            phone_number: pickMetaField(fields, "phone_number", "phone", "telefone", "celular"),
            // Canonicalized taxonomy fields
            ...(() => {
              const areaRaw = pickMetaField(fields, "area_de_atuacao", "area_atuacao", "atuacao", "area");
              const espRaw  = pickMetaField(fields, "especialidade", "specialty", "especialidade_odontologica");
              const scanRaw = pickMetaField(fields, "como_digitaliza", "como_digitaliza_suas_moldagens",
                "tem_scanner", "possui_scanner", "scanner_intraoral", "scanner");
              const printRaw = pickMetaField(fields, "tem_impressora", "possui_impressora",
                "impressora_3d", "impressoes_3d", "impressora");
              const modeloRaw = pickMetaField(fields, "impressora_modelo", "modelo_impressora",
                "printer_model", "modelo_da_impressora");
              const scan = canonicalizeScanner(scanRaw);
              const printer = canonicalizePrinter(printRaw || modeloRaw);
              return {
                area_atuacao: canonicalizeArea(areaRaw),
                especialidade: canonicalizeSpecialty(espRaw),
                como_digitaliza: scan.como_digitaliza,
                scanner_marca: scan.scanner_marca,
                tem_scanner: scan.tem_scanner,
                tem_impressora: printer.tem_impressora,
                impressora_modelo: printer.impressora_marca || modeloRaw || null,
                // preservar raw para auditoria
                area_atuacao_raw: areaRaw,
                especialidade_raw: espRaw,
                scanner_raw: scanRaw,
                impressora_raw: printRaw,
              };
            })(),
            // Behavioral Ingestion: keep both explicit and inferred product
            produto_interesse_auto: inferredProduct || campaignProduct || null,
            empresa_nome: pickMetaField(fields, "empresa_nome", "empresa", "clinica", "consultorio"),
            empresa_razao_social: pickMetaField(fields, "razao_social", "empresa_razao_social"),
            cidade: pickMetaField(fields, "cidade", "city"),
            uf: pickMetaField(fields, "uf", "estado", "state"),
            city: pickMetaField(fields, "city", "cidade"),
            state: pickMetaField(fields, "state", "estado", "uf"),
          };

          // --- Detect equipment/product mentions for lead_form_submissions ---
          const KEYWORDS_RE = /anycubic|phrozen|bite|glaze|nano|vitality|resina|impressora|scanner|cadcam|zirc[oô]nia|miicraft|primeprint|formlabs|asiga|creality|elegoo|wash|cure|exocad|medit|3shape/gi;
          const allFieldValues = Object.values(fields).join(' ');
          const formMatches = allFieldValues.match(KEYWORDS_RE);
          const metaFormDetected = formMatches && formMatches.length > 0;
          const metaUniqueMatches = metaFormDetected ? [...new Set(formMatches.map((m: string) => m.toLowerCase()))] : [];

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

          // --- Insert lead_form_submissions if keywords detected ---
          if (metaFormDetected && ingestResult.lead_id) {
            const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
            const equipKeywords = ['impressora', 'scanner', 'cadcam', 'wash', 'cure'];
            const equipMentioned = metaUniqueMatches.filter(m => equipKeywords.some(e => m.includes(e)));
            const productMentioned = metaUniqueMatches.filter(m => !equipKeywords.some(e => m.includes(e)));

            await supabase.from('lead_form_submissions').upsert({
              lead_id: ingestResult.lead_id,
              form_type: 'meta_lead_ads',
              form_id: formId || null,
              form_data: fieldData,
              message: leadData.form_name || null,
              equipment_mentioned: equipMentioned.length > 0 ? equipMentioned.join(', ') : null,
              product_mentioned: productMentioned.length > 0 ? productMentioned.join(', ') : null,
              submitted_at: new Date().toISOString(),
              status: 'new',
            }, { onConflict: 'lead_id,form_type,form_id', ignoreDuplicates: true });

            await supabase.from('lead_activity_log').insert({
              lead_id: ingestResult.lead_id,
              event_type: 'form_submission_detected',
              entity_type: 'form',
              entity_name: `Meta Lead Ad: ${leadData.form_name || formId || 'unknown'}`,
              event_data: { source: 'meta', keywords: metaUniqueMatches, form_id: formId },
              source_channel: 'meta',
              event_timestamp: new Date().toISOString(),
            });

            console.log('[meta-webhook] Form submission detected, keywords:', metaUniqueMatches);
          }

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
