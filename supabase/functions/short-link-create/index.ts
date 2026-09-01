import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SHORT_BASE = "https://parametros.smartdent.com.br/r";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function randomCode(len = 6) {
  const chars = "abcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { destination_url } = await req.json();
    if (!destination_url || !/^https?:\/\//i.test(destination_url)) {
      return new Response(JSON.stringify({ error: "destination_url inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Reutiliza o código já existente para o mesmo destino (evita inflar a tabela).
    const { data: existing } = await supabase
      .from("short_links")
      .select("code")
      .eq("destination_url", destination_url)
      .is("campaign_id", null)
      .limit(1)
      .maybeSingle();

    if (existing?.code) {
      return new Response(JSON.stringify({ url: `${SHORT_BASE}/${existing.code}`, code: existing.code }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode(6);
      const { error } = await supabase.from("short_links").insert({ code, destination_url });
      if (!error) {
        return new Response(JSON.stringify({ url: `${SHORT_BASE}/${code}`, code }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!String(error.message || "").includes("duplicate")) throw error;
    }
    throw new Error("não foi possível gerar código único");
  } catch (err) {
    console.error("[short-link-create]", err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
