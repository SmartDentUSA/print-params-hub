/**
 * Per-deal seller-note lock. Replaces the per-lead lock in `lia_attendances`,
 * which let duplicates through whenever a single lead had several open deals
 * (the note hash differs because the CRM block changes per deal).
 *
 * Contract:
 *   - One row per `deal_id` in `smartops_deal_note_locks`.
 *   - `claimSellerNoteSlot` atomically inserts/updates the row and returns
 *     `true` only when this caller "wins" the slot (new deal OR content
 *     actually changed OR previous post older than 24h).
 *   - `releaseSellerNoteSlot` clears the row when the actual PipeRun POST
 *     fails, so the next retry can grab the slot again.
 *
 * Also enforces a 60s anti-burst floor PER LEAD across all deals — meant
 * only to absorb Meta redelivery storms, not to suppress legitimate notes
 * on different deals.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

const TTL_SECONDS = 24 * 60 * 60;
const BURST_FLOOR_SECONDS = 60;

export interface ClaimResult {
  ok: boolean;
  reason?: "duplicate_same_hash" | "lead_burst_floor" | "claim_error";
}

/**
 * Atomic claim backed by the SQL function `public.try_claim_seller_note_slot`.
 * The single-statement upsert inside the function eliminates the TOCTOU race
 * the previous read+upsert had. All three callers (lia-assign, deal-form-note,
 * piperun-webhook) now share one lock, so cross-path duplicates are blocked too.
 */
export async function claimSellerNoteSlot(
  supabase: SupabaseClient,
  params: { dealId: number; leadId: string | null | undefined; contentHash: string },
): Promise<ClaimResult> {
  const { dealId, leadId, contentHash } = params;
  if (!dealId || !contentHash) return { ok: false, reason: "claim_error" };

  const { data, error } = await supabase.rpc("try_claim_seller_note_slot", {
    p_deal_id: dealId,
    p_lead_id: leadId ?? null,
    p_content_hash: contentHash,
    p_ttl_seconds: TTL_SECONDS,
    p_burst_floor_seconds: BURST_FLOOR_SECONDS,
  });
  if (error) {
    console.warn("[seller-note-lock] rpc failed (proceeding without lock):", error);
    return { ok: true };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const claimed = !!row?.claimed;
  if (claimed) return { ok: true };
  const reason = (row?.reason as ClaimResult["reason"]) || "duplicate_same_hash";
  return { ok: false, reason };
}

export async function releaseSellerNoteSlot(
  supabase: SupabaseClient,
  params: { dealId: number; contentHash: string },
): Promise<void> {
  try {
    await supabase.rpc("release_seller_note_slot", {
      p_deal_id: params.dealId,
      p_content_hash: params.contentHash,
    });
  } catch (e) {
    console.warn("[seller-note-lock] release failed:", e);
  }
}