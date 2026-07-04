// Cron horária: para cada régua ativa, agenda/dispara o próximo step
// para leads que atendem o filtro de audiência e ainda não receberam esse step.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const nowIso = now.toISOString();

    // 1) Fetch active sequences
    const { data: seqs, error: seqErr } = await supabase
      .from("email_sequences")
      .select("id, name, produto_id, audience_filter, stop_condition, status, activated_at")
      .eq("status", "active");
    if (seqErr) throw seqErr;

    const summary: Array<Record<string, unknown>> = [];

    for (const seq of seqs || []) {
      const { data: steps } = await supabase
        .from("email_sequence_steps")
        .select("*")
        .eq("sequence_id", seq.id)
        .eq("active", true)
        .order("step_order", { ascending: true });
      if (!steps || !steps.length) continue;

      // Resolve audience (canonical leads with email)
      const f = (seq.audience_filter as any) || {};
      let q = supabase.from("lia_attendances")
        .select("id, nome, email")
        .is("merged_into", null)
        .not("email", "is", null)
        .neq("email", "")
        .limit(5000);
      if (f.uf) q = q.eq("uf", f.uf);
      if (f.etapa_funil) q = q.eq("etapa_funil", f.etapa_funil);
      if (f.produto_interesse) q = q.eq("produto_interesse", f.produto_interesse);
      if (f.temperatura) q = q.eq("temperatura", f.temperatura);
      const { data: leads } = await q;

      let scheduled = 0, dispatched = 0, skipped = 0, errors = 0;

      for (const lead of leads || []) {
        // Existing dispatches for this lead in this sequence
        const { data: existing } = await supabase
          .from("email_sequence_dispatches")
          .select("step_id, status, scheduled_for")
          .eq("sequence_id", seq.id)
          .eq("lead_id", lead.id);
        const doneStepIds = new Set((existing || []).map((d: any) => d.step_id));
        const stoppedAlready = (existing || []).some((d: any) => d.status === "stopped");
        if (stoppedAlready) { skipped++; continue; }

        // Find next unscheduled step
        const nextStep = steps.find((s: any) => !doneStepIds.has(s.id));
        if (!nextStep) { skipped++; continue; }

        // Compute scheduled_for based on the previous dispatched_at (or sequence start)
        const previous = (existing || []).filter((d: any) => d.status === "dispatched");
        const baseTime = previous.length
          ? new Date(Math.max(...previous.map((p: any) => new Date(p.scheduled_for).getTime())))
          : new Date(seq.activated_at || nowIso);
        const scheduledFor = new Date(baseTime);
        scheduledFor.setDate(scheduledFor.getDate() + (nextStep.delay_days || 0));
        scheduledFor.setHours(nextStep.send_hour || 9, 0, 0, 0);

        if (scheduledFor.getTime() > now.getTime()) {
          // Not yet due — record pending and continue
          const { error: pErr } = await supabase
            .from("email_sequence_dispatches").insert({
              sequence_id: seq.id, step_id: nextStep.id, lead_id: lead.id,
              scheduled_for: scheduledFor.toISOString(), status: "pending",
            }).select("id").single();
          if (!pErr) scheduled++;
          continue;
        }

        // Check stop condition (based on any previous send_log for THIS sequence)
        if (seq.stop_condition && seq.stop_condition !== "none" && previous.length) {
          const sendLogIds = (existing || [])
            .map((d: any) => d.send_log_id).filter(Boolean);
          if (sendLogIds.length) {
            const { data: logs } = await supabase
              .from("campaign_send_log")
              .select("clicked_at, opened_at")
              .in("id", sendLogIds);
            const clicked = (logs || []).some((l: any) => l.clicked_at);
            const opened = (logs || []).some((l: any) => l.opened_at);
            if (seq.stop_condition === "clicked" && clicked) {
              await supabase.from("email_sequence_dispatches").insert({
                sequence_id: seq.id, step_id: nextStep.id, lead_id: lead.id,
                scheduled_for: nowIso, status: "stopped",
              });
              skipped++; continue;
            }
            if (seq.stop_condition === "opened" && opened) {
              await supabase.from("email_sequence_dispatches").insert({
                sequence_id: seq.id, step_id: nextStep.id, lead_id: lead.id,
                scheduled_for: nowIso, status: "stopped",
              });
              skipped++; continue;
            }
          }
        }

        // Dispatch via send-gmail (single-lead) — reuse test_email path to keep it 1:1
        try {
          const invokeRes = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/smart-ops-send-gmail`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                campaign_name: `Régua: ${seq.name} · #${nextStep.step_order}`,
                description: `sequence:${seq.id} step:${nextStep.id}`,
                subject: nextStep.subject_template,
                preheader: nextStep.preheader_template,
                html: nextStep.html_template,
                cta_config: nextStep.cta_config,
                test_email: lead.email, // send to a single lead
              }),
            },
          );
          const j = await invokeRes.json().catch(() => ({}));
          await supabase.from("email_sequence_dispatches").insert({
            sequence_id: seq.id, step_id: nextStep.id, lead_id: lead.id,
            scheduled_for: nowIso, dispatched_at: nowIso,
            status: invokeRes.ok ? "dispatched" : "error",
            error_message: invokeRes.ok ? null : JSON.stringify(j).slice(0, 400),
          });
          if (invokeRes.ok) dispatched++; else errors++;
        } catch (e) {
          errors++;
          console.error("[sequence-tick] dispatch error", e);
        }
      }

      summary.push({ sequence: seq.name, dispatched, scheduled, skipped, errors });
    }

    return new Response(JSON.stringify({ ok: true, summary, at: nowIso }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sequence-tick] fatal", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});