import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_CATALOG_ENTITY_TYPES } from "@/lib/catalogEntityTypes";

export interface MetaFormMapping {
  id: string;
  form_id: string;
  form_name_meta: string | null;
  origin_system_b: string | null;
  product_name: string | null;
  product_catalog_id: string | null;
  workflow_stage_target: string | null;
  commercial_eligible: boolean;
  active: boolean;
  source: string;
  notes: string | null;
  last_lead_at: string | null;
  leads_count: number;
  created_at: string;
  updated_at: string;
}

export interface UnmappedForm {
  form_id: string;
  form_name: string | null;
  leads_count: number;
  last_lead_at: string | null;
}

export function useMetaFormMappings() {
  return useQuery({
    queryKey: ["meta_form_mappings"],
    queryFn: async (): Promise<MetaFormMapping[]> => {
      const { data, error } = await supabase
        .from("meta_form_mappings")
        .select("*")
        .order("leads_count", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MetaFormMapping[];
    },
  });
}

export function useUnmappedMetaForms() {
  return useQuery({
    queryKey: ["meta_form_mappings", "unmapped"],
    queryFn: async (): Promise<UnmappedForm[]> => {
      const { data, error } = await supabase.rpc("list_unmapped_meta_forms" as any);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        form_id: r.form_id,
        form_name: r.form_name ?? null,
        leads_count: Number(r.leads_count ?? 0),
        last_lead_at: r.last_lead_at ?? null,
      }));
    },
  });
}

export interface CatalogProductOption {
  id: string;
  name: string;
  category: string | null;
}

export function useCatalogProductOptions() {
  return useQuery({
    queryKey: ["meta_form_mappings", "catalog_options"],
    queryFn: async (): Promise<CatalogProductOption[]> => {
      const { data, error } = await supabase
        .from("system_a_catalog")
        .select("id, name, category")
        .in("category", [...PRODUCT_CATALOG_ENTITY_TYPES])
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as CatalogProductOption[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export type MetaFormMappingInput = Partial<
  Pick<
    MetaFormMapping,
    | "form_id"
    | "form_name_meta"
    | "origin_system_b"
    | "product_name"
    | "product_catalog_id"
    | "workflow_stage_target"
    | "commercial_eligible"
    | "active"
    | "notes"
  >
>;

export function useSaveMetaFormMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: MetaFormMappingInput }) => {
      if (id) {
        const { error } = await supabase.from("meta_form_mappings").update(values as any).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("meta_form_mappings")
        .insert({ source: "manual", ...values } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meta_form_mappings"] });
    },
  });
}

export function useIsAdminUser() {
  return useQuery({
    queryKey: ["is_admin_user"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    staleTime: 5 * 60 * 1000,
  });
}