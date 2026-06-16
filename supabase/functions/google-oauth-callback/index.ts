import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_URL = "https://admin.smartdent.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  console.log("[oauth-callback] code recebido:", !!code, "error:", errorParam);

  if (errorParam) {
    return Response.redirect(`${APP_URL}/social/avaliacoes?connected=false&error=${encodeURIComponent(errorParam)}`, 302);
  }
  if (!code) {
    return new Response(JSON.stringify({ error: "Missing code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // IMPORTANT: must EXACTLY match the redirect_uri used in the authorize step (frontend builds it from SUPABASE_URL).
    // We ignore the GOOGLE_REDIRECT_URI secret here because it historically pointed to /auth/v1/callback.
    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;

    console.log("[oauth-callback] env check:", {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      redirectUri,
    });

    if (!clientId || !clientSecret) {
      console.error("[oauth-callback] missing GOOGLE_CLIENT_ID/SECRET in edge function env");
      return Response.redirect(`${APP_URL}/social/avaliacoes?connected=false&error=server_config`, 302);
    }

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenBody = await tokenResp.text();
    console.log("[oauth-callback] token response status:", tokenResp.status);
    console.log("[oauth-callback] token response body:", tokenBody);

    if (!tokenResp.ok) {
      return Response.redirect(
        `${APP_URL}/social/avaliacoes?connected=false&error=token_exchange_${tokenResp.status}`,
        302,
      );
    }

    const tokens = JSON.parse(tokenBody);
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

    const { data: insertData, error: insertError } = await supabase
      .from("google_oauth_tokens")
      .insert({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
        scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
      })
      .select()
      .single();

    console.log("[oauth-callback] insert result:", { insertData, insertError });

    if (insertError) {
      return Response.redirect(
        `${APP_URL}/social/avaliacoes?connected=false&error=db_insert`,
        302,
      );
    }

    return Response.redirect(`${APP_URL}/social/avaliacoes?connected=true`, 302);
  } catch (err) {
    console.error("[google-oauth-callback] erro:", err instanceof Error ? err.message : err);
    return Response.redirect(`${APP_URL}/social/avaliacoes?connected=false&error=server`, 302);
  }
});