import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Registry {
  key: string;
  category: string;
  check_type: "http_get" | "edge_invoke" | "log_count" | "file_exists";
  target_url: string | null;
  edge_function_name: string | null;
  volume_source_table: string | null;
  volume_source_column: string | null;
  stale_after_minutes: number | null;
  expected_status: number | null;
  enabled: boolean;
}

interface CheckResult {
  status: "ok" | "degraded" | "down" | "inactive" | "unknown";
  http_status?: number | null;
  latency_ms?: number | null;
  volume_24h?: number | null;
  last_event_at?: string | null;
  error_message?: string | null;
  details?: Record<string, unknown> | null;
}

async function checkHttp(url: string, expected: number): Promise<CheckResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    await res.body?.cancel();
    let status: CheckResult["status"] = "ok";
    if (res.status >= 500) status = "down";
    else if (res.status !== expected) status = "degraded";
    else if (latency > 3000) status = "degraded";
    return { status, http_status: res.status, latency_ms: latency };
  } catch (e) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      error_message: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkLogCount(
  supabase: ReturnType<typeof createClient>,
  table: string,
  column: string,
  staleAfterMin: number,
): Promise<CheckResult> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  try {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .gte(column, since);
    if (error) throw error;
    const { data: latest } = await supabase
      .from(table)
      .select(column)
      .order(column, { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastEventAt =
      latest && typeof latest === "object" && column in latest
        ? ((latest as Record<string, unknown>)[column] as string | null)
        : null;
    let status: CheckResult["status"] = "ok";
    if (lastEventAt) {
      const ageMin = (Date.now() - new Date(lastEventAt).getTime()) / 60000;
      if (ageMin > staleAfterMin) status = "degraded";
    } else {
      status = "degraded";
    }
    return {
      status,
      volume_24h: count ?? 0,
      last_event_at: lastEventAt,
    };
  } catch (e) {
    return {
      status: "unknown",
      error_message: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkEdgeInvoke(name: string): Promise<CheckResult> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(url, {
      method: "OPTIONS",
      signal: controller.signal,
      headers: { "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
    });
    clearTimeout(timeout);
    await res.body?.cancel();
    const latency = Date.now() - start;
    return {
      status: res.status < 500 ? "ok" : "down",
      http_status: res.status,
      latency_ms: latency,
    };
  } catch (e) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      error_message: e instanceof Error ? e.message : String(e),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: registry, error } = await supabase
    .from("system_integration_registry")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ key: string; status: string }> = [];
  const rows = (registry ?? []) as unknown as Registry[];

  for (const item of rows) {
    let result: CheckResult;
    if (!item.enabled) {
      result = { status: "inactive" };
    } else if (item.check_type === "http_get" || item.check_type === "file_exists") {
      result = item.target_url
        ? await checkHttp(item.target_url, item.expected_status ?? 200)
        : { status: "unknown", error_message: "missing target_url" };
    } else if (item.check_type === "edge_invoke") {
      result = item.edge_function_name
        ? await checkEdgeInvoke(item.edge_function_name)
        : { status: "unknown", error_message: "missing edge_function_name" };
    } else if (item.check_type === "log_count") {
      result = item.volume_source_table
        ? await checkLogCount(
            supabase,
            item.volume_source_table,
            item.volume_source_column ?? "created_at",
            item.stale_after_minutes ?? 1440,
          )
        : { status: "unknown", error_message: "missing volume_source_table" };
    } else {
      result = { status: "unknown" };
    }

    await supabase.from("system_integration_checks").insert({
      integration_key: item.key,
      status: result.status,
      http_status: result.http_status ?? null,
      latency_ms: result.latency_ms ?? null,
      volume_24h: result.volume_24h ?? null,
      last_event_at: result.last_event_at ?? null,
      error_message: result.error_message ?? null,
      details: result.details ?? null,
    });

    results.push({ key: item.key, status: result.status });
  }

  return new Response(JSON.stringify({ ok: true, checked: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});