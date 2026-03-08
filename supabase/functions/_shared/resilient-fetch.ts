/**
 * Resilient Fetch — retry with exponential backoff + dead letter logging.
 * Used by ingest-lead and other orchestrators for fire-and-forget calls.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ResilientFetchConfig {
  maxRetries?: number;
  backoffMs?: number;
  deadLetterTable?: string;
  functionName?: string;
  actionLabel?: string;
  leadEmail?: string;
}

export async function resilientFetch(
  url: string,
  options: RequestInit,
  config: ResilientFetchConfig = {}
): Promise<Response | null> {
  const { maxRetries = 3, backoffMs = 500, deadLetterTable = "system_health_logs", functionName = "unknown", actionLabel = "resilient_fetch", leadEmail } = config;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok || response.status === 400 || response.status === 404) {
        // Success or client error (no point retrying)
        return response;
      }

      // Server error — retry
      console.warn(`[resilient-fetch] Attempt ${attempt + 1}/${maxRetries} failed: HTTP ${response.status} for ${url}`);
      lastError = `HTTP ${response.status}`;
    } catch (err) {
      console.warn(`[resilient-fetch] Attempt ${attempt + 1}/${maxRetries} exception for ${url}:`, err);
      lastError = err;
    }

    // Exponential backoff
    if (attempt < maxRetries - 1) {
      const delay = backoffMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // All retries failed — log to dead letter
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    await supabase.from(deadLetterTable).insert({
      function_name: functionName,
      severity: "error",
      error_type: "dead_letter",
      lead_email: leadEmail || null,
      details: {
        action: actionLabel,
        url,
        method: options.method || "GET",
        error: String(lastError),
        body_preview: typeof options.body === "string" ? options.body.slice(0, 500) : null,
        retries_exhausted: maxRetries,
        timestamp: new Date().toISOString(),
      },
    });

    console.error(`[resilient-fetch] DEAD LETTER logged for ${functionName}/${actionLabel}: ${url}`);
  } catch (logErr) {
    console.error(`[resilient-fetch] Failed to log dead letter:`, logErr);
  }

  return null;
}
