// smart-ops-field-normalize
// Bulk-normalize legacy values in lia_attendances qualification fields against
// the canonical option list registered in smartops_form_fields (or a
// hardcoded fallback for CRM-derived fields). Always scoped to canonical
// leads (merged_into IS NULL).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Whitelist of columns allowed to be normalized. Never expose identifiers,
// timestamps or merge control columns here.
const FIELD_WHITELIST = new Set<string>([
  "area_atuacao",
  "especialidade",
  "tem_scanner",
  "equip_scanner",
  "scanner_modelo",
  "marca_scanner",
  "tem_impressora",
  "impressora_modelo",
  "marca_impressora",
  "tem_cad",
  "tem_fresadora",
  "imprime_modelos",
  "imprime_placas",
  "imprime_guias",
  "imprime_resinas_ld",
  "sdr_software_cad_interesse",
  "produto_interesse",
  "produto_interesse_auto",
  "temperatura",
  "real_status",
  "prazo_compra",
  "tipo_local",
  "sdr_completo",
  "uf",
  "funil_crm",
  "etapa_crm",
  "status_piperun",
  "proprietario_lead_crm",
  // read-only listing (no auto suggest, still safe to merge manually)
  "origem_primeiro_contato",
  "form_name",
  "utm_campaign",
  "cidade",
]);

// Hardcoded fallback canonicals when smartops_form_fields has no options for
// the column (booleans, enums, external sources).
const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const FALLBACK_OPTIONS: Record<string, string[]> = {
  tem_impressora: ["SIM", "NÃO"],
  tem_cad: ["SIM", "NÃO"],
  tem_fresadora: ["SIM", "NÃO"],
  imprime_modelos: ["SIM", "NÃO"],
  imprime_placas: ["SIM", "NÃO"],
  temperatura: ["FRIO", "MORNO", "QUENTE"],
  real_status: ["ativo", "perdido", "cliente", "renutrir"],
  tipo_local: ["clinica", "laboratorio", "radiologia", "planning_center", "outro"],
  sdr_completo: ["SIM", "NÃO"],
  prazo_compra: ["imediato", "30_dias", "60_dias", "90_dias", "sem_prazo"],
  uf: UF_LIST,
  // marca_* derived from the corresponding equipment lists; filled by handler.
  marca_scanner: [],
  marca_impressora: [],
};

// Fields where auto-suggest should NOT run (avoid destroying UTM/campaign data)
const NO_AUTO_SUGGEST = new Set<string>([
  "origem_primeiro_contato",
  "form_name",
  "utm_campaign",
  "cidade",
  "produto_interesse",
  "produto_interesse_auto",
]);

