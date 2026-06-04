import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// One-off replay tool: re-posts the latest `skipped_no_email` raw_payload(s)
// from `piperun_webhook_events` to the live webhook so they can be reprocessed
// with the current identity-preservation logic.
//
// Query params:
//   ?deals=56872930,60442502   (comma-separated; default = top 10 most recent
//                                deal_ids with outcome=skipped_no_email in
//                                the last 24h)

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const url = new URL(req.url);
  const dealsParam = url.searchParams.get("deals");
  let dealIds: string[] = [];

  if (dealsParam) {
    dealIds = dealsParam.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    const { data } = await supabase
      .from("piperun_webhook_events")
      .select("deal_id, received_at")
      .eq("outcome", "skipped_no_email")
      .gte("received_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order("received_at", { ascending: false })
      .limit(200);
    const seen = new Set<string>();
    for (const row of (data || []) as Array<{ deal_id: string }>) {
      if (row.deal_id && !seen.has(row.deal_id)) {
        seen.add(row.deal_id);
        dealIds.push(row.deal_id);
      }
      if (dealIds.length >= 25) break;
    }
  }

  const webhookUrl = `${SUPABASE_URL}/functions/v1/smart-ops-piperun-webhook`;
  const results: Array<Record<string, unknown>> = [];

  for (const dealId of dealIds) {
    const { data: ev } = await supabase
      .from("piperun_webhook_events")
      .select("raw_payload, received_at, outcome, error")
      .eq("deal_id", dealId)
      .eq("outcome", "skipped_no_email")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ev?.raw_payload) {
      results.push({ deal_id: dealId, replayed: false, reason: "no_payload" });
      continue;
    }
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ev.raw_payload),
      });
      const text = await res.text();
      results.push({
        deal_id: dealId,
        replayed: true,
        status: res.status,
        response: text.slice(0, 300),
      });
    } catch (e) {
      results.push({ deal_id: dealId, replayed: false, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ count: results.length, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});