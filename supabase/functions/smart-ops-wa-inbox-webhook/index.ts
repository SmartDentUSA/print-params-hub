// DEPRECATED — kept as a thin forwarder so existing Evolution webhooks keep working.
// All logic (intent classification, hot-lead alert, inbox logging, image handling) now
// lives in `dra-lia-whatsapp`, which mirrors the site protocol end-to-end.
// Repoint webhooks to /functions/v1/dra-lia-whatsapp and remove this stub once cut over.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const body = await req.text();
    const targetUrl = `${SUPABASE_URL}/functions/v1/dra-lia-whatsapp${new URL(req.url).search}`;
    console.log(`[wa-inbox→dra-lia-whatsapp] Forwarding ${body.length}B to ${targetUrl}`);

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": req.headers.get("content-type") || "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body,
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    console.error("[wa-inbox forwarder] Error:", err);
    return new Response(JSON.stringify({ error: String(err), forwarded: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});