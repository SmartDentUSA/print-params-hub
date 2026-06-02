import { useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { PostInput } from '@/lib/social/postSchema';

export function useCreateScheduledPost() {
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const save = async (data: PostInput, opts?: { redirect?: boolean }) => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const row = {
        caption: data.caption || null,
        hashtags: data.hashtags,
        first_comment: data.first_comment || null,
        media_items: data.media_items as any,
        channels: data.channels as any,
        scheduled_at: data.publish_now ? null : data.scheduled_at,
        timezone: data.timezone,
        publish_now: data.publish_now,
        status: data.publish_now ? 'publishing' : 'scheduled',
        product_name: data.product_name || null,
        product_slug: data.product_slug || null,
        created_by: auth.user?.email ?? auth.user?.id ?? null,
      };
      const { data: inserted, error } = await supabase
        .from('social_scheduled_posts')
        .insert(row)
        .select('id')
        .single();
      if (error) throw error;
      toast.success(data.publish_now ? 'Publicação enfileirada' : 'Post agendado');
      if (opts?.redirect !== false) navigate('/social');
      return inserted;
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e.message ?? e}`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { save, saving };
}