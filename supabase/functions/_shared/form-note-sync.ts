import { addDealNote } from "./piperun-field-map.ts";
import { buildSellerDealSummaryHTML } from "./seller-summary.ts";
import { claimSellerNoteSlot, releaseSellerNoteSlot } from "./seller-note-lock.ts";

/** Refresh only the note; never create, move or reassign a deal. */
export async function syncFormNote(sb: any, leadId: string) {
  const apiKey = Deno.env.get("PIPERUN_API_KEY") || Deno.env.get("PIPERUN_API_TOKEN");
  if (!apiKey) throw new Error("PipeRun note credentials unavailable");
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: lead, error } = await sb.from("lia_attendances").select("*").eq("id", leadId).is("merged_into", null).maybeSingle();
    if (error) throw error;
    if (!lead) throw new Error("Canonical lead not found");
    const dealId = Number(lead.piperun_id);
    if (dealId) {
      const built = await buildSellerDealSummaryHTML(sb, lead, { dealId });
      const claim = await claimSellerNoteSlot(sb, { dealId, leadId, contentHash: built.hash });
      if (!claim.ok && claim.reason === "duplicate_same_hash") return;
      if (claim.ok) {
        const result = await addDealNote(apiKey, dealId, built.html);
        if (result.success) return;
        await releaseSellerNoteSlot(sb, { dealId, contentHash: built.hash });
      }
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 65000));
  }
  throw new Error("CRM note not delivered after retries");
}