import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const processed: Array<Record<string, unknown>> = [];
  const errors: Array<Record<string, unknown>> = [];

  try {
    // Pega itens não processados com idade > 30s (deixa o ingest-lead normal
    // tentar primeiro caso o webhook do Meta esteja a caminho).
    const cutoff = new Date(Date.now() - 30_000).toISOString();
    const { data: queue, error: qErr } = await supabase
      .from("enrichment_safety_queue")
      .select("id, lead_id, source, old_form_name, new_form_name, attempt_count")
      .is("processed_at", null)
      .lte("detected_at", cutoff)
      .lt("attempt_count", 5)
      .order("detected_at", { ascending: true })
      .limit(20);

    if (qErr) throw qErr;
    if (!queue || queue.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const item of queue) {
      // Marca attempt
      await supabase
        .from("enrichment_safety_queue")
        .update({ attempt_count: (item.attempt_count ?? 0) + 1 })
        .eq("id", item.id);

      try {
        // Verifica que o lead canônico ainda é Meta e tem pessoa no PipeRun
        // (caso contrário a régua não tem o que fazer).
        const { data: lead } = await supabase
          .from("lia_attendances")
          .select("id, source, form_name, pessoa_piperun_id, merged_into")
          .eq("id", item.lead_id)
          .maybeSingle();

        if (!lead || lead.merged_into || lead.source !== "meta_lead_ads" || !lead.pessoa_piperun_id) {
          await supabase
            .from("enrichment_safety_queue")
            .update({
              processed_at: new Date().toISOString(),
              processing_result: {
                skipped: true,
                reason: !lead
                  ? "lead_missing"
                  : lead.merged_into
                    ? "lead_merged"
                    : lead.source !== "meta_lead_ads"
                      ? "source_changed"
                      : "no_piperun_person",
              },
            })
            .eq("id", item.id);
          processed.push({ id: item.id, skipped: true });
          continue;
        }

        const { data: routeData, error: routeErr } = await supabase.functions.invoke(
          "smart-ops-lia-assign",
          {
            body: {
              lead_id: item.lead_id,
              enrichment_only_route_deal: true,
              enrichment_form_name: lead.form_name || item.new_form_name,
              trigger: "enrichment_safety_net",
              safety_queue_id: item.id,
            },
          },
        );

        if (routeErr) throw routeErr;

        await supabase
          .from("enrichment_safety_queue")
          .update({
            processed_at: new Date().toISOString(),
            processing_result: (routeData as Record<string, unknown>) ?? { ok: true },
          })
          .eq("id", item.id);

        processed.push({ id: item.id, lead_id: item.lead_id, ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ id: item.id, lead_id: item.lead_id, error: msg });
        await supabase
          .from("enrichment_safety_queue")
          .update({ last_error: msg })
          .eq("id", item.id);
        // log
        try {
          await supabase.from("system_health_logs").insert({
            function_name: "enrichment-safety-net-cron",
            severity: "error",
            error_type: "safety_net_dispatch_failed",
            lead_id: item.lead_id,
            details: { error: msg, queue_id: item.id },
          });
        } catch {}
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: processed.length, errors: errors.length, items: processed, error_items: errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[enrichment-safety-net-cron] fatal:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});