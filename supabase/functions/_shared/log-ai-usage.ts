import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cost per 1M tokens (USD)
const COST_RATES: Record<string, { input: number; output: number }> = {
  "lovable": { input: 0.15, output: 0.60 },
  "deepseek": { input: 0.14, output: 0.28 },
  "google": { input: 0.01, output: 0.01 },
};

function detectProvider(model: string): string {
  if (model.startsWith("google/")) return "lovable";
  if (model.startsWith("openai/")) return "lovable";
  if (model.includes("deepseek")) return "deepseek";
  if (model.includes("embedding")) return "google";
  return "lovable";
}

function estimateCost(provider: string, promptTokens: number, completionTokens: number): number {
  const rates = COST_RATES[provider] || COST_RATES["lovable"];
  return (promptTokens * rates.input + completionTokens * rates.output) / 1_000_000;
}

export async function logAIUsage(params: {
  functionName: string;
  actionLabel: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return;

    const provider = detectProvider(params.model);
    const totalTokens = params.promptTokens + params.completionTokens;
    const costUsd = estimateCost(provider, params.promptTokens, params.completionTokens);

    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from("ai_token_usage").insert({
      function_name: params.functionName,
      action_label: params.actionLabel,
      provider,
      model: params.model,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: costUsd,
      metadata: params.metadata || {},
    });
  } catch (e) {
    console.warn("[logAIUsage] Failed silently:", e);
  }
}

// Extract usage from OpenAI-compatible response
export function extractUsage(aiData: any): { prompt_tokens: number; completion_tokens: number } {
  return {
    prompt_tokens: aiData?.usage?.prompt_tokens || 0,
    completion_tokens: aiData?.usage?.completion_tokens || 0,
  };
}
