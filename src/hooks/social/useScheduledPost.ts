import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { defaultPost, type PostInput } from '@/lib/social/postSchema';

export interface LoadedPost {
  id: string;
  status: string;
  data: PostInput;
  publish_errors: any;
}

import { isoToLocalInput } from '@/lib/social/scheduleTime';

export function useScheduledPost(id: string | undefined) {
  return useQuery({
    queryKey: ['social-scheduled-post', id],
    enabled: !!id,
    queryFn: async (): Promise<LoadedPost> => {
      const { data, error } = await supabase
        .from('social_scheduled_posts')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      const post: PostInput = {
        ...defaultPost,
        caption: data.caption ?? '',
        hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
        first_comment: data.first_comment ?? '',
        product_name: data.product_name ?? '',
        product_slug: data.product_slug ?? '',
        product_ref: (data as any).product_ref ?? '',
        product_category: (data as any).product_category ?? '',
        media_items: Array.isArray(data.media_items) ? (data.media_items as any) : [],
        channels: Array.isArray(data.channels) ? (data.channels as any) : [],
        publish_now: !!data.publish_now,
        scheduled_at: isoToLocalInput(data.scheduled_at, data.timezone ?? 'America/Sao_Paulo'),
        timezone: data.timezone ?? 'America/Sao_Paulo',
      };
      return {
        id: data.id,
        status: data.status,
        data: post,
        publish_errors: data.publish_errors,
      };
    },
  });
}