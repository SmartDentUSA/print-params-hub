/**
 * smart-ops-refresh-system-a-cache
 *
 * Refreshes the Sistema A live snapshot stored at
 *   system_a_catalog.extra_data.system_a_live
 * for one product or in batch. Used by:
 *   - on-demand curl (debug, validation)
 *   - daily cron (refresh whole catalog)
 *
 * Modes:
 *   GET ?product_id=<external_id>     → single product
 *   GET ?slug=<system_a_catalog.slug> → resolve external_id then refresh
 *   GET ?all=true&limit=50&offset=0   → batch (rate-limited, 250ms between calls)
 *
 * Response: { refreshed: [...ids], failed: [...ids], total }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchSystemAProduct,
  snapshotForPersistence,
} from "../_shared/system-a-live.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function refreshOne(
  supabase: ReturnType<typeof createClient>,
  externalId: string,
): Promise<{ ok: boolean; name?: string; reason?: string }> {
  const live = await fetchSystemAProduct(externalId, { force: true });
  if (!live) return { ok: false, reason: "live_fetch_failed_or_not_found" };
  const snap = snapshotForPersistence(live);

  // Merge snapshot into extra_data.system_a_live (without nuking other keys).
  const { data: row, error: readErr } = await supabase
    .from("system_a_catalog")
    .select("id, extra_data, name")
    .eq("external_id", externalId)
    .maybeSingle();
  if (readErr || !row) return { ok: false, reason: "catalog_row_not_found" };

  const extra = (row.extra_data as Record<string, unknown> | null) ?? {};
  // Preserve manually-edited technical_specs: if an admin edited specs after the
  // last automatic snapshot, keep the manual array instead of overwriting it.
  const prevLive = (extra.system_a_live as Record<string, unknown> | undefined) ?? {};
  const manualEditedAt = prevLive.manually_edited_at as string | undefined;
  const lastFetchedAt = prevLive.fetched_at as string | undefined;
  const manualWins =
    manualEditedAt &&
    (!lastFetchedAt || new Date(manualEditedAt).getTime() > new Date(lastFetchedAt).getTime());
  const mergedLive: Record<string, unknown> = { ...snap };
  if (manualWins) {
    mergedLive.technical_specs = (prevLive.technical_specs as unknown) ?? snap.technical_specs;
    mergedLive.manually_edited_at = manualEditedAt;
  }
  const nextExtra = { ...extra, system_a_live: mergedLive };

  const { error: updErr } = await supabase
    .from("system_a_catalog")
    .update({ extra_data: nextExtra, updated_at: new Date().toISOString() })
    .eq("id", row.id as string);
  if (updErr) return { ok: false, reason: updErr.message };
  return { ok: true, name: String(row.name ?? "") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  let productId = url.searchParams.get("product_id");
  let slug = url.searchParams.get("slug");
  let all = url.searchParams.get("all") === "true";
  if (req.method === "POST") {
    try {
      const body = await req.json();
      productId = productId ?? (body?.product_id as string | undefined) ?? null;
      slug = slug ?? (body?.slug as string | undefined) ?? null;
      all = all || body?.all === true;
    } catch { /* no body */ }
  }
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // Single by product_id
    if (productId) {
      const r = await refreshOne(supabase, productId);
      return json({ refreshed: r.ok ? [productId] : [], failed: r.ok ? [] : [{ id: productId, reason: r.reason }], detail: r });
    }

    // Single by slug
    if (slug) {
      const { data } = await supabase
        .from("system_a_catalog")
        .select("external_id")
        .eq("slug", slug)
        .maybeSingle();
      const eid = (data?.external_id as string | undefined) ?? null;
      if (!eid) return json({ error: "slug_not_found_or_no_external_id" }, 404);
      const r = await refreshOne(supabase, eid);
      return json({ refreshed: r.ok ? [eid] : [], failed: r.ok ? [] : [{ id: eid, reason: r.reason }], detail: r });
    }

    // Batch
    if (all) {
      const { data, error } = await supabase
        .from("system_a_catalog")
        .select("external_id, name")
        .eq("active", true)
        .eq("approved", true)
        .eq("visible_in_ui", true)
        .not("product_category", "is", null)
        .not("external_id", "is", null)
        .order("updated_at", { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) return json({ error: error.message }, 500);
      const rows = (data ?? []) as Array<{ external_id: string; name: string }>;
      const refreshed: string[] = [];
      const failed: Array<{ id: string; name: string; reason: string }> = [];
      for (const row of rows) {
        const r = await refreshOne(supabase, row.external_id);
        if (r.ok) refreshed.push(row.external_id);
        else failed.push({ id: row.external_id, name: row.name, reason: r.reason ?? "unknown" });
        await sleep(250); // be gentle with Sistema A
      }
      return json({ refreshed, failed, total: rows.length, offset, limit });
    }

    return json({
      error: "missing_argument",
      hint: "pass ?product_id=<external_id>, ?slug=<system_a_catalog.slug> or ?all=true",
    }, 400);
  } catch (e) {
    console.error("[refresh-system-a-cache] fatal", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});