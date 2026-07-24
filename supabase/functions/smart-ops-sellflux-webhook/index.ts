// Legado SellFlux desativado.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({ status: "disabled", provider: "sellflux" }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
