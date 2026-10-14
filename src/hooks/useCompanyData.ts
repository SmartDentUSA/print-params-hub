import { seoTerms } from '@/utils/seoText';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CompanyData {
  name: string;
  description: string;
  logo_url: string;
  website_url: string;
  business?: {
    legal_name?: string;
    doing_business_as?: string;
    cnpj?: string;
    company_type?: string;
    duns_number?: string;
    vat_id?: string;
    tax_id?: string;
    number_of_employees?: string;
    annual_revenue?: string;
    founded_year?: number;
    sector?: string;
  };
  legal_entities?: Array<{
    country: string;
    legal_name: string;
    trade_name?: string;
    tax_id?: string;
    tax_id_type?: string;
    file_number?: string;
    state?: string;
    status?: string;
    founded_year?: number;
    address?: any;
    phone?: string;
    website?: string;
    managers?: string[];
    partnership?: string;
  }>;
  responsible_technician?: {
    name: string;
    council: string;
    license_number: string;
  };
  founders?: Array<{
    name: string;
    title?: string;
    role_br?: string;
    role_us?: string;
    orcid?: string;
    orcid_url?: string;
    lattes_id?: string;
    lattes_url?: string;
    fapesp_url?: string;
    education?: Array<{ degree: string; field: string; institution: string; years?: string; funding?: string }>;
    knows_about?: string[];
    products_developed?: string[];
    key_publication?: { title: string; year: number; citations?: number };
  }>;
  research_grants?: Array<{
    title: string;
    funder: string;
    program?: string;
    grant_id?: string;
    period: string;
  }>;
  reviews_reputation?: {
    google_rating?: number;
    google_review_count?: number;
    google_reviews_pt?: any[]; // Reviews em português (original)
    google_reviews_en?: any[]; // Reviews traduzidos para inglês
    google_reviews_es?: any[]; // Reviews traduzidos para espanhol
    last_synced_at?: string;
    trustpilot_rating?: number;
    bbb_rating?: string;
    testimonial_count?: number;
  };
  media?: {
    logo_variants?: any;
    brand_colors?: string[];
    typography?: any;
    press_kit_url?: string;
    media_mentions?: Array<{
      title: string;
      url: string;
      publisher: string;
      date: string;
    }>;
  };
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
    awards?: Array<{
      name: string;
      year: number;
      issuer: string;
    }>;
    certifications?: Array<string | {
      standard?: string;
      status?: string;
      certifier?: string;
      description?: string;
      certifier_url?: string;
      main_product?: string;
    }>;
    partnerships?: string[];
    case_studies?: Array<{
      title: string;
      url: string;
      summary: string;
    }>;
    success_stories?: any[];
  };
  contact: {
    email?: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
    location?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    support_hours?: string;
    emergency_contact?: string;
    languages_spoken?: string[];
  };
  seo: {
    market_positioning?: string;
    competitive_advantages?: string[];
    technical_expertise?: string[];
    service_areas?: string[];
    context_keywords?: string[];
    related_domains?: string[];
    service_offerings?: string[];
    price_range?: string;
    payment_methods?: string[];
    areas_served?: string[];
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
      const corporate = extraData.corporate || {};
      const asLines = (value: unknown): string[] => Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim())
        : typeof value === 'string' ? value.split(/\r?\n+/).map(item => item.trim()).filter(Boolean) : [];
      const companyVideos = Array.isArray(extraData.company_videos)
        ? extraData.company_videos
        : Object.entries(extraData.company_videos || {}).flatMap(([group, items]: [string, any]) =>
            Array.isArray(items) ? items.map((video: any) => ({
              title: video.title || video.name || video.description?.split(/[.!?\n]/, 1)[0] || group.replace(/_/g, ' '),
              url: video.url || video.video_url || video.link || '',
              thumbnail: video.thumbnail || video.thumbnail_url || video.image_url,
            })).filter((video: any) => typeof video.url === 'string' && /^https?:\/\//i.test(video.url)) : []
          );
      const certifications = Array.isArray(corporate.certifications)
        ? corporate.certifications
        : Array.isArray(extraData.certifications) ? extraData.certifications : [];

      return {
        name: data.name || "",
        description: data.description || "",
        logo_url: data.image_url || "",
        website_url: data.canonical_url || "",
        business: extraData.business || {},
        legal_entities: extraData.legal_entities || [],
        responsible_technician: extraData.responsible_technician || undefined,
        founders: extraData.founders || [],
        research_grants: extraData.research_grants || [],
        reviews_reputation: extraData.reviews_reputation || {},
        media: extraData.media || {},
        corporate: {
          ...corporate,
          values: asLines(corporate.values),
          differentiators: asLines(corporate.differentiators),
          certifications,
          awards: Array.isArray(corporate.awards) ? corporate.awards : [],
        },
        contact: extraData.contact || {},
        seo: {
          ...extraData.seo,
          technical_expertise: seoTerms(extraData.seo?.technical_expertise),
          context_keywords: seoTerms(extraData.seo?.context_keywords),
        },
        social_media: extraData.social_media || {},
        institutional_links: extraData.institutional_links || [],
        company_videos: companyVideos,
        last_sync_at: data.last_sync_at,
      } as CompanyData;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
