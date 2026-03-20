import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100;

// ─── Product → hits_e* mapping ───────────────────────────────────────────────
// A single deal.product string may match multiple patterns (each adds +1 to its column).
// Columns map 1-to-1 with lia_attendances hits_e* granular fields.

const PRODUCT_PATTERNS: Array<{ pattern: RegExp; col: string }> = [
  // E1 — Captura Digital
  { pattern: /scanner|medit|ios|intraoral/i,                              col: "hits_e1_scanner_intraoral"  },
  { pattern: /bancada|t310|t510|t710|blz.*ls/i,                          col: "hits_e1_scanner_bancada"    },
  { pattern: /notebook|computador/i,                                      col: "hits_e1_notebook"           },

  // E2 — CAD
  { pattern: /exocad|exoplan|dental.*cad|software.*cad|cad.*software/i,  col: "hits_e2_software"           },
  { pattern: /cr[eé]dito.*ia|ia.*cad|smart.*slice/i,                     col: "hits_e2_credito_ia"         },

  // E3 — Impressão 3D
  { pattern: /resina|resin|vitality|salm[aã]o|ocre|model.*dlp|bio.*temp|bio.*guide|bio.*bite|bio.*hybrid|bio.*denture|unichroma|academic/i,
                                                                          col: "hits_e3_resina"             },
  { pattern: /impressora|miicraft|rayshape|edge.*mini|blz.*dental.*printer/i,
                                                                          col: "hits_e3_impressora"         },
  { pattern: /teflon|fep|vidro.*impressora|film|vat/i,                   col: "hits_e3_acessorios"         },

  // E4 — Pós-Impressão
  { pattern: /cura|lavagem|post.*cure|nanocle[ea]n|magna.*box|pionext|cleaning/i,
                                                                          col: "hits_e4_equipamentos"       },

  // E5 — Finalização
  { pattern: /smartmake|smartgum|gengiva|caract/i,                       col: "hits_e5_caracterizacao"     },
  { pattern: /atos|bloco|zircônia|zirconia|dissilicato|evolith/i,        col: "hits_e5_dentistica_orto"    },

  // E6 — Cursos
  { pattern: /curso|treinamento|workshop|presencial/i,                   col: "hits_e6_presencial"         },
  { pattern: /online|ead|digital.*course/i,                              col: "hits_e6_online"             },

  // E7 — Fresagem
  { pattern: /fresa|fresadora|arum|milling/i,                            col: "hits_e7_equipamentos"       },
  { pattern: /bloco.*fres|disco.*zircônia|smartzr/i,                     col: "hits_e7_pecas_partes"       },
];

// All hits_e* columns (used for zero-reset before recalculation — idempotency)
const ALL_HITS_E_COLS = [
  "hits_e1_scanner_intraoral", "hits_e1_scanner_bancada", "hits_e1_notebook",
  "hits_e1_acessorios", "hits_e1_pecas_partes",
  "hits_e2_software", "hits_e2_credito_ia", "hits_e2_servico", "hits_e2_pecas_partes",
  "hits_e3_resina", "hits_e3_impressora", "hits_e3_acessorios",
  "hits_e3_software", "hits_e3_pecas_partes",
  "hits_e4_equipamentos", "hits_e4_limpeza_acabamento",
  "hits_e5_caracterizacao", "hits_e5_dentistica_orto", "hits_e5_instalacao",
  "hits_e6_presencial", "hits_e6_online",
  "hits_e7_equipamentos", "hits_e7_software", "hits_e7_servico",
  "hits_e7_acessorios", "hits_e7_pecas_partes",
];

