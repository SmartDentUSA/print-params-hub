import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface DeliverableMedia {
  id: string;
  position: number;
  drive_file_id: string;
  drive_web_view_link: string | null;
  generated_filename: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  media_role: string | null;
  is_cover: boolean;
}

export interface TrainingDeliverable {
  id: string;
  turma_id: string;
  kit_run_id: string;
  platform: string;
  post_type: string;
  account_id: string | null;
  caption: string | null;
  hashtags: string[];
  first_comment: string | null;
  cta: string | null;
  title: string | null;
  description: string | null;
  suggested_at: string | null;
  suggestion_confidence: string | null;
  status: string;
  review_notes: string | null;
  scheduled_post_id: string | null;
  agent_source: string | null;
  created_at: string;
  media: DeliverableMedia[];
  turma: { turma_number: number | null; label: string | null; drive_folder_url: string | null } | null;
}

const PENDING = ['generated', 'changes_requested'];

export function useTrainingDeliverables(includeApproved = false) {
  return useQuery({
    queryKey: ['training-deliverables', includeApproved],
    queryFn: async (): Promise<TrainingDeliverable[]> => {
      let q = supabase
        .from('training_social_deliverables')
        .select(
          'id, turma_id, kit_run_id, platform, post_type, account_id, caption, hashtags, first_comment, cta, title, description, suggested_at, suggestion_confidence, status, review_notes, scheduled_post_id, agent_source, created_at, training_social_deliverable_media(id, position, drive_file_id, drive_web_view_link, generated_filename, mime_type, width, height, media_role, is_cover), smartops_course_turmas(turma_number, label, drive_folder_url)',
        )
        .order('created_at', { ascending: false })
        .limit(100);
      if (!includeApproved) q = q.in('status', PENDING);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        hashtags: Array.isArray(r.hashtags) ? r.hashtags : [],
        media: (r.training_social_deliverable_media ?? []).sort(
          (a: DeliverableMedia, b: DeliverableMedia) => a.position - b.position,
        ),
        turma: r.smartops_course_turmas ?? null,
      })) as TrainingDeliverable[];
    },
  });
}

export function useUpdateDeliverable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      caption?: string;
      hashtags?: string[];
      first_comment?: string;
      cta?: string;
      title?: string;
      description?: string;
      review_notes?: string;
      status?: string;
    }) => {
      const { id, ...patch } = input;
      const { error } = await supabase
        .from('training_social_deliverables')
        .update({ ...patch, edited_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-deliverables'] });
      toast({ title: 'Entregável atualizado' });
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });
}

export function useApproveDeliverable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; scheduled_at?: string | null }) => {
      const { data, error } = await supabase.functions.invoke('training-deliverable-approve', {
        body: { deliverable_id: input.id, scheduled_at: input.scheduled_at ?? null },
      });
      if (error) throw new Error(error.message);
      if (data && (data as any).error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-deliverables'] });
      qc.invalidateQueries({ queryKey: ['social-calendar-posts'] });
      toast({ title: 'Aprovado', description: 'Post criado no calendário como agendado.' });
    },
    onError: (e: any) => toast({ title: 'Falha na aprovação', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteDeliverable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('training_social_deliverable_media').delete().eq('deliverable_id', id);
      const { error } = await supabase.from('training_social_deliverables').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-deliverables'] });
      toast({ title: 'Entregável excluído' });
    },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' }),
  });
}