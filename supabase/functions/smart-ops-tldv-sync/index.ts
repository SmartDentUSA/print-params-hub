import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TLDV_API_KEY_RAW = Deno.env.get("TLDV_API_KEY") || "";
const TLDV_API_KEY = TLDV_API_KEY_RAW.trim();
const TLDV_BASE = "https://pasta.tldv.io/v1alpha1";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function tldvFetch(path: string): Promise<any> {
  const res = await fetch(`${TLDV_BASE}${path}`, {
    headers: {
      "x-api-key": TLDV_API_KEY,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`tldv ${path} ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

async function tldvDebugFetch(
  path: string,
  authMode: "x-api-key" | "X-API-Key" | "X-Api-Key" | "bearer" | "api-key" | "authorization-raw" | "query-api-key",
): Promise<{ path: string; authMode: string; status: number; ok: boolean; body_preview: string }> {
  const authHeaders =
    authMode === "bearer"
      ? { Authorization: `Bearer ${TLDV_API_KEY}` }
      : authMode === "api-key"
        ? { "api-key": TLDV_API_KEY }
        : authMode === "X-API-Key"
          ? { "X-API-Key": TLDV_API_KEY }
          : authMode === "X-Api-Key"
            ? { "X-Api-Key": TLDV_API_KEY }
        : authMode === "authorization-raw"
          ? { Authorization: TLDV_API_KEY }
          : { "x-api-key": TLDV_API_KEY };
  const sep = path.includes("?") ? "&" : "?";
  const requestPath = authMode === "query-api-key" ? `${path}${sep}apiKey=${encodeURIComponent(TLDV_API_KEY)}` : path;
  const res = await fetch(`${TLDV_BASE}${requestPath}`, {
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
  });
  const body = await res.text();
  return {
    path,
    authMode,
    status: res.status,
    ok: res.ok,
    body_preview: body.slice(0, 600),
  };
}

function parseMeetingDate(meeting: any): number {
  const raw = meeting?.happenedAt || meeting?.startTime || meeting?.created_at || meeting?.createdAt;
  const ts = Date.parse(raw || "");
  return Number.isFinite(ts) ? ts : 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!TLDV_API_KEY) {
      return new Response(JSON.stringify({ error: "TLDV_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    if (url.searchParams.get("debug") === "health") {
      try {
        const h = await tldvFetch("/health");
        return new Response(JSON.stringify({ health: h, key_len_raw: TLDV_API_KEY_RAW.length, key_len_trimmed: TLDV_API_KEY.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message, key_len_raw: TLDV_API_KEY_RAW.length, key_len_trimmed: TLDV_API_KEY.length }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (url.searchParams.get("debug") === "meetings") {
      const attempts = [];
      for (const path of ["/meetings", "/meetings?page=1&pageSize=10", "/meetings?page=1"]) {
        attempts.push(await tldvDebugFetch(path, "x-api-key"));
      }
      attempts.push(await tldvDebugFetch("/meetings/", "x-api-key"));
      for (const authMode of ["X-API-Key", "X-Api-Key", "bearer", "api-key", "authorization-raw", "query-api-key"] as const) {
        attempts.push(await tldvDebugFetch("/meetings", authMode));
      }
      return new Response(JSON.stringify({ key_len_raw: TLDV_API_KEY_RAW.length, key_len_trimmed: TLDV_API_KEY.length, attempts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const since: string = body.since || "2025-01-01";
    const sinceTs = Date.parse(since);
    const limit: number = Math.min(Number(body.limit ?? 10), 200);
    const dryRun: boolean = body.dry_run !== false; // default true (safety)
    const reprocess: boolean = !!body.reprocess;

    // Fetch list of meetings from tl;dv (paginated)
    const collected: any[] = [];
    let page = 1;
    while (collected.length < limit && page <= 20) {
      let payload: any;
      try {
        payload = await tldvFetch(`/meetings?page=${page}&pageSize=10`);
      } catch (e) {
        return new Response(
          JSON.stringify({ error: (e as Error).message, hint: "Check TLDV_API_KEY and endpoint." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const items: any[] = payload?.results || payload?.data || payload?.meetings || [];
      if (!items.length) break;
      collected.push(...items.filter((m) => !Number.isFinite(sinceTs) || parseMeetingDate(m) >= sinceTs));
      if (items.length < 10) break;
      page++;
    }

    const truncated = collected.slice(0, limit);

    // Filter out already processed (unless reprocess)
    let queued: string[] = [];
    let skipped: string[] = [];
    for (const m of truncated) {
      const id = String(m.id || m.meetingId || m._id);
      if (!id || id === "undefined") continue;
      if (!reprocess) {
        const { data: existing } = await supabase
          .from("tldv_meetings")
          .select("id")
          .eq("tldv_id", id)
          .maybeSingle();
        if (existing) {
          skipped.push(id);
          continue;
        }
      }
      queued.push(id);
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          found: collected.length,
          would_process: queued.length,
          would_skip: skipped.length,
          sample: truncated.slice(0, 3).map((m) => ({
            id: m.id || m.meetingId,
            name: m.name || m.title,
            happenedAt: m.happenedAt || m.startTime,
          })),
          queued_ids: queued,
          skipped_ids: skipped,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Real run: fan out to webhook function (fire-and-forget per id)
    const webhookUrl = `${SUPABASE_URL}/functions/v1/smart-ops-tldv-webhook`;
    const triggered: string[] = [];
    for (const id of queued) {
      // Sequential to avoid rate limits / DeepSeek concurrency
      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({ event: "TranscriptReady", meetingId: id }),
        });
        if (res.ok) triggered.push(id);
        else console.warn(`[tldv-sync] webhook ${id} → ${res.status}`);
      } catch (e) {
        console.warn(`[tldv-sync] webhook ${id} fail: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        dry_run: false,
        found: collected.length,
        queued: queued.length,
        triggered: triggered.length,
        skipped: skipped.length,
        triggered_ids: triggered,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[tldv-sync] fatal:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
