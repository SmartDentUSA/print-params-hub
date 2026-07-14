// deno-lint-ignore-file no-explicit-any
/**
 * rayshape-fix-placeholder-leads
 * ------------------------------
 * Percorre lia_attendances com email ILIKE '%@import.placeholder' (merged_into IS NULL)
 * e enriquece a partir do PipeRun Deal → Person:
 *   - email = email real do Person (senão NULL)
 *   - telefone_normalized = phone normalizado
 *   - nome mantido (nunca sobrescreve — preserva razão social)
 *
 * Query params:
 *   ?dry_run=1  → não escreve, só retorna o plano
 *   ?limit=N    → processa apenas N leads (default: todos)
 *
 * Regra de rate-limit: 300ms entre chamadas PipeRun.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hydrateDealPayload } from "../_shared/piperun-deal-hydrate.ts";
import { piperunGet } from "../_shared/piperun-field-map.ts";
import { normalizeBrazilianPhone } from "../_shared/phone-normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pickPersonEmail(person: any): string | null {
  const arr = person?.contact_emails as Array<{ address?: string }> | undefined;
  const first = arr?.find((e) => e?.address)?.address;
  const legacy = person?.email;
  const raw = (first || legacy || "").toString().trim().toLowerCase();
  if (!raw) return null;
  if (raw.endsWith("@import.placeholder")) return null;
  if (/^(e-?mail\s*n[ãa]o\s*informado|n[ãa]o\s*informado)/i.test(raw)) return null;
  return raw;
}

function pickPersonPhone(person: any): string | null {
  const arr = person?.contact_phones as Array<{ number?: string }> | undefined;
  const first = arr?.find((p) => p?.number)?.number;
  const legacy = person?.phone || person?.mobile;
  const raw = (first || legacy || "").toString().trim();
  if (!raw) return null;
  return normalizeBrazilianPhone(raw);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const limit = Number(url.searchParams.get("limit") || "0") || null;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PIPERUN_KEY = Deno.env.get("PIPERUN_API_KEY");
  if (!PIPERUN_KEY) {
    return new Response(JSON.stringify({ error: "PIPERUN_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  let q = supa
    .from("lia_attendances")
    .select("id, nome, email, telefone_normalized, piperun_id")
    .ilike("email", "%@import.placeholder")
    .is("merged_into", null)
    .order("created_at", { ascending: true });
  if (limit) q = q.limit(limit);

  const { data: leads, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const lead of leads || []) {
    const step: any = {
      lead_id: lead.id,
      nome: lead.nome,
      piperun_id: lead.piperun_id,
      old_email: lead.email,
      old_phone: lead.telefone_normalized,
    };

    if (!lead.piperun_id) {
      step.action = dryRun ? "would_null_email" : "null_email_no_piperun_id";
      if (!dryRun) {
        await supa
          .from("lia_attendances")
          .update({ email: null })
          .eq("id", lead.id);
      }
      results.push(step);
      continue;
    }

    try {
      const { deal, hydrated, error: hErr } = await hydrateDealPayload(
        PIPERUN_KEY,
        String(lead.piperun_id),
        {},
      );
      if (!hydrated) {
        step.action = "hydrate_failed";
        step.hydrate_error = hErr;
        if (!dryRun) {
          await supa.from("lia_attendances").update({ email: null }).eq("id", lead.id);
          step.action = "null_email_hydrate_failed";
        }
        results.push(step);
        await sleep(300);
        continue;
      }

      let person = (deal as any).person as any;
      const personId = person?.id || (deal as any).person_id;
      step.person_id = personId || null;
      step.deal_person_id_raw = (deal as any).person_id ?? null;
      step.deal_top_keys = Object.keys(deal || {});

      // Se o hydrate não trouxe o bloco person mas o Deal tem person_id, faz GET /persons/{id}
      if ((!person || typeof person !== "object" || Object.keys(person).length === 0) && personId) {
        try {
          const r = await piperunGet(
            PIPERUN_KEY,
            `persons/${personId}`,
            {},
            { "with[]": ["contact_emails", "contact_phones"] },
          );
          const pdata = (r.data as any)?.data;
          if (pdata && typeof pdata === "object") {
            person = pdata;
            step.person_fetched = "direct_get";
          } else {
            step.person_fetched = `not_found_status_${r.status}`;
          }
          await sleep(300);
        } catch (e) {
          step.person_fetch_error = e instanceof Error ? e.message : String(e);
        }
      }

      const newEmail = pickPersonEmail(person);
      const newPhone = pickPersonPhone(person);
      step.new_email = newEmail;
      step.new_phone = newPhone;

      const updates: Record<string, any> = { email: newEmail };
      // Só grava telefone se ainda não existe (nunca sobrescreve identificador)
      if (newPhone && !lead.telefone_normalized) {
        updates.telefone_normalized = newPhone;
      }

      step.updates = updates;
      step.action = dryRun ? "would_update" : "updated";

      if (!dryRun) {
        const { error: upErr } = await supa
          .from("lia_attendances")
          .update(updates)
          .eq("id", lead.id);
        if (upErr) {
          step.action = "update_failed";
          step.update_error = upErr.message;
        } else {
          // Auditoria
          await supa.from("lead_enrichment_audit").insert({
            lead_id: lead.id,
            source: "rayshape_placeholder_fix",
            source_priority: 90,
            fields_updated: Object.keys(updates),
            previous_values: { email: lead.email, telefone_normalized: lead.telefone_normalized },
            new_values: {
              ...updates,
              piperun_deal_id: lead.piperun_id,
              piperun_person_id: person?.id || null,
            },
          });
        }
      }
    } catch (e) {
      step.action = "exception";
      step.exception = e instanceof Error ? e.message : String(e);
    }

    results.push(step);
    await sleep(300);
  }

  return new Response(
    JSON.stringify({
      total: leads?.length || 0,
      dry_run: dryRun,
      results,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});