import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addDealNote } from "../_shared/piperun-field-map.ts";
import { buildSellerDealSummaryHTML } from "../_shared/seller-summary.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getPiperunDealId(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  retries = 4,
  delayMs = 4000,
): Promise<number | null> {
  for (let i = 0; i < retries; i++) {
    const { data } = await supabase
      .from("lia_attendances")
      .select("piperun_id")
      .eq("id", leadId)
      .maybeSingle();

    if (data?.piperun_id) return Number(data.piperun_id);

    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { lead_id, form_name, responses } = await req.json();

    if (!lead_id || !responses?.length) {
      return json({ error: "lead_id and responses are required" }, 400);
    }

    const PIPERUN_API_KEY = Deno.env.get("PIPERUN_API_KEY") || Deno.env.get("PIPERUN_API_TOKEN");
    if (!PIPERUN_API_KEY) {
      return json({ error: "PIPERUN_API_KEY not configured" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Wait for lia-assign to populate piperun_id (runs in parallel)
    const dealId = await getPiperunDealId(supabase, lead_id);

    if (!dealId) {
      console.warn(`[deal-form-note] No piperun_id found for lead ${lead_id} after retries`);
      return json({ ok: false, reason: "no_deal_id" });
    }

    // Build full seller summary with the just-submitted form highlighted
    const { data: fullLead } = await supabase
      .from("lia_attendances")
      .select("*")
      .eq("id", lead_id)
      .single();

    let noteText: string;
    let hash: string | null = null;
    if (fullLead) {
      const built = await buildSellerDealSummaryHTML(
        supabase,
        fullLead as Record<string, unknown>,
        { highlightFormName: form_name, highlightFormResponses: responses },
      );
      noteText = built.html;
      hash = built.hash;

      // ── Idempotency: skip if same hash was just posted (re-delivery loop) ──
      const lastHash = (fullLead as Record<string, unknown>).last_seller_note_hash as string | null;
      const lastAt = (fullLead as Record<string, unknown>).last_seller_note_at as string | null;
      if (lastHash && lastHash === hash) {
        console.log(`[deal-form-note] Skipping duplicate note (hash match) for lead ${lead_id}`);
        return json({ ok: true, deal_id: dealId, duplicate_skipped: true });
      }
      // Floor: never post two notes within 5 minutes for the same lead
      if (lastAt) {
        const ageMs = Date.now() - new Date(lastAt).getTime();
        if (ageMs < 5 * 60 * 1000) {
          console.log(`[deal-form-note] Skipping note (posted ${Math.round(ageMs / 1000)}s ago) for lead ${lead_id}`);
          return json({ ok: true, deal_id: dealId, throttled: true });
        }
      }
    } else {
      const lines = responses.map(
        (r: { label: string; value: string }) => `• <b>${r.label}:</b> ${r.value}<br>`,
      );
      noteText = `<b>📝 Respostas do Formulário: ${form_name || "Formulário"}</b><br><br>${lines.join("")}`;
    }

    const result = await addDealNote(PIPERUN_API_KEY, dealId, noteText);
    if (result.success && hash) {
      await supabase.from("lia_attendances").update({
        last_seller_note_hash: hash,
        last_seller_note_at: new Date().toISOString(),
      }).eq("id", lead_id);
    }

    console.log(`[deal-form-note] Note added to deal ${dealId} for lead ${lead_id}:`, result.success);

    return json({ ok: true, deal_id: dealId });
  } catch (err) {
    console.error("[deal-form-note] Error:", err);
    return json({ error: String(err) }, 500);
  }
});