// ─── Classify a product name → set of column names to increment ──────────────
function classifyProduct(productName: string | null): string[] {
  if (!productName) return [];
  const matched = new Set<string>();
  for (const { pattern, col } of PRODUCT_PATTERNS) {
    if (pattern.test(productName)) {
      matched.add(col);
    }
  }
  return [...matched];
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const startedAt = new Date().toISOString();
  let totalLeadsProcessed = 0;
  let totalLeadsWithDeals = 0;
  let totalHitsGravados = 0;
  let totalErrors = 0;

  // Running tally per column (for final report)
  const hitsByCol: Record<string, number> = {};
  for (const col of ALL_HITS_E_COLS) hitsByCol[col] = 0;

  // ── Step 1: Fetch all lead IDs that have at least one 'ganha' deal ──────────
  // We page through lia_attendances joined to deals via lead_id.
  // To avoid a massive join, we first collect distinct lead_ids from deals.
  const { data: wonDealLeads, error: wonErr } = await supabase
    .from("deals")
    .select("lead_id")
    .eq("status", "ganha")
    .not("lead_id", "is", null);

  if (wonErr) {
    console.error("[backfill-hits-granular] Failed to fetch won deals:", wonErr);
    return new Response(JSON.stringify({ error: wonErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Deduplicate lead_ids
  const uniqueLeadIds = [...new Set((wonDealLeads || []).map((r) => r.lead_id as string))];
  console.log(`[backfill-hits-granular] ${uniqueLeadIds.length} unique leads with won deals`);

  // ── Step 2: Process in batches ───────────────────────────────────────────────
  for (let offset = 0; offset < uniqueLeadIds.length; offset += BATCH_SIZE) {
    const batchIds = uniqueLeadIds.slice(offset, offset + BATCH_SIZE);

    // Fetch all won deals for this batch of leads in one query
    const { data: batchDeals, error: batchErr } = await supabase
      .from("deals")
      .select("lead_id, product")
      .eq("status", "ganha")
      .in("lead_id", batchIds);

    if (batchErr) {
      console.error(`[backfill-hits-granular] Batch ${offset} deals fetch error:`, batchErr);
      totalErrors += batchIds.length;
      continue;
    }

    // Group deals by lead_id
    const dealsByLead: Record<string, string[]> = {};
    for (const deal of (batchDeals || [])) {
      const lid = deal.lead_id as string;
      if (!dealsByLead[lid]) dealsByLead[lid] = [];
      if (deal.product) dealsByLead[lid].push(deal.product as string);
    }

    // Process each lead in the batch
    for (const leadId of batchIds) {
      const products = dealsByLead[leadId] || [];
      totalLeadsProcessed++;

      if (products.length === 0) continue;
      totalLeadsWithDeals++;

      // Tally hits for this lead
      const leadHits: Record<string, number> = {};

      for (const product of products) {
        const cols = classifyProduct(product);
        for (const col of cols) {
          leadHits[col] = (leadHits[col] || 0) + 1;
        }
      }

      // Build update payload: reset ALL hits_e* to 0 first (idempotency),
      // then set the matched ones to their counted values.
      const updatePayload: Record<string, number> = {};
      for (const col of ALL_HITS_E_COLS) {
        updatePayload[col] = leadHits[col] ?? 0;
      }

      const { error: updateErr } = await supabase
        .from("lia_attendances")
        .update(updatePayload)
        .eq("id", leadId);

      if (updateErr) {
        console.error(`[backfill-hits-granular] Update error for lead ${leadId}:`, updateErr);
        totalErrors++;
        continue;
      }

      // Accumulate totals
      for (const [col, count] of Object.entries(leadHits)) {
        totalHitsGravados += count;
        hitsByCol[col] = (hitsByCol[col] || 0) + count;
      }
    }

    console.log(
      `[backfill-hits-granular] Batch ${Math.floor(offset / BATCH_SIZE) + 1}/${Math.ceil(uniqueLeadIds.length / BATCH_SIZE)}: ` +
      `processed ${Math.min(offset + BATCH_SIZE, uniqueLeadIds.length)} / ${uniqueLeadIds.length} leads`
    );

    // Small pause between batches to avoid overwhelming the DB
    await new Promise((r) => setTimeout(r, 200));
  }

  const finishedAt = new Date().toISOString();

  // ── Step 3: Log summary to system_health_logs ────────────────────────────────
  const summaryDetails = {
    started_at: startedAt,
    finished_at: finishedAt,
    total_leads_with_won_deals: uniqueLeadIds.length,
    total_leads_processed: totalLeadsProcessed,
    total_leads_with_deals: totalLeadsWithDeals,
    total_hits_gravados: totalHitsGravados,
    total_errors: totalErrors,
    hits_by_col: hitsByCol,
  };

  try {
    await supabase.from("system_health_logs").insert({
      function_name: "backfill-hits-granular",
      severity: totalErrors > 0 ? "warning" : "info",
      error_type: totalErrors > 0 ? "partial_errors" : null,
      details: summaryDetails,
    });
  } catch (logErr) {
    console.warn("[backfill-hits-granular] Failed to write health log:", logErr);
  }

  console.log("[backfill-hits-granular] Done.", JSON.stringify(summaryDetails));

  return new Response(JSON.stringify({ success: true, ...summaryDetails }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
