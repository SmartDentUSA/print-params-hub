import { useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PostInput } from '@/lib/social/postSchema';

export function useUpdateScheduledPost() {
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const save = async (id: string, data: PostInput) => {
    setSaving(true);
    try {
      const scheduledAt = data.publish_now
        ? null
        : data.scheduled_at
        ? new Date(data.scheduled_at).toISOString()
        : null;
      const row = {
        caption: data.caption || null,
        hashtags: data.hashtags,
        first_comment: data.first_comment || null,
        media_items: data.media_items as any,
        per_channel_media: data.per_channel_media as any,
        channels: data.channels as any,
        scheduled_at: scheduledAt,
        timezone: data.timezone,
        publish_now: data.publish_now,
        status: data.publish_now ? 'publishing' : 'scheduled',
        product_name: data.product_name || null,
        product_slug: data.product_slug || null,
        product_ref: data.product_ref || null,
        product_category: data.product_category || null,
        publish_errors: null,
      };
      const { error } = await supabase
        .from('social_scheduled_posts')
        .update(row as any)
        .eq('id', id);
      if (error) throw error;
      toast.success('Post atualizado');
      qc.invalidateQueries({ queryKey: ['social-scheduled-post', id] });
      qc.invalidateQueries({ queryKey: ['social-calendar-posts'] });
      qc.invalidateQueries({ queryKey: ['social-upcoming-posts'] });
      navigate('/social');
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  return { save, saving };
}