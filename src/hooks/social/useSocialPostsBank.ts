import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BankFilters {
  platforms?: string[];
  format?: string;
  product?: string;
  from?: string;
  to?: string;
  orderBy?: 'recent' | 'oldest' | 'likes' | 'reach';
  limit?: number;
}

export function useSocialPostsBank(filters: BankFilters = {}) {
  return useQuery({
    queryKey: ['social-posts-bank', filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase.from('social_posts').select('*').limit(filters.limit ?? 60);
      if (filters.platforms?.length) q = q.in('platform', filters.platforms);
      if (filters.format) q = q.ilike('format', `%${filters.format}%`);
      if (filters.product) q = q.or(`product_name.ilike.%${filters.product}%,caption.ilike.%${filters.product}%`);
      if (filters.from) q = q.gte('published_at', filters.from);
      if (filters.to)   q = q.lte('published_at', filters.to);
      switch (filters.orderBy) {
        case 'oldest': q = q.order('published_at', { ascending: true,  nullsFirst: false }); break;
        case 'likes':  q = q.order('likes',        { ascending: false, nullsFirst: false }); break;
        case 'reach':  q = q.order('reach',        { ascending: false, nullsFirst: false }); break;
        default:       q = q.order('published_at', { ascending: false, nullsFirst: false });
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}