function slugify(input: string | undefined | null): string {
  if (!input) return "";
  return String(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function listOptions(supabase: any, field: string): Promise<{ options: string[]; source: string }> {
  // Try smartops_form_fields first — this IS the system canonical.
  const { data } = await supabase
    .from("smartops_form_fields")
    .select("options")
    .eq("db_column", field);
  const union = new Set<string>();
  for (const row of (data ?? []) as Array<{ options: unknown }>) {
    if (Array.isArray(row.options)) {
      for (const o of row.options) {
        const s = String(o ?? "").trim();
        if (s) union.add(s);
      }
    }
  }
  if (union.size > 0) {
    return { options: [...union].sort(), source: "smartops_form_fields" };
  }
  // marca_* derives from equipment lists in the same table
  if (field === "marca_scanner") {
    const { options } = await listOptions(supabase, "equip_scanner");
    return { options, source: "derived:equip_scanner" };
  }
  if (field === "marca_impressora") {
    const { options } = await listOptions(supabase, "impressora_modelo");
    return { options, source: "derived:impressora_modelo" };
  }
  // DB-derived canonicals for fields that have no form-field definition.
  const derived = await derivedOptions(supabase, field);
  if (derived) return derived;
  const fallback = FALLBACK_OPTIONS[field];
  if (fallback && fallback.length > 0) {
    return { options: fallback, source: "fallback_constant" };
  }
  return { options: [], source: "none" };
}

function uniqSorted(values: Array<unknown>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Distinct non-null values already present in a lia_attendances column. */
async function distinctFromLeads(supabase: any, column: string): Promise<string[]> {
  const { data } = await supabase
    .from("lia_attendances")
    .select(column)
    .is("merged_into", null)
    .not(column, "is", null)
    .limit(20000);
  return uniqSorted((data ?? []).map((r: Record<string, unknown>) => r[column]));
}

async function derivedOptions(
  supabase: any,
  field: string,
): Promise<{ options: string[]; source: string } | null> {
  switch (field) {
    case "produto_interesse":
    case "produto_interesse_auto": {
      const { data: mfm } = await supabase
        .from("meta_form_mappings")
        .select("product_name")
        .not("product_name", "is", null);
      const fromMappings = uniqSorted((mfm ?? []).map((r: any) => r.product_name));
      const existing = await distinctFromLeads(supabase, field);
      return {
        options: uniqSorted([...fromMappings, ...existing]),
        source: "derived:meta_form_mappings+leads",
      };
    }
    case "funil_crm": {
      const { data } = await supabase.from("deals").select("pipeline_name").not("pipeline_name", "is", null).limit(20000);
      return { options: uniqSorted((data ?? []).map((r: any) => r.pipeline_name)), source: "derived:deals.pipeline_name" };
    }
    case "etapa_crm": {
      const { data } = await supabase.from("deals").select("stage_name").not("stage_name", "is", null).limit(20000);
      return { options: uniqSorted((data ?? []).map((r: any) => r.stage_name)), source: "derived:deals.stage_name" };
    }
    case "status_piperun": {
      const { data } = await supabase.from("deals").select("status").not("status", "is", null).limit(20000);
      const fromDeals = uniqSorted((data ?? []).map((r: any) => r.status));
      const existing = await distinctFromLeads(supabase, "status_piperun");
      return {
        options: uniqSorted([...fromDeals, ...existing, "aberta", "ganha", "perdida"]),
        source: "derived:deals.status+leads",
      };
    }
    case "proprietario_lead_crm": {
      const { data } = await supabase
        .from("team_members")
        .select("nome_completo")
        .eq("ativo", true)
        .not("nome_completo", "is", null);
      return { options: uniqSorted((data ?? []).map((r: any) => r.nome_completo)), source: "derived:team_members" };
    }
    case "form_name": {
      const { data } = await supabase
        .from("meta_form_mappings")
        .select("form_name_meta")
        .not("form_name_meta", "is", null);
      const fromMappings = uniqSorted((data ?? []).map((r: any) => r.form_name_meta));
      const existing = await distinctFromLeads(supabase, "form_name");
      return { options: uniqSorted([...fromMappings, ...existing]), source: "derived:meta_form_mappings+leads" };
    }
    case "origem_primeiro_contato":
    case "utm_campaign":
    case "cidade": {
      const existing = await distinctFromLeads(supabase, field);
      return { options: existing, source: "derived:leads_distinct" };
    }
    default:
      return null;
  }
}

async function listValues(supabase: any, field: string) {
  // Aggregate distinct values with counts. Uses raw RPC-style via SQL.
  const { data, error } = await supabase.rpc("smart_ops_field_normalize_distinct", {
    p_field: field,
  });
  if (!error && Array.isArray(data)) {
    return data as Array<{ value: string | null; count: number }>;
  }
  // Fallback: pull all rows for the column and aggregate in-memory (capped).
  const { data: rows } = await supabase
    .from("lia_attendances")
    .select(field)
    .is("merged_into", null)
    .limit(20000);
  const counts = new Map<string, number>();
  for (const r of (rows ?? []) as Array<Record<string, unknown>>) {
    const raw = r[field];
    const key = raw === null || raw === undefined || raw === "" ? "" : String(raw);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value: value === "" ? null : value, count }))
    .sort((a, b) => b.count - a.count);
}

async function mergeValues(
  supabase: any,
  field: string,
  mappings: Array<{ from: string; to: string | null }>,
) {
  const results: Array<{ from: string; to: string | null; updated: number; error?: string }> = [];
  for (const m of mappings) {
    if (m.from === m.to) {
      results.push({ ...m, updated: 0 });
      continue;
    }
    const payload: Record<string, unknown> = {};
    payload[field] = m.to;
    const { data, error } = await supabase
      .from("lia_attendances")
      .update(payload)
      .eq(field, m.from)
      .is("merged_into", null)
      .select("id");
    if (error) {
      results.push({ ...m, updated: 0, error: error.message });
    } else {
      results.push({ ...m, updated: (data ?? []).length });
    }
  }
  try {
    await supabase.from("system_health_logs").insert({
      function_name: "smart-ops-field-normalize",
      severity: "info",
      error_type: "bulk_merge_completed",
      details: {
        field,
        mappings_count: mappings.length,
        results,
        ts: new Date().toISOString(),
      },
    });
  } catch (_) {}
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || "").trim();
    const field = String(body.field || "").trim();

    if (!FIELD_WHITELIST.has(field)) {
      return new Response(
        JSON.stringify({ error: `field '${field}' not in whitelist` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === "list_options") {
      const out = await listOptions(supabase, field);
      return new Response(
        JSON.stringify({ field, ...out, no_auto_suggest: NO_AUTO_SUGGEST.has(field) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === "list_values") {
      const values = await listValues(supabase, field);
      return new Response(
        JSON.stringify({ field, values }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === "merge") {
      const mappings = Array.isArray(body.mappings) ? body.mappings : [];
      const clean = mappings
        .filter((m: any) => typeof m?.from === "string" && m.from.length > 0)
        .map((m: any) => ({
          from: String(m.from),
          to: m.to === null || m.to === undefined || m.to === "" ? null : String(m.to),
        }));
      if (clean.length === 0) {
        return new Response(
          JSON.stringify({ error: "no mappings provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const results = await mergeValues(supabase, field, clean);
      const total = results.reduce((n, r) => n + (r.updated || 0), 0);
      return new Response(
        JSON.stringify({ field, total_updated: total, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `unknown mode '${mode}'` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// Suggest helper (client mirrors this via slug match on options list).
export function suggestCanonical(rawValue: string, options: string[]): string | null {
  const slug = slugify(rawValue);
  if (!slug) return null;
  for (const o of options) {
    if (slugify(o) === slug) return o;
  }
  for (const o of options) {
    const os = slugify(o);
    if (os && (slug.includes(os) || os.includes(slug))) return o;
  }
  return null;
}