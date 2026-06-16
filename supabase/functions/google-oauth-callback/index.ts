import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_URL = "https://admin.smartdent.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return Response.redirect(`${APP_URL}/social/avaliacoes?connected=false&error=${encodeURIComponent(errorParam)}`, 302);
  }
  if (!code) {
    return new Response(JSON.stringify({ error: "Missing code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        redirect_uri: Deno.env.get("GOOGLE_REDIRECT_URI")!,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResp.ok) {
      const txt = await tokenResp.text();
      console.error("[google-oauth-callback] token exchange failed", tokenResp.status, txt);
      return Response.redirect(`${APP_URL}/social/avaliacoes?connected=false&error=token_exchange`, 302);
    }

    const tokens = await tokenResp.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

    await supabase.from("google_oauth_tokens").insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt,
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
    });

    return Response.redirect(`${APP_URL}/social/avaliacoes?connected=true`, 302);
  } catch (err) {
    console.error("[google-oauth-callback] erro", err);
    return Response.redirect(`${APP_URL}/social/avaliacoes?connected=false&error=server`, 302);
  }
});