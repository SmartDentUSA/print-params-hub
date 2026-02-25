import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

interface OutreachCandidate {
  id: string;
  nome: string;
  email: string;
  telefone_normalized: string | null;
  lead_status: string;
  temperatura_lead: string | null;
  produto_interesse: string | null;
  impressora_modelo: string | null;
  area_atuacao: string | null;
  resumo_historico_ia: string | null;
  proactive_sent_at: string | null;
  proactive_count: number;
  updated_at: string;
  proprietario_lead_crm: string | null;
  score: number | null;
  ultima_etapa_comercial: string | null;
}

type OutreachType = "acompanhamento" | "reengajamento" | "primeira_duvida" | "recuperacao";

interface OutreachRule {
  type: OutreachType;
  filter: (lead: OutreachCandidate, nowMs: number) => boolean;
  messageBuilder: (lead: OutreachCandidate) => string;
}

const OUTREACH_RULES: OutreachRule[] = [
  {
    type: "acompanhamento",
    filter: (lead, nowMs) => {
      // Lead com proposta enviada há > 7 dias sem interação
      const hasProposal = lead.ultima_etapa_comercial === "proposta_enviada" ||
        lead.lead_status === "proposta_enviada";
      const daysSinceUpdate = (nowMs - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return hasProposal && daysSinceUpdate > 7;
    },
    messageBuilder: (lead) =>
      `Olá ${lead.nome?.split(" ")[0] || ""}! 👋\n\nSou a Dra. L.I.A., consultora digital da BLZ Dental.\n\nNotei que enviamos uma proposta recentemente${lead.produto_interesse ? ` sobre *${lead.produto_interesse}*` : ""}. Gostaria de saber se surgiu alguma dúvida ou se posso ajudar com mais informações técnicas para sua decisão.\n\nEstou à disposição! 😊`,
  },
  {
    type: "reengajamento",
    filter: (lead, nowMs) => {
      // Lead quente que não voltou há > 3 dias
      const isHot = lead.temperatura_lead === "quente" || (lead.score || 0) >= 60;
      const daysSinceUpdate = (nowMs - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return isHot && daysSinceUpdate > 3 && daysSinceUpdate <= 15;
    },
    messageBuilder: (lead) =>
      `Olá ${lead.nome?.split(" ")[0] || ""}! 👋\n\nAqui é a Dra. L.I.A. da BLZ Dental.${lead.resumo_historico_ia ? `\n\nDa última vez conversamos sobre: ${lead.resumo_historico_ia.slice(0, 150)}...` : ""}\n\nTem alguma dúvida pendente que eu possa resolver? Estou aqui para ajudar! 🦷`,
  },
  {
    type: "primeira_duvida",
    filter: (lead, nowMs) => {
      // Lead novo que completou qualificação mas não interagiu mais
      const isNew = lead.lead_status === "qualificado" || lead.lead_status === "novo";
      const daysSinceUpdate = (nowMs - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return isNew && daysSinceUpdate > 2 && daysSinceUpdate <= 10 && (lead.proactive_count || 0) === 0;
    },
    messageBuilder: (lead) =>
      `Olá ${lead.nome?.split(" ")[0] || ""}! 👋\n\nSou a Dra. L.I.A., sua consultora digital em odontologia 3D na BLZ Dental.\n\n${lead.impressora_modelo ? `Vi que você trabalha com a *${lead.impressora_modelo}*. ` : ""}${lead.area_atuacao ? `Como profissional de *${lead.area_atuacao}*, ` : ""}posso te ajudar com dúvidas sobre resinas, parâmetros de impressão, protocolos ou qualquer outro assunto técnico.\n\nÉ só me enviar sua pergunta! 😊`,
  },
  {
    type: "recuperacao",
    filter: (lead, nowMs) => {
      // Lead com status Perdida há < 30 dias (1x só)
      const isLost = lead.lead_status === "perdida" || lead.lead_status === "perdido";
      const daysSinceUpdate = (nowMs - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return isLost && daysSinceUpdate <= 30 && (lead.proactive_count || 0) === 0;
    },
    messageBuilder: (lead) =>
      `Olá ${lead.nome?.split(" ")[0] || ""}! 👋\n\nAqui é a Dra. L.I.A. da BLZ Dental.\n\nSei que as coisas nem sempre se encaixam no timing certo. Queria avisar que estou aqui caso tenha novas dúvidas sobre ${lead.produto_interesse ? `*${lead.produto_interesse}*` : "impressão 3D odontológica"} ou qualquer outra tecnologia.\n\nSem compromisso, é só me chamar! 😊`,
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const maxMessages = body.max_messages || 20;

    const nowMs = Date.now();
    const cutoffDate = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch candidate leads (updated in last 30 days, with phone, not sent in last 5 days)
    const { data: candidates, error: fetchErr } = await supabase
      .from("lia_attendances")
      .select(
        "id, nome, email, telefone_normalized, lead_status, temperatura_lead, produto_interesse, impressora_modelo, area_atuacao, resumo_historico_ia, proactive_sent_at, proactive_count, updated_at, proprietario_lead_crm, score, ultima_etapa_comercial"
      )
      .not("telefone_normalized", "is", null)
      .gte("updated_at", cutoffDate)
      .neq("lead_status", "estagnado_final")
      .neq("lead_status", "descartado")
      .order("updated_at", { ascending: true })
      .limit(500);

    if (fetchErr) {
      console.error("[proactive-outreach] Fetch error:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[proactive-outreach] Found ${candidates?.length || 0} candidate leads`);

    let sent = 0;
    let skipped = 0;
    let errors = 0;
    const results: Array<{ lead: string; type: string; status: string }> = [];

    for (const lead of (candidates || []) as OutreachCandidate[]) {
      if (sent >= maxMessages) break;

      // Anti-spam: skip if proactive sent in last 5 days
      if (lead.proactive_sent_at) {
        const lastSentMs = new Date(lead.proactive_sent_at).getTime();
        if (nowMs - lastSentMs < FIVE_DAYS_MS) {
          skipped++;
          continue;
        }
      }

      // Find first matching rule
      let matchedRule: OutreachRule | null = null;
      for (const rule of OUTREACH_RULES) {
        if (rule.filter(lead, nowMs)) {
          matchedRule = rule;
          break;
        }
      }

      if (!matchedRule) continue;

      const message = matchedRule.messageBuilder(lead);

      // Find the lead owner's team member for WaLeads sending
      let teamMemberId: string | null = null;
      if (lead.proprietario_lead_crm) {
        const { data: member } = await supabase
          .from("team_members")
          .select("id, waleads_api_key")
          .eq("nome_completo", lead.proprietario_lead_crm)
          .eq("ativo", true)
          .single();
        if (member?.waleads_api_key) {
          teamMemberId = member.id;
        }
      }

      // Fallback: find any active team member with waleads key
      if (!teamMemberId) {
        const { data: fallback } = await supabase
          .from("team_members")
          .select("id")
          .eq("ativo", true)
          .not("waleads_api_key", "is", null)
          .limit(1)
          .single();
        if (fallback) teamMemberId = fallback.id;
      }

      if (!teamMemberId) {
        console.warn(`[proactive-outreach] No team member with WaLeads key found for ${lead.nome}`);
        skipped++;
        continue;
      }

      if (dryRun) {
        results.push({ lead: lead.nome, type: matchedRule.type, status: "dry_run" });
        sent++;
        continue;
      }

      // Send via smart-ops-send-waleads
      try {
        const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-send-waleads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            team_member_id: teamMemberId,
            phone: lead.telefone_normalized,
            tipo: "text",
            message,
            lead_id: lead.id,
          }),
        });

        const sendData = await sendRes.json();
        const success = sendData.success === true;

        if (success) {
          sent++;
          // Update proactive control fields
          await supabase
            .from("lia_attendances")
            .update({
              proactive_sent_at: new Date().toISOString(),
              proactive_count: (lead.proactive_count || 0) + 1,
            })
            .eq("id", lead.id);

          results.push({ lead: lead.nome, type: matchedRule.type, status: "sent" });
        } else {
          errors++;
          results.push({ lead: lead.nome, type: matchedRule.type, status: "error" });
        }

        // Log outreach
        await supabase.from("message_logs").insert({
          lead_id: lead.id,
          team_member_id: teamMemberId,
          tipo: `proactive_${matchedRule.type}`,
          mensagem_preview: message.slice(0, 200),
          status: success ? "enviado" : "erro",
          error_details: success ? null : JSON.stringify(sendData).slice(0, 500),
        });
      } catch (sendErr) {
        errors++;
        console.error(`[proactive-outreach] Send error for ${lead.nome}:`, sendErr);
        results.push({ lead: lead.nome, type: matchedRule.type, status: "exception" });
      }
    }

    const summary = {
      success: true,
      dry_run: dryRun,
      total_candidates: candidates?.length || 0,
      sent,
      skipped,
      errors,
      results,
    };

    console.log("[proactive-outreach] Summary:", JSON.stringify(summary));
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[proactive-outreach] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
