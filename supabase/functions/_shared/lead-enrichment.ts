// Cross-lookup enrichment + deterministic cognitive fallback used by lia-assign
// (and reusable by other briefing producers) to make seller notes richer when
// the lead's canonical row is missing equipment marks, Omie ERP status, or
// cognitive analysis (which requires ≥5 chat msgs and is null for fresh leads).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const EQUIP_FIELDS = [
  "scanner_marca",
  "impressora_modelo",
  "tem_scanner",
  "tem_impressora",
  "equip_scanner",
  "equip_scanner_bancada",
  "equip_impressora",
  "equip_pos_impressao",
  "equip_cad",
  "equip_fresadora",
  "equip_notebook",
  "software_cad",
  "como_digitaliza",
  "area_atuacao",
  "especialidade",
] as const;

const OMIE_FIELDS = [
  "omie_codigo_cliente",
  "omie_razao_social",
  "omie_faturamento_total",
  "omie_ticket_medio",
  "omie_total_pedidos",
  "omie_ultima_compra",
  "omie_classificacao",
  "omie_segmento",
  "omie_score",
  "omie_inadimplente",
] as const;

export interface EnrichmentMeta {
  siblings_found: number;
  equipment_filled_from_siblings: string[];
  omie_match: boolean;
  form_responses_count: number;
  cognitive_present: boolean;
}

/**
 * Returns a shallow copy of `lead` with missing equipment/Omie/cognitive fields
 * filled in from sibling canonical leads (same email/phone), plus an EnrichmentMeta
 * describing what was actually enriched. Does NOT persist to DB — in-memory only.
 * Respects CDP Integrity: only reads `merged_into IS NULL` rows.
 */
export async function enrichLeadFromIdentity(
  supabase: SupabaseClient,
  lead: Record<string, unknown>,
): Promise<{ enriched: Record<string, unknown>; meta: EnrichmentMeta }> {
  const enriched: Record<string, unknown> = { ...lead };
  const meta: EnrichmentMeta = {
    siblings_found: 0,
    equipment_filled_from_siblings: [],
    omie_match: false,
    form_responses_count: 0,
    cognitive_present: Boolean(lead.cognitive_analysis),
  };

  const email = (lead.email as string | null)?.toLowerCase().trim() || null;
  const phone = (lead.telefone_normalized as string | null) || null;
  const leadId = lead.id as string | undefined;

  // ── 1. Sibling lookup (other canonical leads same email/phone) ──
  if (email || phone) {
    try {
      const filters: string[] = [];
      if (email) filters.push(`email.eq.${email}`);
      if (phone) filters.push(`telefone_normalized.eq.${phone}`);
      let q = supabase
        .from("lia_attendances")
        .select(EQUIP_FIELDS.join(",") + ",created_at,id")
        .is("merged_into", null)
        .or(filters.join(","))
        .order("created_at", { ascending: false })
        .limit(20);
      if (leadId) q = q.neq("id", leadId);
      const { data: siblings } = await q;
      if (siblings && siblings.length > 0) {
        meta.siblings_found = siblings.length;
        for (const field of EQUIP_FIELDS) {
          const current = enriched[field];
          if (current != null && String(current).trim() !== "" && String(current).toLowerCase() !== "não") {
            continue;
          }
          for (const sib of siblings as Array<Record<string, unknown>>) {
            const v = sib[field];
            if (v != null && String(v).trim() !== "" && String(v).toLowerCase() !== "não") {
              enriched[field] = v;
              meta.equipment_filled_from_siblings.push(field);
              break;
            }
          }
        }
      }
    } catch (e) {
      console.warn("[lead-enrichment] sibling lookup failed:", e);
    }
  }

  // ── 2. Omie ERP signal (Omie columns live directly on lia_attendances; backfill
  //       from canonical siblings when the current lead row hasn't been linked yet) ──
  if (!enriched.omie_codigo_cliente && (email || phone)) {
    try {
      const filters: string[] = [];
      if (email) filters.push(`email.eq.${email}`);
      if (phone) filters.push(`telefone_normalized.eq.${phone}`);
      let q = supabase
        .from("lia_attendances")
        .select(OMIE_FIELDS.join(",") + ",id")
        .is("merged_into", null)
        .not("omie_codigo_cliente", "is", null)
        .or(filters.join(","))
        .limit(1);
      if (leadId) q = q.neq("id", leadId);
      const { data: omieSib } = await q.maybeSingle();
      if (omieSib) {
        for (const f of OMIE_FIELDS) {
          if (enriched[f] == null) enriched[f] = (omieSib as Record<string, unknown>)[f];
        }
        meta.omie_match = true;
      }
    } catch (e) {
      console.warn("[lead-enrichment] omie sibling lookup failed:", e);
    }
  }
  if (enriched.omie_codigo_cliente) meta.omie_match = true;

  // ── 3. Form-responses count (for audit only; consumers already fetch the values) ──
  if (leadId) {
    try {
      const { count } = await supabase
        .from("smartops_form_field_responses")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadId);
      meta.form_responses_count = count ?? 0;
    } catch { /* swallow */ }
  }

  return { enriched, meta };
}

