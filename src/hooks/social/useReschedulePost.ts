import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function useReschedulePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: string; scheduledAt: string }) => {
      const { error } = await supabase
        .from('social_scheduled_posts')
        .update({ scheduled_at: scheduledAt, status: 'scheduled', publish_errors: null })
        .eq('id', id)
        .in('status', ['scheduled', 'failed', 'draft']);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Post reagendado');
      qc.invalidateQueries({ queryKey: ['social-calendar-posts'] });
      qc.invalidateQueries({ queryKey: ['social-upcoming-posts'] });
    },
    onError: (e: any) => toast.error(`Falha: ${e.message ?? e}`),
  });
}

export function useRetryPublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('social_scheduled_posts')
        .update({ status: 'publishing', publish_errors: null })
        .eq('id', id)
        .eq('status', 'failed');
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Reenfileirado para publicação');
      qc.invalidateQueries({ queryKey: ['social-calendar-posts'] });
      qc.invalidateQueries({ queryKey: ['social-upcoming-posts'] });
    },
    onError: (e: any) => toast.error(`Falha: ${e.message ?? e}`),
  });
}