import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BioItem {
  id: string;
  kind: "form" | "landing_page" | "custom";
  label: string;
  description?: string | null;
  image_url?: string | null;
  url: string;
  button_text?: string | null;
}

export interface BioSocialLinks {
  instagram?: string;
  youtube?: string;
  facebook?: string;
  linkedin?: string;
  whatsapp?: string;
  website?: string;
}

export interface BioPage {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  logo_url: string | null;
  social_links: BioSocialLinks;
  items: BioItem[];
  active: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_SOCIAL_LINKS: BioSocialLinks = {
  instagram: "https://www.instagram.com/smartdentoficial/",
  youtube: "https://www.youtube.com/@smartdentcadcam",
  facebook: "https://www.facebook.com/smartdentoficial",
  linkedin: "https://www.linkedin.com/company/smartdent-brasil/",
};

// Ícone SD servido direto de /public (evita depender do CDN de assets no preview)
export const DEFAULT_LOGO_URL = "/favicon-512x512.png?v=10";

function mapRow(r: any): BioPage {
  return {
    ...r,
    social_links: (r.social_links ?? {}) as BioSocialLinks,
    items: Array.isArray(r.items) ? (r.items as BioItem[]) : [],
  };
}

async function fetchBioSourceOptions(): Promise<BioSourceOption[]> {
  const { data: forms, error: formsError } = await (supabase as any)
    .from("smartops_forms")
    .select("id, name, slug, title, subtitle, description, hero_image_url, active")
    .eq("active", true)
    .order("name");
  if (formsError) throw formsError;

  const { data: lps } = await (supabase as any)
    .from("smartops_form_landing_pages")
    .select("id, form_id, hero_image_url, status")
    .eq("status", "published");

  const lpByForm = new Map<string, any>();
  (lps ?? []).forEach((lp: any) => lpByForm.set(lp.form_id, lp));

  // Somente formulários/LPs que possuem link encurtado disponível
  const { data: shortLinks } = await (supabase as any)
    .from("smartops_short_links")
    .select("short_code, form_slug, default_target");
  const shortByKey = new Map<string, string>();
  (shortLinks ?? []).forEach((l: any) => {
    if (!l.form_slug || !l.short_code) return;
    shortByKey.set(`${l.default_target}:${l.form_slug}`, `https://s.smartdent.com.br/${l.short_code}`);
  });

  const options: BioSourceOption[] = [];
  (forms ?? []).forEach((f: any) => {
    const label = f.title || f.name;
    const description = f.subtitle || f.description || null;
    const formShort = shortByKey.get(`form:${f.slug}`);
    if (formShort) {
      options.push({
        key: `form:${f.slug}`,
        kind: "form",
        slug: f.slug,
        label,
        description,
        image_url: f.hero_image_url ?? null,
        url: formShort,
      });
    }
    const lp = lpByForm.get(f.id);
    const lpShort = shortByKey.get(`landing_page:${f.slug}`);
    if (lp && lpShort) {
      options.push({
        key: `landing_page:${f.slug}`,
        kind: "landing_page",
        slug: f.slug,
        label,
        description,
        image_url: lp.hero_image_url ?? f.hero_image_url ?? null,
        url: lpShort,
      });
    }
  });
  return options;
}

function hydratePageItems(page: BioPage, sources: BioSourceOption[]): BioPage {
  const sourceByKey = new Map(sources.map((source) => [source.key, source]));
  return {
    ...page,
    items: page.items.map((item) => {
      const liveSource = sourceByKey.get(item.id);
      if (!liveSource) return item;
      return {
        ...item,
        kind: liveSource.kind,
        label: item.label || liveSource.label,
        description: item.description ?? liveSource.description,
        image_url: liveSource.image_url ?? item.image_url ?? null,
        url: liveSource.url,
      };
    }),
  };
}

export function useBioPages() {
  return useQuery({
    queryKey: ["smartops_bio_pages"],
    queryFn: async (): Promise<BioPage[]> => {
      const { data, error } = await (supabase as any)
        .from("smartops_bio_pages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const sourceOptions = await fetchBioSourceOptions();
      return ((data ?? []) as any[]).map((row) => hydratePageItems(mapRow(row), sourceOptions));
    },
  });
}

export function useBioPage(slug?: string) {
  return useQuery({
    queryKey: ["smartops_bio_page", slug],
    enabled: !!slug,
    queryFn: async (): Promise<BioPage | null> => {
      const { data, error } = await (supabase as any)
        .from("smartops_bio_pages")
        .select("*")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const sourceOptions = await fetchBioSourceOptions();
      return hydratePageItems(mapRow(data), sourceOptions);
    },
  });
}

export function useSaveBioPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Partial<BioPage> }) => {
      if (id) {
        const { error } = await (supabase as any)
          .from("smartops_bio_pages")
          .update(values)
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await (supabase as any).from("smartops_bio_pages").insert(values);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smartops_bio_pages"] }),
  });
}

export function useDeleteBioPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("smartops_bio_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smartops_bio_pages"] }),
  });
}

export interface BioSourceOption {
  key: string;
  kind: "form" | "landing_page";
  slug: string;
  label: string;
  description: string | null;
  image_url: string | null;
  url: string;
}

/** Formulários públicos ativos + landing pages publicadas, para o seletor. */
export function useBioSourceOptions() {
  return useQuery({
    queryKey: ["smartops_bio_sources"],
    queryFn: fetchBioSourceOptions,
    staleTime: 2 * 60 * 1000,
  });
}