/**
 * Shared Lead Enrichment Module
 * Implements smart merge with source priority, field categories, and audit logging.
 * Used by ingest-lead, sync-piperun, sellflux-webhook, and other ingestion paths.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Source Priority (lower = more authoritative) ───

export const SOURCE_PRIORITY: Record<string, number> = {
  piperun_webhook: 1,
  piperun_sync: 2,
  ecommerce_webhook: 3,
  loja_integrada: 3,
  astron_postback: 4,
  sellflux_webhook: 5,
  sellflux: 5,
  meta_lead_ads: 6,
  meta_ads: 6,
  formulario: 7,
  vendedor_direto: 8,
  default: 10,
};

// ─── Field Categories ───

/** Fields that ALWAYS update (latest value wins, regardless of source) */
const ALWAYS_UPDATE: Set<string> = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term",
  "tags_crm",
  "valor_oportunidade", "status_oportunidade",
  "temperatura_lead", "lead_status",
  "proprietario_lead_crm",
  "updated_at",
  // SellFlux custom fields (JSONB merge)
  "sellflux_custom_fields",
  // Form metadata — each new submission overwrites with latest form context
  "form_name", "nome",
  // Product/interest fields — latest submission wins
  "produto_interesse", "area_atuacao", "especialidade",
  // Primary-deal snapshot fields (deterministic via pickPrimaryDeal)
  "status_atual_lead_crm", "funil_entrada_crm",
  "piperun_pipeline_id", "piperun_pipeline_name",
  "piperun_stage_id", "piperun_stage_name",
  "piperun_owner_id", "piperun_owner_email",
  "data_fechamento_crm",
]);

/** Fields that are PROTECTED — never overwrite if they have a value */
const PROTECTED_FIELDS: Set<string> = new Set([
  "entrada_sistema", "piperun_id", "piperun_created_at",
  "pessoa_hash", "pessoa_piperun_id",
  "li_cliente_id", "astron_user_id",
  "id", "created_at", "email",
]);

/** Array fields that should be merged (append + dedup) instead of replaced */
const MERGE_ARRAY_FIELDS: Set<string> = new Set([
  "tags_crm",
  "emails_secundarios",
  "telefones_secundarios",
]);

/** JSONB fields that should be deeply merged */
const MERGE_JSONB_FIELDS: Set<string> = new Set([
  "sellflux_custom_fields",
  "raw_payload",
]);

// ─── Utility: Merge Tags CRM (append + dedup + sort) ───

export function mergeTagsCrm(
  currentTags: string[] | null,
  newTags: string[] | null,
  toRemove: string[] = []
): string[] {
  const set = new Set(currentTags || []);
  for (const tag of toRemove) set.delete(tag);
  for (const tag of (newTags || [])) set.add(tag);
  return [...set].sort();
}

// ─── Utility: Merge JSONB safely ───

export function mergeJsonbSafely(
  current: Record<string, unknown> | null,
  incoming: Record<string, unknown> | null
): Record<string, unknown> {
  if (!current && !incoming) return {};
  if (!current) return incoming || {};
  if (!incoming) return current;
  return { ...current, ...incoming };
}

// ─── Core: Smart Lead Merge ───

export interface MergeResult {
  merged: Record<string, unknown>;
  fieldsUpdated: string[];
  fieldsSkipped: string[];
}

/**
 * Smart merge with source-aware priority and field categories.
 * 
 * @param existing - Current lead record from database
 * @param incoming - New data payload
 * @param source - Source identifier (e.g., 'piperun_webhook', 'sellflux', 'meta_ads')
 * @returns Merged payload (only changed fields), list of updated and skipped fields
 */
export function mergeSmartLead(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  source: string
): MergeResult {
  const merged: Record<string, unknown> = {};
  const fieldsUpdated: string[] = [];
  const fieldsSkipped: string[] = [];

  for (const [key, newValue] of Object.entries(incoming)) {
    // Skip null/undefined incoming values
    if (newValue === null || newValue === undefined) continue;

    const existingValue = existing[key];

    // 1. PROTECTED: never overwrite
    if (PROTECTED_FIELDS.has(key)) {
      if (existingValue !== null && existingValue !== undefined && existingValue !== "") {
        fieldsSkipped.push(key);
        continue;
      }
    }

    // 2. MERGE ARRAYS: append + dedup
    if (MERGE_ARRAY_FIELDS.has(key)) {
      if (key === "tags_crm") {
        const currentArr = Array.isArray(existingValue) ? existingValue as string[] : [];
        const newArr = Array.isArray(newValue) ? newValue as string[] : [];
        if (newArr.length > 0) {
          const mergedTags = mergeTagsCrm(currentArr, newArr);
          // Only update if tags actually changed
          if (JSON.stringify(mergedTags) !== JSON.stringify(currentArr)) {
            merged[key] = mergedTags;
            fieldsUpdated.push(key);
          }
        }
        continue;
      }
      // Generic array merge
      const currentArr = Array.isArray(existingValue) ? existingValue as string[] : [];
      const newArr = Array.isArray(newValue) ? newValue as string[] : [];
      if (newArr.length > 0) {
        const mergedArr = [...new Set([...currentArr, ...newArr])];
        if (mergedArr.length !== currentArr.length) {
          merged[key] = mergedArr;
          fieldsUpdated.push(key);
        }
      }
      continue;
    }

    // 3. MERGE JSONB: deep merge
    if (MERGE_JSONB_FIELDS.has(key) && key !== "tags_crm") {
      const currentObj = (typeof existingValue === "object" && existingValue !== null)
        ? existingValue as Record<string, unknown>
        : null;
      const newObj = (typeof newValue === "object" && newValue !== null)
        ? newValue as Record<string, unknown>
        : null;
      if (newObj) {
        const mergedObj = mergeJsonbSafely(currentObj, newObj);
        merged[key] = mergedObj;
        fieldsUpdated.push(key);
      }
      continue;
    }

    // 4. ALWAYS_UPDATE: latest value wins
    if (ALWAYS_UPDATE.has(key)) {
      if (newValue !== existingValue) {
        merged[key] = newValue;
        fieldsUpdated.push(key);
      }
      continue;
    }

    // 5. ENRICHMENT_ONLY (default): only fill if currently null/empty
    if (existingValue === null || existingValue === undefined || existingValue === "") {
      merged[key] = newValue;
      fieldsUpdated.push(key);
    } else {
      fieldsSkipped.push(key);
    }
  }

  return { merged, fieldsUpdated, fieldsSkipped };
}

// ─── Audit Logging ───

export async function logEnrichmentAudit(
  leadId: string,
  source: string,
  fieldsUpdated: string[],
  previousValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<void> {
  if (fieldsUpdated.length === 0) return;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    await supabase.from("lead_enrichment_audit").insert({
      lead_id: leadId,
      source,
      source_priority: SOURCE_PRIORITY[source] || 10,
      fields_updated: fieldsUpdated,
      previous_values: previousValues || null,
      new_values: newValues || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[lead-enrichment] Audit log failed:", err);
  }
}
