import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const today = new Date();
    const body = await req.json().catch(() => ({}));
    const daysBack = Math.min(Math.max(body.days_back || 1, 1), 30);
    const since = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const dateStr = today.toISOString().split("T")[0];

    console.log(`🚀 archive-daily-chats iniciado → ${since.toISOString()} até ${today.toISOString()} (${daysBack} dias)`);

    // Fetch valid conversations from last 24h
    const { data: conversations, error } = await supabase
      .from("agent_interactions")
      .select("user_message, agent_response, context_sources, created_at, judge_score")
      .gte("created_at", since.toISOString())
      .not("agent_response", "is", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ Erro busca:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conversations || conversations.length === 0) {
      console.log(`ℹ️ Nenhuma conversa nos últimos ${daysBack} dia(s)`);
      return new Response(JSON.stringify({ message: `Nenhuma conversa nos últimos ${daysBack} dia(s)`, total: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📊 ${conversations.length} conversas encontradas, filtrando judge_score >= 4...`);

    // Heuristic classification
    const classifyInteraction = (userMsg: string, contextSources: unknown): string => {
      const sources = JSON.stringify(contextSources || {}).toLowerCase();
      const msg = userMsg.toLowerCase();

      if (sources.includes("catalog_product") || sources.includes("system_a")) return "comercial";
      if (sources.includes("printer_page") || sources.includes("parameter")) return "suporte";
      if (/pre[cç]o|valor|comprar|or[cç]amento|custo|quanto custa/.test(msg)) return "comercial";
      if (/agendar|demonstra[cç][aã]o|reuni[aã]o|teste|visita/.test(msg)) return "leads";
      if (/como usar|configurar|problema|erro|n[aã]o funciona/.test(msg)) return "suporte";
      if (/n[aã]o quero|caro|concorrente|reclama[cç]|desistir/.test(msg)) return "objecoes";
      if (/obrigado|avaliar|feedback|depois/.test(msg)) return "pos_venda";
      return "geral";
    };

    // Categorize conversations
    const categorized: Record<string, Array<{ time: string; user: string; lia: string; gold: boolean }>> = {};
    let goldCount = 0;
    let archivedCount = 0;

    for (const conv of conversations) {
      const userMsg = (conv.user_message || "").trim();
      const agentResp = (conv.agent_response || "").trim();
      if (userMsg.length < 10) continue;

      const judgeScore = conv.judge_score || 0;
      if (judgeScore < 4) continue;

      const category = classifyInteraction(userMsg, conv.context_sources);
      const isGold = judgeScore === 5;
      if (isGold) goldCount++;

      if (!categorized[category]) categorized[category] = [];
      categorized[category].push({
        time: new Date(conv.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        user: userMsg,
        lia: agentResp,
        gold: isGold,
      });
      archivedCount++;
    }

    console.log(`✅ ${archivedCount} conversas qualificadas (score >= 4), ${goldCount} gold`);

    if (archivedCount === 0) {
      return new Response(
        JSON.stringify({ message: `Nenhuma conversa com score >= 4 nos últimos ${daysBack} dia(s)`, total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format and ingest per category
    const results: Array<{ category: string; count: number; gold: number; ingested: boolean }> = [];

    for (const [cat, convs] of Object.entries(categorized)) {
      if (convs.length === 0) continue;

      const title = `${dateStr}_Conversas_LIA_${cat.charAt(0).toUpperCase() + cat.slice(1)}`;
      const goldInCat = convs.filter((c) => c.gold).length;

      let text = `=== Conversas L.I.A. — ${dateStr} — Categoria: ${cat.toUpperCase()} (${convs.length} dialogos, ${goldInCat} gold) ===\n\n`;
      for (const c of convs) {
        if (c.gold) text += `[GOLD] `;
        text += `[${c.time}] Usuário: ${c.user}\n`;
        text += `L.I.A.: ${c.lia}\n`;
        text += `---\n`;
      }

      // Call ingest-knowledge-text with correct { entries: [...] } format
      try {
        const ingestRes = await fetch(`${SUPABASE_URL}/functions/v1/ingest-knowledge-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({
            entries: [
              {
                title,
                content: text,
                category: cat,
                source_label: "LIA-Dialogos",
              },
            ],
          }),
        });

        const ingested = ingestRes.ok;
        if (!ingested) {
          const errText = await ingestRes.text();
          console.error(`❌ Falha ingest ${cat}: ${errText}`);
        } else {
          console.log(`📦 ${cat}: ${convs.length} conversas indexadas`);
        }
        results.push({ category: cat, count: convs.length, gold: goldInCat, ingested });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`❌ Erro ingest ${cat}: ${msg}`);
        results.push({ category: cat, count: convs.length, gold: goldInCat, ingested: false });
      }
    }

    const summary = {
      success: true,
      date: dateStr,
      days_back: daysBack,
      total_conversations_found: conversations.length,
      archived: archivedCount,
      gold_nuggets: goldCount,
      by_category: results,
    };

    console.log(`✅ archive-daily-chats finalizado → ${archivedCount} arquivadas | ${goldCount} gold`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[archive-daily-chats] erro fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
