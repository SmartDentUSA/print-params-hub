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

export const DEFAULT_LOGO_URL =
  "https://okeogjgqijbfkudfjadz.supabase.co/storage/v1/object/public/catalog-images/favicons/favicon-192x192.png";

function mapRow(r: any): BioPage {
  return {
    ...r,
    social_links: (r.social_links ?? {}) as BioSocialLinks,
    items: Array.isArray(r.items) ? (r.items as BioItem[]) : [],
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
      return ((data ?? []) as any[]).map(mapRow);
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
      return data ? mapRow(data) : null;
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
    queryFn: async (): Promise<BioSourceOption[]> => {
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

      const options: BioSourceOption[] = [];
      (forms ?? []).forEach((f: any) => {
        const label = f.title || f.name;
        const description = f.subtitle || f.description || null;
        options.push({
          key: `form:${f.slug}`,
          kind: "form",
          slug: f.slug,
          label,
          description,
          image_url: f.hero_image_url ?? null,
          url: `/f/${f.slug}`,
        });
        const lp = lpByForm.get(f.id);
        if (lp) {
          options.push({
            key: `landing_page:${f.slug}`,
            kind: "landing_page",
            slug: f.slug,
            label,
            description,
            image_url: lp.hero_image_url ?? f.hero_image_url ?? null,
            url: `/lp/${f.slug}`,
          });
        }
      });
      return options;
    },
    staleTime: 2 * 60 * 1000,
  });
}