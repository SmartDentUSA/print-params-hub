// AI Router — orquestra chamada de modelo IA por task_type.
// Lê a tabela public.ai_model_routing (provedor primário + fallback) e roteia
// para o adapter correto (Poe, Lovable Gateway, DeepSeek).
//
// Uso:
//   import { aiComplete } from "../_shared/ai-router.ts";
//   const r = await aiComplete({ task: "copilot_default", messages, functionName: "smart-ops-copilot" });
//   r.text  // resposta
//   r.provider_used, r.model_used

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { callPoe } from "./providers/poe.ts";
import { logAIUsage } from "./log-ai-usage.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export type Provider = "poe" | "lovable" | "deepseek";

export interface RoutingRow {
  task_type: string;
  primary_provider: Provider;
  primary_model: string;
  fallback_provider: Provider | null;
  fallback_model: string | null;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
  input_cost_per_m: number;
  output_cost_per_m: number;
}

export interface AiCompleteParams {
  task: string;
  messages: Array<{ role: string; content: any }>;
  functionName: string;
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
  toolChoice?: any;
  responseFormat?: any;          // ex: { type: "json_object" }
}

export interface AiCompleteResult {
  ok: boolean;
  text?: string;
  toolCalls?: any[];
  provider_used?: Provider;
  model_used?: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
  attempts: Array<{ provider: Provider; model: string; status: number; reason?: string }>;
  error?: string;
  error_code?: "credits_exhausted" | "rate_limited" | "no_route" | "all_failed" | "unknown";
}

// In-memory route cache (60s TTL) — evita SELECT a cada chamada.
const routeCache = new Map<string, { row: RoutingRow; expiresAt: number }>();

async function loadRoute(task: string): Promise<RoutingRow | null> {
  const cached = routeCache.get(task);
  if (cached && cached.expiresAt > Date.now()) return cached.row;

  const { data, error } = await sb
    .from("ai_model_routing")
    .select("*")
    .eq("task_type", task)
    .maybeSingle();

  if (error || !data) {
    console.warn(`[ai-router] task '${task}' não encontrado em ai_model_routing`);
    return null;
  }
  if (!data.enabled) {
    console.warn(`[ai-router] task '${task}' está desabilitado`);
    return null;
  }
  const row = data as RoutingRow;
  routeCache.set(task, { row, expiresAt: Date.now() + 60_000 });
  return row;
}

async function callProvider(
  provider: Provider,
  model: string,
  params: AiCompleteParams,
  temperature: number,
  maxTokens: number,
): Promise<{ ok: boolean; status: number; text?: string; toolCalls?: any[]; usage?: any; error?: string }> {
  if (provider === "poe") {
    const r = await callPoe({
      model, messages: params.messages, tools: params.tools,
      tool_choice: params.toolChoice, response_format: params.responseFormat,
      temperature, max_tokens: maxTokens,
    });
    return { ok: r.ok, status: r.status, text: r.text, toolCalls: r.toolCalls, usage: r.usage, error: r.error };
  }

  // Lovable Gateway e DeepSeek compartilham formato OpenAI-compat.
  const url = provider === "lovable"
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://api.deepseek.com/chat/completions";
  const apiKey = provider === "lovable" ? LOVABLE_API_KEY : DEEPSEEK_API_KEY;
  if (!apiKey) return { ok: false, status: 0, error: `${provider} API key ausente` };

  const body: Record<string, unknown> = { model, messages: params.messages, stream: false, temperature, max_tokens: maxTokens };
  if (params.tools) body.tools = params.tools;
  if (params.toolChoice) body.tool_choice = params.toolChoice;
  if (params.responseFormat) body.response_format = params.responseFormat;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    const txt = await resp.text();
    let parsed: any; try { parsed = JSON.parse(txt); } catch { parsed = null; }
    if (!resp.ok) return { ok: false, status: resp.status, error: parsed?.error?.message || txt.slice(0, 500) };
    const msg = parsed?.choices?.[0]?.message ?? {};
    return {
      ok: true,
      status: resp.status,
      text: typeof msg.content === "string" ? msg.content : (msg.content?.[0]?.text ?? ""),
      toolCalls: msg.tool_calls,
      usage: parsed?.usage,
    };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message || String(e) };
  }
}

function shouldFallback(status: number, errMsg?: string): boolean {
  if (status === 0) return true;           // network error
  if (status === 429) return true;          // rate limit
  if (status === 402) return true;          // out of credits
  if (status >= 500) return true;           // server error
  const m = (errMsg || "").toLowerCase();
  if (/insufficient|quota|balance|billing/.test(m)) return true;
  return false;
}

export async function aiComplete(params: AiCompleteParams): Promise<AiCompleteResult> {
  const attempts: AiCompleteResult["attempts"] = [];
  const row = await loadRoute(params.task);

  if (!row) {
    return { ok: false, attempts, error: `task '${params.task}' não roteado`, error_code: "no_route" };
  }

  const temperature = params.temperature ?? Number(row.temperature ?? 0.7);
  const maxTokens = params.maxTokens ?? row.max_tokens ?? 4096;

  // 1) Primary
  let r = await callProvider(row.primary_provider, row.primary_model, params, temperature, maxTokens);
  attempts.push({ provider: row.primary_provider, model: row.primary_model, status: r.status, reason: r.error });

  // 2) Fallback se necessário
  if (!r.ok && row.fallback_provider && row.fallback_model && shouldFallback(r.status, r.error)) {
    console.warn(`[ai-router] ${params.task}: primary ${row.primary_provider}/${row.primary_model} falhou (${r.status}), tentando fallback`);
    r = await callProvider(row.fallback_provider, row.fallback_model, params, temperature, maxTokens);
    attempts.push({ provider: row.fallback_provider, model: row.fallback_model, status: r.status, reason: r.error });
  }

  if (!r.ok) {
    const lastStatus = attempts[attempts.length - 1]?.status;
    const code: AiCompleteResult["error_code"] =
      lastStatus === 402 ? "credits_exhausted"
      : lastStatus === 429 ? "rate_limited"
      : "all_failed";
    return { ok: false, attempts, error: r.error || `HTTP ${r.status}`, error_code: code };
  }

  const used = attempts[attempts.length - 1];
  // Log de uso (fire-and-forget).
  if (r.usage) {
    logAIUsage({
      functionName: params.functionName,
      actionLabel: params.task,
      model: `${used.provider}/${used.model}`,
      promptTokens: r.usage.prompt_tokens || 0,
      completionTokens: r.usage.completion_tokens || 0,
      metadata: { task: params.task, attempts: attempts.length },
    }).catch(() => {});
  }

  return {
    ok: true,
    text: r.text,
    toolCalls: r.toolCalls,
    provider_used: used.provider,
    model_used: used.model,
    usage: r.usage ? { prompt_tokens: r.usage.prompt_tokens || 0, completion_tokens: r.usage.completion_tokens || 0 } : undefined,
    attempts,
  };
}

export function invalidateRouteCache(task?: string) {
  if (task) routeCache.delete(task); else routeCache.clear();
}