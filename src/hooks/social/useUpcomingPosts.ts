import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useUpcomingPosts() {
  return useQuery({
    queryKey: ['social-upcoming-posts'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const in7d = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from('social_scheduled_posts')
        .select('id, caption, channels, media_items, scheduled_at, status, product_name')
        .in('status', ['scheduled', 'publishing', 'failed'])
        .gte('scheduled_at', now)
        .lte('scheduled_at', in7d)
        .order('scheduled_at', { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}