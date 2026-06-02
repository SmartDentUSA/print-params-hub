import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CalendarPost {
  id: string;
  caption: string | null;
  channels: any[];
  media_items: any[];
  scheduled_at: string | null;
  status: string;
  product_name: string | null;
  publish_errors: any;
}

export function useCalendarPosts(from: Date, to: Date) {
  return useQuery({
    queryKey: ['social-calendar-posts', from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<CalendarPost[]> => {
      const { data, error } = await supabase
        .from('social_scheduled_posts')
        .select('id, caption, channels, media_items, scheduled_at, status, product_name, publish_errors')
        .gte('scheduled_at', from.toISOString())
        .lte('scheduled_at', to.toISOString())
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        channels: Array.isArray(p.channels) ? p.channels : [],
        media_items: Array.isArray(p.media_items) ? p.media_items : [],
      }));
    },
  });
}