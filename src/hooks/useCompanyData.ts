import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CompanyData {
  name: string;
  description: string;
  logo_url: string;
  website_url: string;
  corporate: {
    mission?: string;
    vision?: string;
    values?: string[];
    sector?: string;
    target_audience?: string;
    differentiators?: string[];
    culture?: string;
    methodology?: string;
    founded_year?: number;
    team_size?: string;
  };
  contact: {
    email?: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
  };
  seo: {
    market_positioning?: string;
    competitive_advantages?: string[];
    technical_expertise?: string[];
    service_areas?: string[];
    context_keywords?: string[];
    related_domains?: string[];
  };
  social_media: {
    instagram?: string;
    youtube?: string;
    facebook?: string;
    linkedin?: string;
    twitter?: string;
    tiktok?: string;
  };
  institutional_links?: Array<{
    label: string;
    url: string;
    description?: string;
  }>;
  company_videos?: Array<{
    title: string;
    url: string;
    thumbnail?: string;
  }>;
  last_sync_at?: string;
}

export function useCompanyData() {
  return useQuery({
    queryKey: ["company-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_a_catalog")
        .select("*")
        .eq("category", "company_info")
        .eq("active", true)
        .single();

      if (error) throw error;
      if (!data) return null;

      const extraData = data.extra_data as any || {};

      return {
        name: data.name || "",
        description: data.description || "",
        logo_url: data.image_url || "",
        website_url: data.canonical_url || "",
        corporate: extraData.corporate || {},
        contact: extraData.contact || {},
        seo: extraData.seo || {},
        social_media: extraData.social_media || {},
        institutional_links: extraData.institutional_links || [],
        company_videos: extraData.company_videos || [],
        last_sync_at: data.last_sync_at,
      } as CompanyData;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
