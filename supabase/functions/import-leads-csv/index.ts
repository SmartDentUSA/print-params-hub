import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ─── Phone normalizer (aggressive E.164 BR) ─── */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits || digits.length < 8) return null;
  // Remove leading 0
  if (digits.startsWith("0")) digits = digits.slice(1);
  // Remove country code 55
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  // Add "9" for mobile if 10 digits (DDD + 8 digits)
  if (digits.length === 10) {
    const ddd = parseInt(digits.slice(0, 2));
    if (ddd >= 11) digits = digits.slice(0, 2) + "9" + digits.slice(2);
  }
  if (digits.length < 10 || digits.length > 11) return null;
  return `+55${digits}`;
}

/* ─── Protected fields that should never be overwritten ─── */
const PROTECTED_FIELDS = new Set([
  "resumo_historico_ia",
  "rota_inicial_lia",
  "id",
  "created_at",
]);

/* ─── Build upsert object ─── */
function buildUpsertFields(
  lead: Record<string, unknown>,
  override: boolean
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const allowedColumns = new Set([
    "nome", "email", "telefone_raw", "telefone_normalized", "source", "form_name",
    "lead_status", "score", "data_primeiro_contato", "area_atuacao", "especialidade",
    "como_digitaliza", "tem_impressora", "impressora_modelo", "resina_interesse",
    "produto_interesse", "origem_campanha", "utm_source", "utm_medium", "utm_campaign",
    "utm_term", "proprietario_lead_crm", "status_atual_lead_crm", "funil_entrada_crm",
    "piperun_id", "id_cliente_smart", "rota_inicial_lia", "resumo_historico_ia",
    "reuniao_agendada", "data_contrato", "cs_treinamento", "ativo_scan", "ativo_notebook",
    "ativo_cad", "ativo_cad_ia", "ativo_smart_slice", "ativo_print", "ativo_cura",
    "ativo_insumos", "status_oportunidade", "valor_oportunidade", "tags_crm",
    "temperatura_lead", "motivo_perda", "comentario_perda", "cidade", "uf",
    "tem_scanner", "data_fechamento_crm", "lead_timing_dias", "itens_proposta_crm",
    "piperun_link", "raw_payload", "ultima_etapa_comercial", "ip_origem", "pais_origem",
    "data_ultima_compra_scan", "data_ultima_compra_notebook", "data_ultima_compra_cad",
    "data_ultima_compra_cad_ia", "data_ultima_compra_smart_slice", "data_ultima_compra_print",
    "data_ultima_compra_cura", "data_ultima_compra_insumos",
    "astron_user_id", "astron_status", "astron_nome", "astron_email", "astron_phone",
    "astron_plans_active", "astron_plans_data", "astron_courses_access",
    "astron_courses_total", "astron_courses_completed", "astron_login_url",
    "astron_created_at", "astron_last_login_at", "astron_synced_at",
  ]);

  for (const [k, v] of Object.entries(lead)) {
    if (PROTECTED_FIELDS.has(k)) continue;
    if (!allowedColumns.has(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    fields[k] = v;
  }
  return fields;
}

/* ─── Main handler ─── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, leads, override = false } = await req.json();

    if (!type || !Array.isArray(leads) || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: "type and leads[] required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { row: number; email: string; error: string }[] = [];

    for (let i = 0; i < leads.length; i++) {
      const raw = leads[i];
      try {
        const email = raw.email?.toString().trim().toLowerCase();
        const phone = normalizePhone(raw.telefone_raw || raw.telefone_normalized);
        const nome = raw.nome?.toString().trim();

        if (!email && !phone && !nome) {
          skipped++;
          continue;
        }

        // Normalize phone in fields
        const fields = buildUpsertFields(raw, override);
        if (phone) fields.telefone_normalized = phone;
        if (email) fields.email = email;
        if (fields.source === undefined) fields.source = type;

        // ─── Match strategy ───
        let existingId: string | null = null;

        // 1) Match by email
        if (email && email !== "placeholder@import.local") {
          const { data: byEmail } = await supabase
            .from("lia_attendances")
            .select("id")
            .eq("email", email)
            .limit(1)
            .maybeSingle();
          if (byEmail) existingId = byEmail.id;
        }

        // 2) Match by phone
        if (!existingId && phone) {
          const { data: byPhone } = await supabase
            .from("lia_attendances")
            .select("id")
            .eq("telefone_normalized", phone)
            .limit(1)
            .maybeSingle();
          if (byPhone) existingId = byPhone.id;
        }

        // 3) Match by name similarity (omie_vendas only)
        if (!existingId && type === "omie_vendas" && nome && nome.length >= 5) {
          const { data: byName } = await supabase.rpc("similarity", undefined as never)
            .catch(() => ({ data: null }));
          // Use raw SQL via a direct query approach
          // Since we can't run arbitrary SQL, do a text search instead
          const { data: candidates } = await supabase
            .from("lia_attendances")
            .select("id, nome")
            .ilike("nome", `%${nome.split(" ")[0]}%`)
            .limit(10);

          if (candidates && candidates.length > 0) {
            // Simple client-side similarity check
            const normalized = nome.toLowerCase();
            const match = candidates.find((c) => {
              const cNorm = c.nome.toLowerCase();
              // Check if names are very similar (shared words)
              const words1 = normalized.split(/\s+/);
              const words2 = cNorm.split(/\s+/);
              const shared = words1.filter((w) => words2.includes(w)).length;
              return shared >= Math.min(2, words1.length);
            });
            if (match) existingId = match.id;
          }
        }

        // ─── Upsert ───
        if (existingId) {
          // Update existing
          if (override) {
            // Direct overwrite (except protected)
            const { error: updateErr } = await supabase
              .from("lia_attendances")
              .update(fields)
              .eq("id", existingId);
            if (updateErr) throw updateErr;
          } else {
            // COALESCE-style: only set fields that are currently null
            const { data: existing } = await supabase
              .from("lia_attendances")
              .select("*")
              .eq("id", existingId)
              .single();

            if (existing) {
              const updateFields: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(fields)) {
                if (k === "email" || k === "nome") continue; // Don't overwrite identity
                const existingVal = (existing as Record<string, unknown>)[k];
                if (existingVal === null || existingVal === undefined || existingVal === "" || existingVal === false) {
                  updateFields[k] = v;
                }
              }
              // Always update source-related enrichment for tags (merge arrays)
              if (fields.tags_crm && existing.tags_crm) {
                const merged = [...new Set([...(existing.tags_crm as string[]), ...(fields.tags_crm as string[])])];
                updateFields.tags_crm = merged;
              }
              if (Object.keys(updateFields).length > 0) {
                const { error: updateErr } = await supabase
                  .from("lia_attendances")
                  .update(updateFields)
                  .eq("id", existingId);
                if (updateErr) throw updateErr;
              }
            }
          }
          updated++;
        } else {
          // Insert new
          if (!fields.nome) fields.nome = nome || "Sem Nome";
          if (!fields.email) fields.email = email || `import_${Date.now()}_${i}@placeholder.local`;

          const { error: insertErr } = await supabase
            .from("lia_attendances")
            .insert(fields);
          if (insertErr) {
            // If duplicate email conflict, try update instead
            if (insertErr.code === "23505") {
              const { error: updateErr } = await supabase
                .from("lia_attendances")
                .update(fields)
                .eq("email", fields.email as string);
              if (updateErr) throw updateErr;
              updated++;
            } else {
              throw insertErr;
            }
          } else {
            inserted++;
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ row: i, email: raw.email || "", error: msg });
      }
    }

    return new Response(
      JSON.stringify({ inserted, updated, skipped, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
