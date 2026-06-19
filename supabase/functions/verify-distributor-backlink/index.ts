// ════════════════════════════════════════════════════════════
// verify-distributor-backlink
// Para cada distribuidor ativo com site_url, faz GET da home (e /about/sobre/about-us)
// procurando menção a smartdent.com.br. Atualiza backlink_status:
//   found     → encontrou um <a href> apontando para smartdent.com.br
//   mention   → texto cita smartdent.com.br mas sem link clicável
//   missing   → nenhuma menção
//   unreachable → site não respondeu
// Pode ser disparada manualmente (POST sem body) ou via cron diário.
// ════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TARGET_REGEX = /smartdent\.com\.br/i;
const LINK_REGEX = /<a[^>]+href=["']([^"']*smartdent\.com\.br[^"']*)["'][^>]*>/i;

async function checkSite(baseUrl: string): Promise<{ status: "found" | "mention" | "missing" | "unreachable"; foundUrl?: string; error?: string }> {
  const tries = [baseUrl, baseUrl.replace(/\/$/, "") + "/about", baseUrl.replace(/\/$/, "") + "/sobre", baseUrl.replace(/\/$/, "") + "/about-us"];
  let lastError = "";
  for (const url of tries) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { "User-Agent": "SmartDentBacklinkBot/1.0 (+https://admin.smartdent.com.br)" },
      });
      clearTimeout(t);
      if (!res.ok) { lastError = `HTTP ${res.status} @ ${url}`; continue; }
      const html = await res.text();
      const linkMatch = html.match(LINK_REGEX);
      if (linkMatch) return { status: "found", foundUrl: linkMatch[1] };
      if (TARGET_REGEX.test(html)) return { status: "mention" };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  if (lastError) return { status: "unreachable", error: lastError };
  return { status: "missing" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);
  const onlyId = url.searchParams.get("distributor_id");

  try {
    let q = sb
      .from("distributors")
      .select("id,site_url")
      .eq("active", true)
      .not("site_url", "is", null);
    if (onlyId) q = q.eq("id", onlyId);
    const { data: rows, error } = await q;
    if (error) throw error;

    const results: any[] = [];
    for (const d of rows || []) {
      const site = (d.site_url || "").trim();
      if (!site || !/^https?:\/\//i.test(site)) continue;
      const r = await checkSite(site);
      const upd: any = {
        backlink_status: r.status,
        backlink_verified_at: new Date().toISOString(),
        backlink_url: r.foundUrl || null,
        backlink_last_error: r.error || null,
      };
      await sb.from("distributors").update(upd).eq("id", d.id);
      results.push({ id: d.id, site, ...r });
    }

    return new Response(JSON.stringify({ ok: true, checked: results.length, results }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: corsHeaders });
  }
});