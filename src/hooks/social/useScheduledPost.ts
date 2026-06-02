import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { defaultPost, type PostInput } from '@/lib/social/postSchema';

export interface LoadedPost {
  id: string;
  status: string;
  data: PostInput;
  publish_errors: any;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
        media_items: Array.isArray(data.media_items) ? (data.media_items as any) : [],
        channels: Array.isArray(data.channels) ? (data.channels as any) : [],
        publish_now: !!data.publish_now,
        scheduled_at: data.scheduled_at ? toLocalInput(data.scheduled_at) : '',
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