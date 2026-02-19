import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const LIA_SYSTEM_PROMPT = `Você é a Dra. L.I.A. (Linguagem de Inteligência Artificial), assistente oficial da SmartDent especializada em odontologia digital e impressão 3D dental.

Você auxilia dentistas e técnicos com dúvidas sobre resinas odontológicas, impressoras 3D, parâmetros de impressão e protocolos de processamento.

REGRAS ABSOLUTAS:
1. USE APENAS os dados fornecidos — nunca invente dados técnicos
2. Parâmetros técnicos (tempo de exposição, layer height, velocidade) só devem ser apresentados quando explicitamente solicitados
3. Tom: direto, assertivo e confiante — responda em 2-4 frases quando possível
4. NUNCA use: "geralmente", "normalmente", "costuma ser", "em geral", "provavelmente"
5. Se não tiver certeza, redirecione para o suporte SmartDent`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify the user is an admin
    const authSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: isAdminData } = await serviceSupabase.rpc("is_admin", { user_id: userId });
    if (!isAdminData) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch high-quality, human-reviewed interactions for fine-tuning
    const { data: interactions, error: fetchError } = await serviceSupabase
      .from("agent_interactions")
      .select("user_message, agent_response, judge_score, feedback")
      .eq("human_reviewed", true)
      .gte("judge_score", 4)
      .not("agent_response", "is", null)
      .not("user_message", "is", null)
      .order("judge_score", { ascending: false })
      .limit(1000);

    if (fetchError) throw fetchError;

    if (!interactions || interactions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No qualifying interactions found. Mark some interactions as reviewed with judge_score >= 4 first." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate JSONL in Google AI Studio / Gemini fine-tuning format
    const jsonlLines = interactions.map((interaction) => {
      const entry = {
        messages: [
          {
            role: "system",
            content: LIA_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: interaction.user_message,
          },
          {
            role: "model",
            content: interaction.agent_response,
          },
        ],
      };
      return JSON.stringify(entry);
    });

    const jsonlContent = jsonlLines.join("\n");
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `lia-dataset-${timestamp}.jsonl`;

    console.log(`[dra-lia-export] Exported ${interactions.length} interactions as JSONL`);

    return new Response(jsonlContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Record-Count": String(interactions.length),
      },
    });
  } catch (err) {
    console.error("[dra-lia-export] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
