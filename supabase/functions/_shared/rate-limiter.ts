/**
 * Rate Limiter — uses system_health_logs to track request counts per identifier.
 * Zero new tables required.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  maxPerMinute: number
): Promise<RateLimitResult> {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();

  try {
    // Count recent requests for this identifier
    const { count, error } = await supabase
      .from("system_health_logs")
      .select("id", { count: "exact", head: true })
      .eq("function_name", `rate_limit_${identifier}`)
      .gte("created_at", oneMinuteAgo);

    if (error) {
      console.warn(`[rate-limiter] Count query failed for ${identifier}:`, error.message);
      // Fail open — allow the request if we can't check
      return { allowed: true, remaining: maxPerMinute };
    }

    const currentCount = count || 0;
    const remaining = Math.max(0, maxPerMinute - currentCount);

    if (currentCount >= maxPerMinute) {
      console.warn(`[rate-limiter] RATE LIMIT EXCEEDED for ${identifier}: ${currentCount}/${maxPerMinute}`);

      // Log the rate limit event
      await supabase.from("system_health_logs").insert({
        function_name: `rate_limit_${identifier}`,
        severity: "warning",
        error_type: "rate_limit_exceeded",
        details: {
          identifier,
          current_count: currentCount,
          max_per_minute: maxPerMinute,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {});

      return { allowed: false, remaining: 0, retryAfterMs: 60_000 };
    }

    // Log this request for future counting
    await supabase.from("system_health_logs").insert({
      function_name: `rate_limit_${identifier}`,
      severity: "info",
      error_type: "rate_limit_tick",
      details: { count: currentCount + 1, max: maxPerMinute },
    }).catch(() => {});

    return { allowed: true, remaining: remaining - 1 };
  } catch (e) {
    console.warn(`[rate-limiter] Error checking rate limit for ${identifier}:`, e);
    // Fail open
    return { allowed: true, remaining: maxPerMinute };
  }
}

/**
 * Build a 429 Too Many Requests response with standard headers.
 */
export function rateLimitResponse(
  corsHeaders: Record<string, string>,
  retryAfterMs = 60_000
): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
      retry_after_seconds: Math.ceil(retryAfterMs / 1000),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
      },
    }
  );
}
