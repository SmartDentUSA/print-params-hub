import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Registry {
  key: string;
  category: string;
  check_type: "http_get" | "edge_invoke" | "log_count" | "file_exists" | "special";
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

async function pingHttp(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ status: number; latency_ms: number; bodyText?: string; ok: boolean; error?: string }> {
  const start = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), init.timeoutMs ?? 8_000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text().catch(() => "");
    return { status: res.status, latency_ms: Date.now() - start, bodyText: text, ok: res.ok };
  } catch (e) {
    return {
      status: 0,
      latency_ms: Date.now() - start,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

function gradeLatency(latency: number, ok: boolean): CheckResult["status"] {
  if (!ok) return "down";
  if (latency > 3000) return "degraded";
  if (latency > 1500) return "degraded";
  return "ok";
}

async function checkSpecial(
  key: string,
  supabase: ReturnType<typeof createClient>,
): Promise<CheckResult> {
  switch (key) {
    case "api_evolution_agg": {
      const { data: members } = await supabase
        .from("team_members")
        .select("evolution_instance_name, evolution_base_url, evolution_api_key, evo_go_instance_token")
        .not("evolution_instance_name", "is", null)
        .is("evo_go_instance_token", null);
      const list = (members ?? []) as Array<{
        evolution_instance_name: string;
        evolution_base_url: string | null;
        evolution_api_key: string | null;
      }>;
      const seen = new Map<string, typeof list[number]>();
      for (const m of list) if (!seen.has(m.evolution_instance_name)) seen.set(m.evolution_instance_name, m);
      const instances = [...seen.values()];
      if (instances.length === 0) return { status: "inactive", error_message: "Nenhuma instância Evolution cadastrada" };
      const details: Record<string, unknown>[] = [];
      let worst: CheckResult["status"] = "ok";
      let totalLatency = 0;
      for (const inst of instances) {
        const base = inst.evolution_base_url ?? Deno.env.get("EVO_BASE_URL") ?? "";
        const apikey = inst.evolution_api_key ?? Deno.env.get("EVO_KEY") ?? "";
        if (!base || !apikey) {
          details.push({ instance: inst.evolution_instance_name, status: "inactive", reason: "missing_creds" });
          if (worst === "ok") worst = "degraded";
          continue;
        }
        const r = await pingHttp(`${base.replace(/\/$/, "")}/instance/connectionState/${encodeURIComponent(inst.evolution_instance_name)}`, {
          headers: { apikey },
        });
        totalLatency += r.latency_ms;
        let state: string | undefined;
        try { state = JSON.parse(r.bodyText ?? "{}")?.instance?.state; } catch { /* noop */ }
        const ok = r.ok && state === "open";
        const s: CheckResult["status"] = ok ? "ok" : r.ok ? "degraded" : "down";
        details.push({ instance: inst.evolution_instance_name, http: r.status, state, latency: r.latency_ms, status: s });
        if (s === "down") worst = "down";
        else if (s === "degraded" && worst === "ok") worst = "degraded";
      }
      return { status: worst, latency_ms: Math.round(totalLatency / instances.length), details: { instances: details } };
    }

    case "api_evolution_go": {
      const { data: members } = await supabase
        .from("team_members")
        .select("evolution_instance_name, evo_go_base_url, evolution_api_key, evo_go_instance_token")
        .not("evo_go_instance_token", "is", null);
      const list = (members ?? []) as Array<{
        evolution_instance_name: string;
        evo_go_base_url: string | null;
        evolution_api_key: string | null;
      }>;
      const seen = new Map<string, typeof list[number]>();
      for (const m of list) if (!seen.has(m.evolution_instance_name)) seen.set(m.evolution_instance_name, m);
      const instances = [...seen.values()];
      if (instances.length === 0) return { status: "inactive", error_message: "Nenhuma instância EvoGo cadastrada" };
      const details: Record<string, unknown>[] = [];
      let worst: CheckResult["status"] = "ok";
      let totalLatency = 0;
      for (const inst of instances) {
        const base = inst.evo_go_base_url ?? "";
        const apikey = inst.evolution_api_key ?? "";
        if (!base || !apikey) {
          details.push({ instance: inst.evolution_instance_name, status: "inactive", reason: "missing_creds" });
          if (worst === "ok") worst = "degraded";
          continue;
        }
        const r = await pingHttp(`${base.replace(/\/$/, "")}/instance/fetchInstances`, { headers: { apikey } });
        totalLatency += r.latency_ms;
        const s: CheckResult["status"] = r.ok ? "ok" : "down";
        details.push({ instance: inst.evolution_instance_name, http: r.status, latency: r.latency_ms, status: s });
        if (s === "down") worst = "down";
      }
      return { status: worst, latency_ms: Math.round(totalLatency / instances.length), details: { instances: details } };
    }

    case "api_zernio": {
      const apiKey = Deno.env.get("ZERNIO_API_KEY");
      if (!apiKey) return { status: "inactive", error_message: "ZERNIO_API_KEY ausente" };
      const r = await pingHttp("https://api.zernio.com/v1/account", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return {
        status: gradeLatency(r.latency_ms, r.ok),
        http_status: r.status,
        latency_ms: r.latency_ms,
        error_message: r.error ?? (r.ok ? null : r.bodyText?.slice(0, 200) ?? null),
      };
    }

    case "api_google_business_oauth": {
      const { data: tok } = await supabase
        .from("google_oauth_tokens")
        .select("refresh_token, expires_at, updated_at")
        .limit(1)
        .maybeSingle();
      if (!tok) return { status: "inactive", error_message: "Nenhum token Google armazenado" };
      const refresh = (tok as { refresh_token?: string }).refresh_token;
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
      if (!refresh || !clientId || !clientSecret) return { status: "inactive", error_message: "Credenciais Google incompletas" };
      const r = await pingHttp("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refresh,
          grant_type: "refresh_token",
        }).toString(),
      });
      let err: string | null = null;
      try { err = JSON.parse(r.bodyText ?? "{}")?.error ?? null; } catch { /* noop */ }
      if (err === "invalid_grant") {
        return { status: "down", http_status: r.status, latency_ms: r.latency_ms, error_message: "Token revogado/invalid_grant — Reconectar Google" };
      }
      return {
        status: r.ok ? "ok" : "degraded",
        http_status: r.status,
        latency_ms: r.latency_ms,
        error_message: r.ok ? null : (err ?? r.bodyText?.slice(0, 200) ?? null),
      };
    }

    case "api_lovable_ai_deepseek":
    case "api_lovable_ai_gemini": {
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) return { status: "inactive", error_message: "LOVABLE_API_KEY ausente" };
      const model = key === "api_lovable_ai_gemini" ? "google/gemini-2.5-flash-lite" : "google/gemini-2.5-flash";
      const r = await pingHttp("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "health-check",
        },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
        timeoutMs: 15_000,
      });
      return {
        status: r.ok ? gradeLatency(r.latency_ms, true) : (r.status === 429 ? "degraded" : "down"),
        http_status: r.status,
        latency_ms: r.latency_ms,
        error_message: r.error ?? (r.ok ? null : r.bodyText?.slice(0, 200) ?? null),
      };
    }

    case "api_pandavideo_ping": {
      const apiKey = Deno.env.get("PANDAVIDEO_API_KEY");
      if (!apiKey) return { status: "inactive", error_message: "PANDAVIDEO_API_KEY ausente" };
      const r = await pingHttp("https://api-v2.pandavideo.com.br/videos?limit=1", {
        headers: { Authorization: apiKey },
      });
      return {
        status: gradeLatency(r.latency_ms, r.ok),
        http_status: r.status,
        latency_ms: r.latency_ms,
        error_message: r.error ?? (r.ok ? null : r.bodyText?.slice(0, 200) ?? null),
      };
    }

    case "api_tldv_out": {
      const apiKey = Deno.env.get("TLDV_API_KEY");
      if (!apiKey) return { status: "inactive", error_message: "TLDV_API_KEY ausente" };
      const r = await pingHttp("https://pasta.tldv.io/v1alpha1/meetings?limit=1", {
        headers: { "x-api-key": apiKey },
      });
      return {
        status: gradeLatency(r.latency_ms, r.ok),
        http_status: r.status,
        latency_ms: r.latency_ms,
        error_message: r.error ?? (r.ok ? null : r.bodyText?.slice(0, 200) ?? null),
      };
    }

    case "api_meta_capi_ping": {
      const token = Deno.env.get("META_ADS_MANAGER_TOKEN") ?? Deno.env.get("META_LEAD_ADS_TOKEN");
      if (!token) return { status: "inactive", error_message: "Token Meta ausente" };
      const r = await pingHttp(`https://graph.facebook.com/v20.0/me?access_token=${encodeURIComponent(token)}`);
      let err: string | null = null;
      try { err = JSON.parse(r.bodyText ?? "{}")?.error?.message ?? null; } catch { /* noop */ }
      return {
        status: r.ok && !err ? gradeLatency(r.latency_ms, true) : "down",
        http_status: r.status,
        latency_ms: r.latency_ms,
        error_message: err ?? (r.ok ? null : r.bodyText?.slice(0, 200) ?? null),
      };
    }

    default:
      return { status: "unknown", error_message: `Handler 'special' não implementado: ${key}` };
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
    } else if (item.check_type === "special") {
      result = await checkSpecial(item.key, supabase);
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