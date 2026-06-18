import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GoogleReview = {
  id: string;
  review_id: string;
  reviewer_name: string | null;
  reviewer_photo_url: string | null;
  star_rating: number | null;
  comment: string | null;
  create_time: string | null;
  reply_text: string | null;
  reply_time: string | null;
  response_status: "pending" | "published" | "skipped" | "error";
  error_message: string | null;
};

export type PlacesReview = {
  author_name: string | null;
  profile_photo_url: string | null;
  rating: number | null;
  relative_time_description: string | null;
  text: string | null;
  time: number | null;
};

export type PlacesReputation = {
  google_rating: number;
  google_review_count: number;
  google_reviews_pt: PlacesReview[];
  google_reviews_en: PlacesReview[];
  google_reviews_es: PlacesReview[];
  last_synced_at: string | null;
};

export function usePlacesReputation() {
  return useQuery({
    queryKey: ["places-reputation"],
    queryFn: async (): Promise<PlacesReputation> => {
      const { data, error } = await supabase
        .from("system_a_catalog")
        .select("extra_data")
        .eq("category", "company_info")
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const rr = ((data?.extra_data as any)?.reviews_reputation ?? {}) as Partial<PlacesReputation>;
      return {
        google_rating: Number(rr.google_rating ?? 0),
        google_review_count: Number(rr.google_review_count ?? 0),
        google_reviews_pt: Array.isArray(rr.google_reviews_pt) ? rr.google_reviews_pt : [],
        google_reviews_en: Array.isArray(rr.google_reviews_en) ? rr.google_reviews_en : [],
        google_reviews_es: Array.isArray(rr.google_reviews_es) ? rr.google_reviews_es : [],
        last_synced_at: rr.last_synced_at ?? null,
      };
    },
  });
}

export function useGoogleConnection() {
  return useQuery({
    queryKey: ["google-oauth-connection"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_oauth_tokens")
        .select("id, created_at, expires_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useGoogleReviews() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("google-reviews-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "google_reviews" },
        () => qc.invalidateQueries({ queryKey: ["google-reviews"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return useQuery({
    queryKey: ["google-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_reviews")
        .select("id, review_id, reviewer_name, reviewer_photo_url, star_rating, comment, create_time, reply_text, reply_time, response_status, error_message")
        .order("create_time", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as GoogleReview[];
    },
  });
}