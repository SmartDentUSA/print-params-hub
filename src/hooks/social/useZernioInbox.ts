import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ZernioConversation {
  id: string;
  accountId: string;
  accountUsername?: string;
  platform: string;
  participantId?: string;
  participantName?: string;
  participantUsername?: string;
  participantPicture?: string;
  lastMessage?: string;
  updatedTime?: string;
  status?: string;
  unreadCount?: number;
  url?: string;
  instagramProfile?: { isFollower?: boolean; followerCount?: number };
}

export interface ZernioMessage {
  id: string;
  conversationId: string;
  accountId: string;
  platform: string;
  message?: string;
  senderName?: string;
  direction: 'incoming' | 'outgoing';
  createdAt?: string;
  sentAt?: string;
  attachments?: any[];
}

async function callInbox<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('social-inbox', { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return data as T;
}

export function useZernioConversations(filters: { platform?: string } = {}) {
  return useQuery({
    queryKey: ['zernio-conversations', filters.platform ?? 'all'],
    queryFn: () =>
      callInbox<{ data: ZernioConversation[]; pagination?: any; meta?: any }>({
        action: 'conversations',
        limit: 100,
        sortOrder: 'desc',
        ...(filters.platform && filters.platform !== 'all' ? { platform: filters.platform } : {}),
      }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useZernioMessages(conversation?: ZernioConversation | null) {
  return useQuery({
    queryKey: ['zernio-messages', conversation?.id],
    enabled: !!conversation?.id,
    queryFn: () =>
      callInbox<{ messages: ZernioMessage[] }>({
        action: 'messages',
        conversationId: conversation!.id,
        accountId: conversation!.accountId,
        limit: 100,
      }),
    refetchInterval: 30_000,
  });
}

export function useSendZernioMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { conversationId: string; accountId?: string; message: string }) =>
      callInbox({ action: 'send', ...vars }),
    onSuccess: (_d, vars) => {
      toast.success('Mensagem enviada');
      qc.invalidateQueries({ queryKey: ['zernio-messages', vars.conversationId] });
      qc.invalidateQueries({ queryKey: ['zernio-conversations'] });
    },
    onError: (e: any) => toast.error(`Erro ao enviar: ${String(e?.message ?? e)}`),
  });
}
