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
    const payload = await req.json();

    console.log("[piperun-webhook] Payload:", JSON.stringify(payload).slice(0, 500));

    const dealId = String(payload.deal?.id || payload.id || payload.deal_id || "");
    const ownerName = payload.deal?.owner?.name || payload.owner_name || null;
    const ownerEmail = payload.deal?.owner?.email || payload.owner_email || null;
    const stageName = payload.deal?.stage?.name || payload.stage_name || null;

    if (!dealId) {
      return new Response(JSON.stringify({ error: "deal_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update lead CRM fields
    const updateData: Record<string, unknown> = {};
    if (ownerName) updateData.proprietario_lead_crm = ownerName;
    if (stageName) updateData.status_atual_lead_crm = stageName;

    const { data: lead, error: updateError } = await supabase
      .from("lia_attendances")
      .update(updateData)
      .eq("piperun_id", dealId)
      .select("id, nome, telefone_normalized, produto_interesse")
      .single();

    if (updateError || !lead) {
      console.warn("[piperun-webhook] Lead não encontrado para deal:", dealId);
      return new Response(JSON.stringify({ error: "Lead não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find team member by owner email
    let teamMember = null;
    if (ownerEmail) {
      const { data } = await supabase
        .from("team_members")
        .select("id, whatsapp_number, nome_completo")
        .eq("email", ownerEmail)
        .eq("ativo", true)
        .single();
      teamMember = data;
    }

    // Send ManyChat message if we have the subscriber phone
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
            flow_ns: "boas_vindas_lead",
          }),
        });
        const mcData = await mcRes.json();
        messageStatus = mcRes.ok ? "enviado" : "erro";
        if (!mcRes.ok) errorDetails = JSON.stringify(mcData).slice(0, 500);
        console.log("[piperun-webhook] ManyChat response:", messageStatus);
      } catch (mcErr) {
        messageStatus = "erro";
        errorDetails = String(mcErr);
        console.error("[piperun-webhook] ManyChat error:", mcErr);
      }
    }

    // Log message
    await supabase.from("message_logs").insert({
      lead_id: lead.id,
      team_member_id: teamMember?.id || null,
      whatsapp_number: teamMember?.whatsapp_number || null,
      tipo: "boas_vindas",
      mensagem_preview: `Atribuição de ${ownerName || "vendedor"} para ${lead.nome}`,
      status: messageStatus,
      error_details: errorDetails,
    });

    return new Response(JSON.stringify({ success: true, lead_id: lead.id, message_status: messageStatus }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[piperun-webhook] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
