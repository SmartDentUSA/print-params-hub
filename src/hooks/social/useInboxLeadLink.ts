import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ZernioConversation, ZernioMessage } from './useZernioInbox';

export interface InboxLeadMatch {
  conversationId: string;
  matched_by: string | null;
  lead: { id: string; nome: string | null; email: string | null; telefone: string | null } | null;
  /** true = tem deal ganho (cliente); false = apenas lead */
  is_customer?: boolean;
  won_deals?: number;
  ltv_total?: number;
}

async function callLink<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('social-inbox-lead-link', { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return data as T;
}

/** Identifica quais participantes das conversas já têm cadastro de lead. */
export function useInboxLeadMatches(conversations: ZernioConversation[]) {
  const ids = conversations.map((c) => c.id).join(',');
  return useQuery({
    queryKey: ['inbox-lead-matches', ids],
    enabled: conversations.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { results } = await callLink<{ results: InboxLeadMatch[] }>({
        action: 'resolve',
        conversations: conversations.slice(0, 100).map((c) => ({
          id: c.id,
          participantName: c.participantName,
          participantUsername: c.participantUsername,
          lastMessage: c.lastMessage,
        })),
      });
      return Object.fromEntries(results.map((r) => [r.conversationId, r])) as Record<string, InboxLeadMatch>;
    },
  });
}

/** Registra as mensagens da conversa na timeline do lead. */
export function useLogConversationToTimeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { conversation: ZernioConversation; messages: ZernioMessage[]; leadId?: string | null }) =>
      callLink<{ linked: boolean; lead_id?: string; inserted?: number; reason?: string }>({
        action: 'log_timeline',
        conversationId: vars.conversation.id,
        platform: vars.conversation.platform,
        participantName: vars.conversation.participantName,
        participantUsername: vars.conversation.participantUsername,
        lastMessage: vars.conversation.lastMessage,
        leadId: vars.leadId ?? undefined,
        messages: vars.messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          text: m.message ?? (m.attachments?.length ? '[anexo]' : ''),
          sentAt: m.sentAt ?? m.createdAt,
          senderName: m.senderName,
        })),
      }),
    onSuccess: (res) => {
      if (!res.linked) {
        toast.error('Nenhum cadastro de lead encontrado para este contato.');
        return;
      }
      toast.success(`${res.inserted ?? 0} mensagem(ns) registrada(s) na timeline do lead`);
      qc.invalidateQueries({ queryKey: ['inbox-lead-matches'] });
      qc.invalidateQueries({ queryKey: ['lead-timeline'] });
    },
    onError: (e: any) => toast.error(`Erro ao registrar: ${String(e?.message ?? e)}`),
  });
}
