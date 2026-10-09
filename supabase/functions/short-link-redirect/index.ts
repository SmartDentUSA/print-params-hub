import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_RE = /facebookexternalhit|facebot|instagram|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|skypeuripreview|applebot|pinterest|embedly|redditbot/i;
const DEFAULT_IMG = "https://parametros.smartdent.com.br/og-fluxo-digital.jpg";
const esc = (v: string) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// deno-lint-ignore no-explicit-any
async function previewHtml(supabase: any, dest: string): Promise<string | null> {
  let u: URL;
  try { u = new URL(dest); } catch { return null; }
  const id = u.searchParams.get("curso");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: pc } = await supabase.from("professional_courses")
    .select("title, description, cover_image_url, source_smartops_course_id").eq("id", id).maybeSingle();
  // deno-lint-ignore no-explicit-any
  let c: any = pc;
  if (!c) {
    const { data: sc } = await supabase.from("smartops_courses").select("title, description, cover_image_url").eq("id", id).maybeSingle();
    c = sc;
  }
  if (!c) return null;
  let img = c.cover_image_url as string | null;
  if (!img && c.source_smartops_course_id) {
    const { data: src } = await supabase.from("smartops_courses").select("cover_image_url").eq("id", c.source_smartops_course_id).maybeSingle();
    img = src?.cover_image_url ?? null;
  }
  img = img || DEFAULT_IMG;
  const title = c.title || "Curso Smart Dent";
  const desc = String(c.description || "Informações do curso Smart Dent").replace(/\s+/g, " ").slice(0, 200);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:url" content="${esc(dest)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(dest)}"></head><body><a href="${esc(dest)}">${esc(title)}</a></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    // supports both /short-link-redirect?c=CODE and /short-link-redirect/CODE
    const code = url.searchParams.get("c") || url.pathname.split("/").filter(Boolean).pop();
    if (!code) return new Response("missing code", { status: 400 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link } = await supabase.from("short_links")
      .select("id, destination_url, click_count, send_log_id, campaign_id, first_click_at")
      .eq("code", code).maybeSingle();

    if (!link?.destination_url) return new Response("not found", { status: 404 });

    // Robôs de prévia (Instagram, WhatsApp...) recebem a miniatura do curso e não contam como clique.
    if (BOT_RE.test(req.headers.get("user-agent") || "")) {
      const html = await previewHtml(supabase, link.destination_url).catch(() => null);
      if (html) return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" } });
    }

    const now = new Date().toISOString();
    await supabase.from("short_links").update({
      click_count: (link.click_count || 0) + 1,
      first_click_at: link.first_click_at || now,
      last_click_at: now,
    }).eq("id", link.id);

    if (link.send_log_id) {
      // Fetch to avoid overwriting first_click
      const { data: slog } = await supabase.from("campaign_send_log")
        .select("clicked_at, click_count").eq("id", link.send_log_id).maybeSingle();
      await supabase.from("campaign_send_log").update({
        clicked_at: slog?.clicked_at || now,
        click_count: (slog?.click_count || 0) + 1,
      }).eq("id", link.send_log_id);
    }

    return new Response(null, {
      status: 302,
      headers: {
        "Location": link.destination_url,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[short-link-redirect]", err);
    return new Response("error", { status: 500 });
  }
});