import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch all dra-lia leads
    const { data: leads, error: leadsErr } = await supabase
      .from("leads")
      .select("*")
      .eq("source", "dra-lia");

    if (leadsErr) throw leadsErr;
    if (!leads?.length) {
      return new Response(JSON.stringify({ message: "No dra-lia leads found", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[backfill] Found ${leads.length} dra-lia leads`);

    const results: Array<{ email: string; status: string; summary?: string }> = [];

    for (const lead of leads) {
      try {
        // 2. Get interaction stats for this lead
        const { data: interactions } = await supabase
          .from("agent_interactions")
          .select("id, user_message, agent_response, created_at")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: true });

        const msgCount = interactions?.length || 0;
        const lastInteraction = interactions?.length
          ? interactions[interactions.length - 1].created_at
          : null;

        // 3. Generate AI summary if there are conversations
        let summary: string | null = null;
        if (GOOGLE_AI_KEY && interactions && interactions.length >= 3) {
          try {
            const conversationText = interactions
              .slice(-30) // last 30 messages
              .map((i) => `User: ${i.user_message}\nAssistant: ${i.agent_response || ""}`)
              .join("\n");

            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GOOGLE_AI_KEY}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{
                    parts: [{
                      text: `Resuma em 1 frase curta (max 15 palavras) o assunto principal desta conversa. Apenas o tema, sem saudações.\n\nConversa:\n${conversationText}`,
                    }],
                  }],
                  generationConfig: { maxOutputTokens: 60, temperature: 0.2 },
                }),
              }
            );

            if (geminiRes.ok) {
              const geminiData = await geminiRes.json();
              summary = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
            }
          } catch (e) {
            console.warn(`[backfill] Summary generation failed for ${lead.email}:`, e);
          }
        }

        // 4. Upsert into lia_attendances
        const { error: upsertErr } = await supabase
          .from("lia_attendances")
          .upsert(
            {
              nome: lead.name,
              email: lead.email,
              source: "dra-lia",
              especialidade: lead.specialty || null,
              data_primeiro_contato: lead.created_at,
              lead_status: "novo",
              resumo_historico_ia: summary,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "email" }
          );

        if (upsertErr) {
          console.error(`[backfill] Upsert error for ${lead.email}:`, upsertErr);
          results.push({ email: lead.email, status: "error" });
        } else {
          console.log(`[backfill] ✓ ${lead.email} (${msgCount} msgs, summary: ${summary ? "yes" : "no"})`);
          results.push({ email: lead.email, status: "ok", summary: summary || undefined });
        }
      } catch (e) {
        console.error(`[backfill] Error processing ${lead.email}:`, e);
        results.push({ email: lead.email, status: "error" });
      }
    }

    return new Response(
      JSON.stringify({ message: "Backfill complete", total: leads.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[backfill] Fatal error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
