import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FieldValueRow { value: string | null; count: number }
export interface FieldOptionsResult {
  field: string;
  options: string[];
  source: string;
  no_auto_suggest: boolean;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("smart-ops-field-normalize", { body });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export function useFieldOptions(field: string | null) {
  return useQuery({
    queryKey: ["field-normalize", "options", field],
    enabled: !!field,
    staleTime: 5 * 60_000,
    queryFn: () => invoke<FieldOptionsResult>({ mode: "list_options", field }),
  });
}

export function useFieldValues(field: string | null) {
  return useQuery({
    queryKey: ["field-normalize", "values", field],
    enabled: !!field,
    staleTime: 30_000,
    queryFn: () => invoke<{ field: string; values: FieldValueRow[] }>({ mode: "list_values", field }),
  });
}

export interface MergeMapping { from: string; to: string | null }
export interface MergeResult {
  field: string;
  total_updated: number;
  results: Array<MergeMapping & { updated: number; error?: string }>;
}

export function useMergeFieldValues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ field, mappings }: { field: string; mappings: MergeMapping[] }) => {
      return invoke<MergeResult>({ mode: "merge", field, mappings });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["field-normalize", "values", res.field] });
    },
  });
}

// Client-side slug suggestion, mirrors backend logic.
export function slugify(s: string | undefined | null): string {
  if (!s) return "";
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Field-specific synonym dictionary. Keys are slugs of raw values,
// values are the canonical option to map to. Extend as new variants appear.
const FIELD_SYNONYMS: Record<string, Record<string, string>> = {
  area_atuacao: {
    cirurgiao_dentista: "CLÍNICA OU CONSULTÓRIO",
    cirurgia_dentista: "CLÍNICA OU CONSULTÓRIO",
    cirurgia_dentista_: "CLÍNICA OU CONSULTÓRIO",
    dentista: "CLÍNICA OU CONSULTÓRIO",
    clinico: "CLÍNICA OU CONSULTÓRIO",
    clinico_geral: "CLÍNICA OU CONSULTÓRIO",
    cargo_nao_informado: "CLÍNICA OU CONSULTÓRIO",
    clinica: "CLÍNICA OU CONSULTÓRIO",
    consultorio: "CLÍNICA OU CONSULTÓRIO",
    clinica_consultorio: "CLÍNICA OU CONSULTÓRIO",
    clinica_ou_consultorio: "CLÍNICA OU CONSULTÓRIO",
    protetico: "LABORATÓRIO DE PRÓTESE",
    tecnico_em_protese: "LABORATÓRIO DE PRÓTESE",
    tecnico_em_protese_dentaria: "LABORATÓRIO DE PRÓTESE",
    laboratorio: "LABORATÓRIO DE PRÓTESE",
    laboratorio_de_protese: "LABORATÓRIO DE PRÓTESE",
    radiologia: "RADIOLOGIA ODONTOLÓGICA",
    radiologista: "RADIOLOGIA ODONTOLÓGICA",
    radiologia_odontologica: "RADIOLOGIA ODONTOLÓGICA",
  },
};

export function suggestCanonical(
  rawValue: string,
  options: string[],
  field?: string,
): string | null {
  const slug = slugify(rawValue);
  if (!slug) return null;

  // 1) Field-specific synonym dictionary — only return if the target
  //    is actually an official option for this field.
  if (field && FIELD_SYNONYMS[field]) {
    const target = FIELD_SYNONYMS[field][slug];
    if (target && options.includes(target)) return target;
  }

  // 2) Exact slug match against canonical options.
  for (const o of options) if (slugify(o) === slug) return o;

  // 3) Substring slug match (either direction).
  for (const o of options) {
    const os = slugify(o);
    if (os && (slug.includes(os) || os.includes(slug))) return o;
  }
  return null;
}

// Backwards-compat overload kept for any legacy callers.
export function _suggestCanonicalLegacy(rawValue: string, options: string[]): string | null {
  const slug = slugify(rawValue);
  if (!slug) return null;
  for (const o of options) if (slugify(o) === slug) return o;
  for (const o of options) {
    const os = slugify(o);
    if (os && (slug.includes(os) || os.includes(slug))) return o;
  }
  return null;
}