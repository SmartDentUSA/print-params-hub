const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Legado descontinuado: envio via WaLeads e SellFlux desativado.
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({ success: false, status: "disabled", provider: "legacy" }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
