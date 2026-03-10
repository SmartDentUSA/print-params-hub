import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      lead_id,
      equipment,
      client_summary,
      support_answers,
      conversation_log,
      session_id,
      lang = "pt-BR",
    } = body;

    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch lead data
    const { data: lead, error: leadErr } = await supabase
      .from("lia_attendances")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Generate ticket_full_id
    const { data: lastTicket } = await supabase
      .from("technical_tickets")
      .select("ticket_sequence, ticket_version")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let ticketSequence: number;
    let ticketVersion: string;

    if (lastTicket) {
      // Same lead returning — keep sequence, increment version
      ticketSequence = lastTicket.ticket_sequence;
      const lastVer = lastTicket.ticket_version || "A";
      ticketVersion = String.fromCharCode(lastVer.charCodeAt(0) + 1);
      if (ticketVersion > "Z") ticketVersion = "Z"; // cap at Z
    } else {
      // New lead — get global max sequence + 1
      const { data: maxSeq } = await supabase
        .from("technical_tickets")
        .select("ticket_sequence")
        .order("ticket_sequence", { ascending: false })
        .limit(1)
        .maybeSingle();

      ticketSequence = (maxSeq?.ticket_sequence || 0) + 1;
      ticketVersion = "A";
    }

    const ticketFullId = `${String(ticketSequence).padStart(10, "0")}-${ticketVersion}`;

    // 3. Generate AI summary
    let aiSummary = "";
    const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const aiModel = "google/gemini-2.0-flash-lite-001";

    if (OPENROUTER_KEY && client_summary) {
      try {
        const summaryPrompt = `Você é uma assistente de suporte técnico da Smart Dent (equipamentos odontológicos digitais).\nGere um resumo técnico estruturado para o chamado de suporte com base nas informações abaixo.\\n\\nEquipamento: ${equipment || "Não especificado"}\\nRespostas do diagnóstico: ${JSON.stringify(support_answers || {})}\\nResumo do cliente: ${client_summary}\\n\\nFormato obrigatório:\\n**Resumo Técnico:**\\n[Descrição objetiva do problema reportado em 2-3 frases]\\n\\n**Possível causa preliminar:**\\n[Hipótese técnica baseada nos sintomas]\\n\\n**Recomendação:**\\n[Ação sugerida: verificação remota, visita técnica, envio de peça, etc.]`;

        const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [{ role: "user", content: summaryPrompt }],
            max_tokens: 500,
            temperature: 0.3,
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          aiSummary = aiData.choices?.[0]?.message?.content || "";
          const usage = extractUsage(aiData);
          logAIUsage({
            functionName: "create-technical-ticket",
            actionLabel: "generate_ai_summary",
            model: aiModel,
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
          }).catch(() => {});
        }
      } catch (e) {
        console.warn("[create-technical-ticket] AI summary error:", e);
      }
    }

    // 4. Save ticket
    const { data: ticket, error: ticketErr } = await supabase
      .from("technical_tickets")
      .insert({
        lead_id,
        ticket_sequence: ticketSequence,
        ticket_version: ticketVersion,
        ticket_full_id: ticketFullId,
        equipment: equipment || null,
        client_summary: client_summary || null,
        ai_summary: aiSummary || null,
        conversation_log: conversation_log || [],
        status: "open",
      })
      .select("id")
      .single();

    if (ticketErr) {
      console.error("[create-technical-ticket] Insert error:", ticketErr);
      return new Response(JSON.stringify({ error: "Erro ao criar ticket", details: ticketErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Save conversation messages
    if (conversation_log && Array.isArray(conversation_log)) {
      const messages = conversation_log.map((msg: { role: string; content: string }) => ({
        ticket_id: ticket.id,
        sender: msg.role === "user" ? "client" : "ai",
        message: msg.content,
      }));
      if (messages.length > 0) {
        await supabase.from("technical_ticket_messages").insert(messages);
      }
    }

    // 6. Build structured WhatsApp message for support team
    const equipmentList: string[] = [];
    if (lead.ativo_print && lead.impressora_modelo) equipmentList.push(`🖨️ ${lead.impressora_modelo}`);
    if (lead.ativo_scan && lead.equip_scanner) equipmentList.push(`📷 ${lead.equip_scanner}`);
    if (lead.ativo_cura && lead.equip_pos_impressao) equipmentList.push(`☀️ ${lead.equip_pos_impressao}`);
    if (lead.ativo_cad && lead.equip_cad) equipmentList.push(`💻 ${lead.equip_cad}`);
    if (lead.ativo_notebook && lead.equip_notebook) equipmentList.push(`💻 ${lead.equip_notebook}`);

    const purchaseInfo: string[] = [];
    if (lead.lojaintegrada_ultimo_pedido_numero) {
      purchaseInfo.push(`Pedido #${lead.lojaintegrada_ultimo_pedido_numero} - R$${lead.lojaintegrada_ultimo_pedido_valor || "?"}`);
    }
    if (lead.insumos_adquiridos) {
      purchaseInfo.push(`Insumos: ${lead.insumos_adquiridos}`);
    }

    const coursesInfo = lead.astron_courses_total
      ? `${lead.astron_courses_completed || 0}/${lead.astron_courses_total} cursos`
      : "Sem cursos";

    const historyInfo = lead.total_sessions
      ? `${lead.total_sessions} sessões, ${lead.total_messages || 0} mensagens`
      : "Primeiro contato";

    // Build support answers block
    let diagBlock = "";
    if (support_answers) {
      const labels: Record<string, string> = {
        behavior: "Comportamento/Erro",
        when_started: "Quando começou",
        screen_message: "Mensagem na tela",
      };
      diagBlock = Object.entries(support_answers)
        .filter(([, v]) => v)
        .map(([k, v]) => `• ${labels[k] || k}: ${v}`)
        .join("\n");
    }

    // Trim conversation log for WhatsApp
    const convoPreview = (conversation_log || [])
      .slice(-10) // last 10 messages
      .map((m: { role: string; content: string }) => `${m.role === "user" ? "👤" : "🤖"} ${(m.content || "").slice(0, 200)}`)
      .join("\n");

    const whatsappMessage = `🚨 *NOVO CHAMADO TÉCNICO*\\nSmart Dent Suporte\\n\\n*Chamado:* ${ticketFullId}\\n\\n*Cliente:* ${lead.nome}\\n*Telefone:* ${lead.telefone_normalized || lead.telefone_raw || "N/A"}\\n*E-mail:* ${lead.email}\\n*Cidade:* ${lead.cidade || "N/A"} ${lead.uf ? `- ${lead.uf}` : ""}\\n\\n*Equipamentos registrados:*\\n${equipmentList.length > 0 ? equipmentList.join("\\n") : "Nenhum registrado"}\\n\\n*Compras registradas:*\\n${purchaseInfo.length > 0 ? purchaseInfo.join("\\n") : "Sem compras registradas"}\\n\\n*Cursos Smart Dent Academy:*\\n${coursesInfo}\\n\\n*Histórico de atendimentos:*\\n${historyInfo}\\n\\n---\\n\\n*Equipamento com problema:*\\n${equipment || "Não especificado"}\\n\\n${diagBlock ? `*Diagnóstico:*\\n${diagBlock}\\n` : ""}\\n*Resumo do cliente:*\\n"${client_summary || "Não fornecido"}"\\n\\n*Resumo IA:*\\n${aiSummary || "Não gerado"}\\n\\n---\\n\\n*Histórico de conversa:*\\n${convoPreview || "[sem histórico]"}\\n\\n---\\n\\n⚡ *Ação recomendada:* Contato técnico prioritário.\\nAbrir atendimento e atualizar ticket.`;

    // 7. Send WhatsApp notification to support team
    // Find support team member (Patrícia or first available)
    const { data: supportMember } = await supabase
      .from("team_members")
      .select("id, waleads_api_key, nome_completo, whatsapp_number")
      .eq("ativo", true)
      .not("waleads_api_key", "is", null)
      .order("nome_completo")
      .limit(5);

    // Prefer member whose name contains "Patricia" or "Patrícia", else first
    const patricia = supportMember?.find((m: { nome_completo: string }) => /patr[íi]cia/i.test(m.nome_completo));
    const teamMember = patricia || supportMember?.[0];

    let notificationStatus = "not_sent";

    if (teamMember) {
      try {
        // Send to support WhatsApp number (16 3419-4735)
        const supportPhone = "551634194735";
        
        const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-send-waleads`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            team_member_id: teamMember.id,
            phone: supportPhone,
            tipo: "text",
            message: whatsappMessage,
            lead_id,
          }),
        });

        const sendResult = await sendResp.json();
        notificationStatus = sendResult.success ? "sent" : "failed";
        console.log(`[create-technical-ticket] WhatsApp notification: ${notificationStatus}`, sendResult);

        // Update ticket with notification status
        await supabase.from("technical_tickets")
          .update({ 
            notified_at: notificationStatus === "sent" ? new Date().toISOString() : null,
            support_team_member_id: teamMember.id,
          })
          .eq("id", ticket.id);
      } catch (e) {
        console.warn("[create-technical-ticket] WhatsApp send error:", e);
        notificationStatus = "error";
      }
    }

    // 8. Update lead SDR support fields
    await supabase.from("lia_attendances")
      .update({
        sdr_suporte_equipamento: equipment || null,
        sdr_suporte_tipo: "chamado_tecnico",
        sdr_suporte_descricao: (client_summary || "").slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead_id);

    return new Response(JSON.stringify({
      success: true,
      ticket_id: ticket.id,
      ticket_full_id: ticketFullId,
      notification_status: notificationStatus,
      ai_summary: aiSummary || null,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[create-technical-ticket] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
