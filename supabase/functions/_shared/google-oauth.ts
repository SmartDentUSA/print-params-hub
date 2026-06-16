import { createClient } from "npm:@supabase/supabase-js@2";

export async function getValidAccessToken(): Promise<string> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: token, error } = await supabase
    .from("google_oauth_tokens")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !token) {
    throw new Error("No Google OAuth token found. Conecte o Google Business Profile primeiro.");
  }

  const expiresAt = new Date(token.expires_at).getTime();
  // refresh if expires in <2min
  if (expiresAt - Date.now() > 120_000) {
    return token.access_token;
  }

  if (!token.refresh_token) {
    throw new Error("Token Google expirado e sem refresh_token. Reconecte o Google Business Profile.");
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Falha refresh token Google: ${resp.status} ${txt}`);
  }

  const refreshed = await resp.json();
  const newAccess = refreshed.access_token as string;
  const newExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString();

  await supabase
    .from("google_oauth_tokens")
    .update({
      access_token: newAccess,
      expires_at: newExpiresAt,
      refresh_token: refreshed.refresh_token ?? token.refresh_token,
    })
    .eq("id", token.id);

  return newAccess;
}