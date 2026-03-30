import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  piperunGet,
  buildRichDealSnapshot,
  upsertDealHistory,
  callNormalizeFromLead,
  type RichDealSnapshot,
} from "../_shared/piperun-field-map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY");

    if (!PIPERUN_API_KEY) {
      return new Response(JSON.stringify({ error: "PIPERUN_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { deal_ids, lead_ids, auto_detect = false, limit = 50 } = body as {
      deal_ids?: string[];
      lead_ids?: string[];
      auto_detect?: boolean;
      limit?: number;
    };

    interface BackfillTarget {
      lead_id: string;
      deal_id: string;
      current_history: RichDealSnapshot[];
    }

    const targets: BackfillTarget[] = [];

    if (deal_ids && deal_ids.length > 0) {
      // Strategy: find leads by piperun_id match first, then scan their history
      const leadMap = new Map<string, { id: string; history: RichDealSnapshot[] }>();

      for (const dealIdTarget of deal_ids) {
        if (leadMap.has(dealIdTarget)) continue;

        // Try finding lead by piperun_id
        const { data: byPiperun } = await supabase
          .from("lia_attendances")
          .select("id, piperun_deals_history")
          .eq("piperun_id", dealIdTarget)
          .maybeSingle();

        if (byPiperun) {
          const history = (byPiperun.piperun_deals_history || []) as RichDealSnapshot[];
          const snap = history.find((d) => String(d.deal_id) === String(dealIdTarget));
          if (snap) {
            targets.push({ lead_id: byPiperun.id, deal_id: dealIdTarget, current_history: history });
            leadMap.set(dealIdTarget, { id: byPiperun.id, history });
            continue;
          }
        }
      }

      // For deals not found by piperun_id, search via lead_ids if provided
      const remainingDeals = deal_ids.filter((d) => !leadMap.has(d));
      if (remainingDeals.length > 0 && lead_ids && lead_ids.length > 0) {
        for (const lid of lead_ids) {
          const { data: lead } = await supabase
            .from("lia_attendances")
            .select("id, piperun_deals_history")
            .eq("id", lid)
            .maybeSingle();
          if (!lead) continue;
          const history = (lead.piperun_deals_history || []) as RichDealSnapshot[];
          for (const dealIdTarget of remainingDeals) {
            const snap = history.find((d) => String(d.deal_id) === String(dealIdTarget));
            if (snap) {
              targets.push({ lead_id: lead.id, deal_id: dealIdTarget, current_history: history });
            }
          }
        }
      }

      // Last resort: scan with JSONB contains for any still-missing deals
      const foundDealIds = new Set(targets.map((t) => t.deal_id));
      const stillMissing = deal_ids.filter((d) => !foundDealIds.has(d));
      for (const dealIdTarget of stillMissing) {
        // Use raw SQL-like search via ilike on the text representation
        const { data: leads } = await supabase
          .from("lia_attendances")
          .select("id, piperun_deals_history")
          .not("piperun_deals_history", "is", null)
          .like("piperun_deals_history::text", `%"deal_id":"${dealIdTarget}"%`)
          .limit(5);

        for (const lead of leads || []) {
          const history = (lead.piperun_deals_history || []) as RichDealSnapshot[];
          const snap = history.find((d) => String(d.deal_id) === String(dealIdTarget));
          if (snap) {
            targets.push({ lead_id: lead.id, deal_id: dealIdTarget, current_history: history });
          }
        }
      }
    } else if (auto_detect) {
      // Find leads with deals that have value > 0 but empty proposals
      const { data: leads, error } = await supabase
        .from("lia_attendances")
        .select("id, piperun_deals_history")
        .not("piperun_deals_history", "is", null);

      if (error) throw error;

      let count = 0;
      for (const lead of leads || []) {
        if (count >= limit) break;
        const history = lead.piperun_deals_history as RichDealSnapshot[];
        if (!Array.isArray(history)) continue;

        for (const snap of history) {
          if (count >= limit) break;
          const hasEmptyProposals = !snap.proposals || snap.proposals.length === 0;
          const hasValue = (snap.value ?? 0) > 0;
          if (hasEmptyProposals && hasValue) {
            targets.push({
              lead_id: lead.id,
              deal_id: String(snap.deal_id),
              current_history: history,
            });
            count++;
          }
        }
      }
    } else {
      return new Response(JSON.stringify({ error: "Provide deal_ids or set auto_detect: true" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[backfill-deal-proposals] Found ${targets.length} targets`);

    const details: Array<{ deal_id: string; lead_id: string; status: string; items_count?: number }> = [];
    let backfilled = 0;
    let errors = 0;

    // Group targets by lead_id so we update each lead only once
    const byLead = new Map<string, { history: RichDealSnapshot[]; dealIds: string[] }>();
    for (const t of targets) {
      if (!byLead.has(t.lead_id)) {
        byLead.set(t.lead_id, { history: [...t.current_history], dealIds: [] });
      }
      byLead.get(t.lead_id)!.dealIds.push(t.deal_id);
    }

    for (const [leadId, { history, dealIds }] of byLead.entries()) {
      let updatedHistory = [...history];
      let anyUpdated = false;

      for (const dealId of dealIds) {
        try {
          // Fetch deal from PipeRun with proposals
          const result = await piperunGet(PIPERUN_API_KEY, `deals/${dealId}`, {}, {
            "with[]": ["proposals", "proposals.items", "person", "company", "origin", "stage"],
          });

          if (!result.success || !result.data) {
            console.warn(`[backfill] Failed to fetch deal ${dealId}:`, result.status);
            details.push({ deal_id: dealId, lead_id: leadId, status: "api_error" });
            errors++;
            continue;
          }

          const dealData = (result.data as Record<string, unknown>).data as Record<string, unknown> | undefined;
          if (!dealData) {
            details.push({ deal_id: dealId, lead_id: leadId, status: "no_data" });
            errors++;
            continue;
          }

          // Find existing snapshot to preserve overrides
          const existingSnap = updatedHistory.find((d) => String(d.deal_id) === String(dealId));

          const newSnapshot = buildRichDealSnapshot(
            dealData as any,
            {
              dealId,
              product: existingSnap?.product || null,
              ownerName: existingSnap?.owner_name || null,
              ownerEmail: existingSnap?.owner_email || null,
            },
          );

          const totalItems = newSnapshot.proposals.reduce((s, p) => s + p.items.length, 0);
          console.log(`[backfill] Deal ${dealId}: ${newSnapshot.proposals.length} proposals, ${totalItems} items`);

          updatedHistory = upsertDealHistory(updatedHistory, newSnapshot);
          anyUpdated = true;
          backfilled++;
          details.push({ deal_id: dealId, lead_id: leadId, status: "ok", items_count: totalItems });
        } catch (e) {
          console.error(`[backfill] Error processing deal ${dealId}:`, e);
          details.push({ deal_id: dealId, lead_id: leadId, status: "error" });
          errors++;
        }
      }

      if (anyUpdated) {
        const { error: updateError } = await supabase
          .from("lia_attendances")
          .update({ piperun_deals_history: updatedHistory, updated_at: new Date().toISOString() })
          .eq("id", leadId);

        if (updateError) {
          console.error(`[backfill] Failed to update lead ${leadId}:`, updateError);
        } else {
          // Propagate to normalized tables
          await callNormalizeFromLead(supabase, leadId);
          console.log(`[backfill] Lead ${leadId} updated and normalized`);
        }
      }
    }

    return new Response(JSON.stringify({ backfilled, errors, total_targets: targets.length, details }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[backfill-deal-proposals] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
