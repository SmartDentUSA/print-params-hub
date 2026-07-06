import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FALLBACK_HOME = "https://parametros.smartdent.com.br/";
const APP_BASE = "https://parametros.smartdent.com.br";

function detectDevice(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobile|iphone|android/.test(s)) return "mobile";
  return "desktop";
}

function detectBrowser(ua: string): string {
  const s = ua.toLowerCase();
  if (s.includes("edg/")) return "edge";
  if (s.includes("chrome/") && !s.includes("edg/")) return "chrome";
  if (s.includes("firefox/")) return "firefox";
  if (s.includes("safari/") && !s.includes("chrome/")) return "safari";
  return "other";
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    // supports /short-link-resolve?c=CODE, /short-link-resolve/CODE, or a raw code as pathname
    let code =
      url.searchParams.get("c") ||
      url.pathname.split("/").filter(Boolean).pop() ||
      "";
    code = code.trim().toLowerCase();

    if (!code || code === "short-link-resolve" || !/^[a-z0-9]{4,8}$/.test(code)) {
      return Response.redirect(FALLBACK_HOME, 302);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link } = await supabase
      .from("smartops_short_links")
      .select("id, form_slug, default_target, click_count")
      .eq("short_code", code)
      .maybeSingle();

    if (!link) {
      return Response.redirect(FALLBACK_HOME, 302);
    }

    const path =
      link.default_target === "landing_page"
        ? `/lp/${link.form_slug}`
        : `/f/${link.form_slug}`;

    // Fire-and-forget: increment counter + register visitor in the same pipeline
    // used by usePageTracking (so the form's "Visitantes" metric picks it up).
    (async () => {
      try {
        const now = new Date().toISOString();
        await supabase
          .from("smartops_short_links")
          .update({
            click_count: (link.click_count || 0) + 1,
            last_clicked_at: now,
          })
          .eq("id", link.id);

        const ua = req.headers.get("user-agent") || "";
        const ip =
          req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
          req.headers.get("cf-connecting-ip") ||
          "unknown";
        const sessionSeed = `${ip}|${ua}|${new Date().toISOString().slice(0, 10)}`;
        const sessionId = (await sha256Hex(sessionSeed)).slice(0, 32);

        await supabase.from("lead_page_views").insert({
          session_id: sessionId,
          page_path: path,
          page_title: null,
          page_type: link.default_target === "landing_page" ? "landing_page" : "form",
          referrer: req.headers.get("referer") || null,
          utm_source: "short_link",
          utm_medium: "shortlink",
          utm_campaign: code,
          device_type: detectDevice(ua),
          browser: detectBrowser(ua),
          extra_data: {
            source: "short_link",
            short_code: code,
            form_slug: link.form_slug,
            action: "view",
          },
        });
      } catch (err) {
        console.error("[short-link-resolve] tracking error", err);
      }
    })();

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${APP_BASE}${path}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[short-link-resolve]", err);
    return Response.redirect(FALLBACK_HOME, 302);
  }
});