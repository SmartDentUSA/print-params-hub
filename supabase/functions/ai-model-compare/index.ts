import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, system_prompt, models, max_tokens = 500 } = await req.json();

    if (!prompt) throw new Error("prompt is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not configured");

    const requestedModels: string[] = models || ["gemini", "deepseek"];

    const messages = [
      ...(system_prompt ? [{ role: "system", content: system_prompt }] : []),
      { role: "user", content: prompt },
    ];

    const tasks: Promise<{ model: string; response: string; latency_ms: number; error?: string }>[] = [];

    if (requestedModels.includes("gemini")) {
      tasks.push(
        (async () => {
          const start = Date.now();
          try {
            const res = await fetch(LOVABLE_GATEWAY, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages,
                max_tokens,
                stream: false,
              }),
            });
            if (!res.ok) {
              const t = await res.text();
              return { model: "gemini-2.5-flash", response: "", latency_ms: Date.now() - start, error: `${res.status}: ${t}` };
            }
            const data = await res.json();
            const usage = extractUsage(data);
            await logAIUsage({
              functionName: "ai-model-compare",
              actionLabel: "compare-gemini",
              model: "google/gemini-2.5-flash",
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
            });
            return {
              model: "gemini-2.5-flash",
              response: data.choices?.[0]?.message?.content || "",
              latency_ms: Date.now() - start,
            };
          } catch (e) {
            return { model: "gemini-2.5-flash", response: "", latency_ms: Date.now() - start, error: String(e) };
          }
        })()
      );
    }

    if (requestedModels.includes("deepseek")) {
      tasks.push(
        (async () => {
          const start = Date.now();
          try {
            const res = await fetch(DEEPSEEK_API, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "deepseek-chat",
                messages,
                max_tokens,
                stream: false,
              }),
            });
            if (!res.ok) {
              const t = await res.text();
              return { model: "deepseek-chat", response: "", latency_ms: Date.now() - start, error: `${res.status}: ${t}` };
            }
            const data = await res.json();
            const usage = extractUsage(data);
            await logAIUsage({
              functionName: "ai-model-compare",
              actionLabel: "compare-deepseek",
              model: "deepseek-chat",
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
            });
            return {
              model: "deepseek-chat",
              response: data.choices?.[0]?.message?.content || "",
              latency_ms: Date.now() - start,
            };
          } catch (e) {
            return { model: "deepseek-chat", response: "", latency_ms: Date.now() - start, error: String(e) };
          }
        })()
      );
    }

    const results = await Promise.all(tasks);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ai-model-compare] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
