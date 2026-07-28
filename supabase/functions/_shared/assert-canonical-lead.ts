/**
 * Gate 2.2.3 — Canonical Lead Guard (SHADOW MODE)
 * -----------------------------------------------
 * Detects writes/reads that target a non-canonical `lia_attendances` row
 * (i.e. a row whose `merged_into` is not null). In shadow mode this function
 * NEVER throws, NEVER blocks — it only logs to `system_health_logs` and
 * returns the canonical id so callers can opt in to using it.
 *
 * Rollout: 24h shadow → human review of `canonical_shadow_hit` logs →
 * only then flip `MODE` to `"block"` via a follow-up migration/deploy.
 *
 * Usage:
 *   const { canonical, redirected } = await assertCanonicalLead(supabase, leadId, {
 *     source: "smart-ops-lia-assign",
 *     op: "update:lia_attendances",
 *   });
 *   // shadow: keep using leadId — do NOT switch to canonical yet.
 */

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export type AssertCanonicalCtx = {
  source: string;
  op?: string;
  extra?: Record<string, unknown>;
};

export type AssertCanonicalResult = {
  canonical: string | null;
  redirected: boolean;
  reason?: "not_found" | "lookup_error" | "ok";
};

// Shadow mode is the only supported mode right now. Gate 2.2.3 fase 2 flips this.
const MODE: "shadow" | "block" = "shadow";

export async function assertCanonicalLead(
  supabase: SupabaseLike,
  leadId: string | null | undefined,
  ctx: AssertCanonicalCtx,
): Promise<AssertCanonicalResult> {
  if (!leadId || typeof leadId !== "string") {
    return { canonical: null, redirected: false, reason: "not_found" };
  }

  try {
    const { data, error } = await supabase
      .from("lia_attendances")
      .select("id, merged_into")
      .eq("id", leadId)
      .maybeSingle();

    if (error) {
      return { canonical: leadId, redirected: false, reason: "lookup_error" };
    }
    if (!data) {
      return { canonical: null, redirected: false, reason: "not_found" };
    }

    const mergedInto = (data as { merged_into?: string | null }).merged_into ?? null;
    if (!mergedInto) {
      return { canonical: leadId, redirected: false, reason: "ok" };
    }

    // Non-canonical row targeted. In shadow mode: log + return canonical, no throw.
    try {
      await supabase.from("system_health_logs").insert({
        function_name: ctx.source,
        severity: "warning",
        error_type: "canonical_shadow_hit",
        lead_id: leadId,
        details: {
          mode: MODE,
          op: ctx.op ?? null,
          non_canonical_id: leadId,
          canonical_id: mergedInto,
          ...(ctx.extra ?? {}),
        },
      });
    } catch (_logErr) {
      // never let the shadow log break the caller
    }

    return { canonical: mergedInto, redirected: true, reason: "ok" };
  } catch (_err) {
    return { canonical: leadId, redirected: false, reason: "lookup_error" };
  }
}

export function isCanonicalShadowBlocking(): boolean {
  return (MODE as string) === "block";
}