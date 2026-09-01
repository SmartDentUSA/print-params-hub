/**
 * Encurtador de links público (edge function `short-link-create`).
 * Chamada direta + cache por destino + retentativas, para funcionar também
 * em rotas públicas (sem sessão) e em domínios customizados.
 */
const SUPABASE_PROJECT_URL = "https://okeogjgqijbfkudfjadz.supabase.co";
const SHORT_LINK_ENDPOINT = `${SUPABASE_PROJECT_URL}/functions/v1/short-link-create`;
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk";

const cache = new Map<string, string>();

export async function shortenUrl(url: string, attempts = 3): Promise<string> {
  if (!url) return url;
  const cached = cache.get(url);
  if (cached) return cached;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(SHORT_LINK_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ destination_url: url }),
      });
      const json = await res.json().catch(() => null);
      const short = (json as any)?.url as string | undefined;
      if (res.ok && short) {
        cache.set(url, short);
        return short;
      }
      console.warn("[shortLink] falhou", res.status, json);
    } catch (err) {
      console.warn("[shortLink] erro", err);
    }
    if (attempt < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return url;
}
