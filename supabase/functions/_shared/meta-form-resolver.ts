// Resolver de formulários Meta baseado na tabela meta_form_mappings.
// Camada NORMALIZADA: substitui mapeamentos hardcoded por dado governado no banco.

export interface MetaFormResolution {
  resolved: boolean;
  formId: string | null;
  productName: string | null;
  productCatalogId: string | null;
  originSystemB: string | null;
  workflowStage: string | null;
  subcategoria: string | null;
  commercialEligible: boolean;
}

const UNRESOLVED: MetaFormResolution = {
  resolved: false,
  formId: null,
  productName: null,
  productCatalogId: null,
  originSystemB: null,
  workflowStage: null,
  subcategoria: null,
  commercialEligible: false,
};

// De-para de prefixos de estágio (7x3) para as chaves canônicas do sistema.
const STAGE_PREFIX_MAP: Record<string, string> = {
  "1_captura_digital": "1_captura_digital",
  "2_cad": "2_cad",
  "3_impressao_3d": "3_impressao_3d",
  "4_pos_impressao": "4_pos_impressao",
  "5_finalizacao": "5_finalizacao",
  "6_gestao": "6_gestao",
  "7_marketing": "7_marketing",
};

// De-para de slugs de subcategoria divergentes -> slug canônico.
const SUBCATEGORY_SLUG_MAP: Record<string, string> = {
  impressora_odontologica: "impressora_odontologica",
  limpeza_acabamento: "limpeza_acabamento",
  dentistica_orto: "dentistica_orto",
  scanner_intraoral: "scanner_intraoral",
  scanner_bancada: "scanner_bancada",
};

function splitStageTarget(target: string | null): { stage: string | null; sub: string | null } {
  if (!target) return { stage: null, sub: null };
  const idx = target.indexOf("__");
  if (idx < 0) return { stage: STAGE_PREFIX_MAP[target] ?? target, sub: null };
  const rawStage = target.slice(0, idx);
  const rawSub = target.slice(idx + 2);
  return {
    stage: STAGE_PREFIX_MAP[rawStage] ?? rawStage,
    sub: SUBCATEGORY_SLUG_MAP[rawSub] ?? rawSub || null,
  };
}

export async function resolveMetaForm(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  formId: string | null | undefined,
): Promise<MetaFormResolution> {
  if (!formId) return { ...UNRESOLVED };

  const { data, error } = await supabase
    .from("meta_form_mappings")
    .select(
      "id, form_id, product_name, product_catalog_id, origin_system_b, workflow_stage_target, commercial_eligible, leads_count",
    )
    .eq("form_id", String(formId))
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    console.warn("[meta-form-resolver] sem match para form_id", formId, error?.message ?? null);
    await supabase
      .from("system_health_logs")
      .insert({
        function_name: "meta-form-resolver",
        severity: "warning",
        error_type: "meta_form_unmapped",
        details: {
          form_id: String(formId),
          erro: error?.message ?? null,
        },
      })
      .then(() => {}, () => {});
    return { ...UNRESOLVED, formId: String(formId) };
  }

  const { stage, sub } = splitStageTarget(data.workflow_stage_target ?? null);

  // Telemetria: contador e último lead. Nunca pode derrubar o fluxo.
  await supabase
    .from("meta_form_mappings")
    .update({
      leads_count: Number(data.leads_count ?? 0) + 1,
      last_lead_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .then(() => {}, () => {});

  return {
    resolved: true,
    formId: String(data.form_id),
    productName: data.product_name ?? null,
    productCatalogId: data.product_catalog_id ?? null,
    originSystemB: data.origin_system_b ?? null,
    workflowStage: stage,
    subcategoria: sub,
    commercialEligible: data.commercial_eligible !== false,
  };
}