import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Progression chain: est_etapa1 → ... → est_apresentacao → est_proposta → estagnado_final
const PROGRESSION: Record<string, string> = {
  est_etapa1: "est_etapa2",
  est_etapa2: "est_etapa3",
  est_etapa3: "est_etapa4",
  est_etapa4: "est_apresentacao",
  est_apresentacao: "est_proposta",
  est_proposta: "estagnado_final",
};

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MANYCHAT_API_KEY = Deno.env.get("MANYCHAT_API_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch all leads in stagnant funnel (exclude estagnado_final)
    const { data: leads, error: fetchError } = await supabase
      .from("lia_attendances")
      .select("id, nome, telefone_normalized, lead_status, updated_at, produto_interesse")
      .like("lead_status", "est%")
      .neq("lead_status", "estagnado_final")
      .order("updated_at", { ascending: true })
      .limit(500);

    if (fetchError) {
      console.error("[stagnant-processor] Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    let advanced = 0;
    let messagesSent = 0;
    let messagesError = 0;

    // Fetch all automation rules for stagnant stages
    const { data: rules } = await supabase
      .from("cs_automation_rules")
      .select("trigger_event, template_manychat, produto_interesse")
      .eq("ativo", true)
      .like("trigger_event", "est%");

    const rulesMap = new Map<string, { template: string; produto?: string }>();
    if (rules) {
      for (const r of rules) {
        if (r.trigger_event && r.template_manychat) {
          rulesMap.set(r.trigger_event, {
            template: r.template_manychat,
            produto: r.produto_interesse || undefined,
          });
        }
      }
    }

    for (const lead of leads || []) {
      const updatedAt = new Date(lead.updated_at).getTime();
      const elapsed = now - updatedAt;

      if (elapsed < FIVE_DAYS_MS) continue;

      const currentStatus = lead.lead_status;
      const nextStatus = PROGRESSION[currentStatus];
      if (!nextStatus) continue;

      // Advance lead
      const { error: updateError } = await supabase
        .from("lia_attendances")
        .update({ lead_status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", lead.id);

      if (updateError) {
        console.error("[stagnant-processor] Update error for", lead.id, updateError);
        continue;
      }

      advanced++;
      console.log(`[stagnant-processor] ${lead.nome}: ${currentStatus} → ${nextStatus}`);

      // Check if there's a ManyChat rule for the NEW stage
      const rule = rulesMap.get(nextStatus);
      if (rule && MANYCHAT_API_KEY && lead.telefone_normalized) {
        let msgStatus = "skipped";
        let errorDetails: string | null = null;

        try {
          const mcRes = await fetch("https://api.manychat.com/fb/sending/sendFlow", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${MANYCHAT_API_KEY}`,
            },
            body: JSON.stringify({
              subscriber_id: lead.telefone_normalized,
              flow_ns: rule.template,
            }),
          });
          const mcData = await mcRes.json();
          msgStatus = mcRes.ok ? "enviado" : "erro";
          if (!mcRes.ok) errorDetails = JSON.stringify(mcData).slice(0, 500);
          if (mcRes.ok) messagesSent++;
          else messagesError++;
        } catch (mcErr) {
          msgStatus = "erro";
          errorDetails = String(mcErr);
          messagesError++;
        }

        // Log message
        await supabase.from("message_logs").insert({
          lead_id: lead.id,
          tipo: `estagnacao_${nextStatus}`,
          mensagem_preview: `Funil estagnação: ${lead.nome} avançou para ${nextStatus}`,
          status: msgStatus,
          error_details: errorDetails,
        });
      }
    }

    const result = {
      success: true,
      total_in_funnel: leads?.length || 0,
      advanced,
      messages_sent: messagesSent,
      messages_error: messagesError,
    };

    console.log("[stagnant-processor] Result:", JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stagnant-processor] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
