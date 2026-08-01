import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncPiperunActivitiesToTimeline } from "../_shared/piperun-activity-normalizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const limit = Math.min(Number(body.limit ?? 300), 1000);
  const offset = Math.max(Number(body.offset ?? 0), 0);
  const leadId = typeof body.lead_id === "string" ? body.lead_id : null;

  try {
    let q = supabase
      .from("lia_attendances")
      .select("id, piperun_activities")
      .is("merged_into", null)
      .not("piperun_activities", "is", null)
      .order("updated_at", { ascending: false });
    if (leadId) q = q.eq("id", leadId);
    else q = q.range(offset, offset + limit - 1);

    const { data: leads, error } = await q;
    if (error) throw error;

    let inserted = 0;
    let processed = 0;
    const errors: string[] = [];
    for (const lead of (leads || []) as { id: string; piperun_activities: unknown }[]) {
      processed++;
      const res = await syncPiperunActivitiesToTimeline(supabase, lead.id, lead.piperun_activities);
      inserted += res.inserted;
      if (res.error && errors.length < 10) errors.push(`${lead.id}: ${res.error}`);
    }

    const nextOffset = leadId ? null : offset + processed;
    const hasMore = !leadId && processed === limit;

    return new Response(
      JSON.stringify({ ok: true, processed, inserted, errors, next_offset: hasMore ? nextOffset : null, has_more: hasMore }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