/**
 * Deterministic cognitive fallback for leads with no `cognitive_analysis` yet
 * (most form-entry leads have 0 chat msgs at briefing time, so the LLM cognitive
 * pipeline hasn't run). Produces a conservative profile so the seller card never
 * shows pure "N/A / 0%".
 */
export function buildDeterministicCognitiveFallback(
  lead: Record<string, unknown>,
): {
  confidence: number;
  estagio: string;
  urgencia: string;
  timeline: string;
  perfil: string;
  motivacao: string;
  risco: string;
  abordagem: string;
  is_fallback: true;
} {
  const status = String(lead.status_oportunidade || "").toLowerCase();
  const isClient = status === "ganha" || Boolean(lead.omie_codigo_cliente);
  const hasLostDeal = status === "perdida" || status === "perdida_renutrir";
  const produto = String(lead.produto_interesse || "").toLowerCase();

  const estagio = isClient
    ? "reativação_cliente"
    : hasLostDeal
      ? "reengajamento"
      : "descoberta";

  const premiumKeywords = ["rayshape", "ino 200", "ino200", "scanner", "intraoral", "medit", "3shape"];
  const isPremium = premiumKeywords.some((k) => produto.includes(k));
  const urgencia = isPremium ? "media" : "baixa";

  const perfil = isClient ? "cliente_recorrente" : "explorador_racional";
  const motivacao = isClient
    ? "ampliar fluxo digital existente"
    : "iniciar ou modernizar fluxo digital";
  const risco = isClient ? "comparação com concorrência" : "preço e curva de aprendizado";
  const abordagem = isClient
    ? "Resgatar histórico de compras e oferecer upgrade/complemento. Mencionar suporte continuado."
    : "Iniciar com perguntas abertas sobre fluxo atual. Oferecer demo e prova social de iniciantes.";

  return {
    confidence: 40, // deterministic floor: signals presença de dados estruturados, não chat
    estagio,
    urgencia,
    timeline: "30-90 dias",
    perfil,
    motivacao,
    risco,
    abordagem,
    is_fallback: true,
  };
}

/**
 * Health-log helper. Fire-and-forget audit so we can measure briefing quality
 * over time without blocking the seller notification path.
 */
export async function logBriefingAudit(
  supabase: SupabaseClient,
  leadId: string,
  meta: EnrichmentMeta,
  promptChars: number,
  email: string | null,
): Promise<void> {
  try {
    await supabase.from("system_health_logs").insert({
      function_name: "smart-ops-lia-assign",
      severity: "info",
      error_type: "briefing_quality_audit",
      lead_id: leadId,
      lead_email: email,
      details: {
        ...meta,
        prompt_chars: promptChars,
      },
    });
  } catch (e) {
    console.warn("[lead-enrichment] audit log failed:", e);
  }
}