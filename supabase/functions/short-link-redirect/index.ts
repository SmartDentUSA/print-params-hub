import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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