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

const LEAD_BURST_FLOOR_MS = 60 * 1000;
const SAME_HASH_TTL_MS = 24 * 60 * 60 * 1000;

export interface ClaimResult {
  ok: boolean;
  reason?: "duplicate_same_hash" | "lead_burst_floor" | "claim_error";
}

export async function claimSellerNoteSlot(
  supabase: SupabaseClient,
  params: { dealId: number; leadId: string | null | undefined; contentHash: string },
): Promise<ClaimResult> {
  const { dealId, leadId, contentHash } = params;
  if (!dealId || !contentHash) return { ok: false, reason: "claim_error" };

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // ── 1. Read current state for this deal_id ──
  const { data: existing, error: readErr } = await supabase
    .from("smartops_deal_note_locks")
    .select("content_hash,posted_at,lead_id")
    .eq("deal_id", dealId)
    .maybeSingle();
  if (readErr) {
    console.warn("[seller-note-lock] read failed (proceeding without lock):", readErr);
    return { ok: true };
  }

  if (existing) {
    const prevMs = existing.posted_at ? new Date(existing.posted_at as string).getTime() : 0;
    const sameHash = existing.content_hash === contentHash;
    if (sameHash && nowMs - prevMs < SAME_HASH_TTL_MS) {
      return { ok: false, reason: "duplicate_same_hash" };
    }
  }

  // ── 2. Per-lead anti-burst floor (60s) ──
  if (leadId) {
    const cutoffIso = new Date(nowMs - LEAD_BURST_FLOOR_MS).toISOString();
    const { data: burst } = await supabase
      .from("smartops_deal_note_locks")
      .select("deal_id")
      .eq("lead_id", leadId)
      .gt("posted_at", cutoffIso)
      .neq("deal_id", dealId)
      .limit(1);
    if (burst && burst.length > 0) {
      return { ok: false, reason: "lead_burst_floor" };
    }
  }

  // ── 3. Upsert the slot ──
  const { error: upErr } = await supabase
    .from("smartops_deal_note_locks")
    .upsert({
      deal_id: dealId,
      lead_id: leadId ?? null,
      content_hash: contentHash,
      posted_at: nowIso,
      updated_at: nowIso,
    }, { onConflict: "deal_id" });
  if (upErr) {
    console.warn("[seller-note-lock] upsert failed (proceeding without lock):", upErr);
    return { ok: true };
  }

  return { ok: true };
}

export async function releaseSellerNoteSlot(
  supabase: SupabaseClient,
  params: { dealId: number; contentHash: string },
): Promise<void> {
  try {
    await supabase
      .from("smartops_deal_note_locks")
      .delete()
      .eq("deal_id", params.dealId)
      .eq("content_hash", params.contentHash);
  } catch (e) {
    console.warn("[seller-note-lock] release failed:", e);
  }
}