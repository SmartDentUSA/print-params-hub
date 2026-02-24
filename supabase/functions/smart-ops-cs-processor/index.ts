import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const MANYCHAT_API_KEY = Deno.env.get("MANYCHAT_API_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch active automation rules
    const { data: rules, error: rulesError } = await supabase
      .from("cs_automation_rules")
      .select("*")
      .eq("ativo", true);

    if (rulesError || !rules?.length) {
      console.log("[cs-processor] Nenhuma regra ativa encontrada");
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch CS team member
    const { data: csMember } = await supabase
      .from("team_members")
      .select("id, whatsapp_number, nome_completo")
      .eq("role", "cs")
      .eq("ativo", true)
      .limit(1)
      .single();

    let totalProcessed = 0;

    for (const rule of rules) {
      // Find eligible leads: status matches trigger, contract date + delay <= now, no prior log
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (rule.delay_days || 0));

      const { data: leads } = await supabase
        .from("lia_attendances")
        .select("id, nome, telefone_normalized, produto_interesse")
        .eq("status_atual_lead_crm", rule.trigger_event)
        .not("data_contrato", "is", null)
        .lte("data_contrato", cutoffDate.toISOString());

      if (!leads?.length) continue;

      for (const lead of leads) {
        // Check if message already sent for this lead + rule combo
        const { data: existingLog } = await supabase
          .from("message_logs")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("tipo", `cs_${rule.template_manychat}`)
          .limit(1);

        if (existingLog?.length) continue;

        // Send via ManyChat
        let messageStatus = "skipped";
        let errorDetails: string | null = null;

        if (MANYCHAT_API_KEY && lead.telefone_normalized) {
          try {
            const mcRes = await fetch("https://api.manychat.com/fb/sending/sendFlow", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${MANYCHAT_API_KEY}`,
              },
              body: JSON.stringify({
                subscriber_id: lead.telefone_normalized,
                flow_ns: rule.template_manychat,
              }),
            });
            const mcData = await mcRes.json();
            messageStatus = mcRes.ok ? "enviado" : "erro";
            if (!mcRes.ok) errorDetails = JSON.stringify(mcData).slice(0, 500);
          } catch (mcErr) {
            messageStatus = "erro";
            errorDetails = String(mcErr);
          }
        }

        // Log
        await supabase.from("message_logs").insert({
          lead_id: lead.id,
          team_member_id: csMember?.id || null,
          whatsapp_number: csMember?.whatsapp_number || null,
          tipo: `cs_${rule.template_manychat}`,
          mensagem_preview: `CS ${rule.tipo}: ${rule.template_manychat} para ${lead.nome}`,
          status: messageStatus,
          error_details: errorDetails,
        });

        totalProcessed++;
      }
    }

    console.log(`[cs-processor] Processados: ${totalProcessed}`);
    return new Response(JSON.stringify({ success: true, processed: totalProcessed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[cs-processor] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
