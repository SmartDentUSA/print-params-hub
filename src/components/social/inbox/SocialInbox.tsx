import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RefreshCw, Send, ExternalLink, Search, Inbox, UserCheck, UserX, ListPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useZernioConversations, useZernioMessages, useSendZernioMessage, type ZernioConversation,
} from '@/hooks/social/useZernioInbox';
import { useInboxLeadMatches, useLogConversationToTimeline } from '@/hooks/social/useInboxLeadLink';

const PLATFORMS = [
  { id: 'all', label: 'Todas' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'telegram', label: 'Telegram' },
];

function fmt(dt?: string) {
  if (!dt) return '';
  const d = new Date(dt);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function initials(name?: string) {
  return (name ?? '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export function SocialInbox() {
  const [platform, setPlatform] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ZernioConversation | null>(null);
  const [draft, setDraft] = useState('');

  const { data, isLoading, isFetching, refetch } = useZernioConversations({ platform });
  const conversations = data?.data ?? [];
  const { data: msgData, isLoading: loadingMsgs } = useZernioMessages(selected);
  const send = useSendZernioMessage();
  const { data: leadMatches } = useInboxLeadMatches(conversations);
  const logTimeline = useLogConversationToTimeline();
  const selectedMatch = selected ? leadMatches?.[selected.id] : undefined;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      [c.participantName, c.participantUsername, c.lastMessage].some((v) => (v ?? '').toLowerCase().includes(q)));
  }, [conversations, search]);

  const messages = (msgData?.messages ?? []).slice().sort(
    (a, b) => new Date(a.sentAt ?? a.createdAt ?? 0).getTime() - new Date(b.sentAt ?? b.createdAt ?? 0).getTime());

  const onSend = () => {
    const text = draft.trim();
    if (!text || !selected) return;
    send.mutate({ conversationId: selected.id, accountId: selected.accountId, message: text });
    setDraft('');
  };

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount ?? 0), 0);
  const identified = Object.values(leadMatches ?? {}).filter((m) => m.lead).length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary" /> Conversas
          </h1>
          <p className="text-sm text-muted-foreground">
            Inbox unificada do Zernio — DMs de Instagram, Facebook, WhatsApp e mais
            {totalUnread > 0 && <> · <span className="text-primary font-medium">{totalUnread} não lidas</span></>}
            {identified > 0 && <> · <span className="text-primary font-medium">{identified} com cadastro de lead</span></>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isFetching && 'animate-spin')} /> Atualizar
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        <Card className="p-3 space-y-3">
          <Tabs value={platform} onValueChange={(v) => { setPlatform(v); setSelected(null); }}>
            <TabsList className="w-full flex-wrap h-auto">
              {PLATFORMS.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className="text-xs">{p.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Buscar nome ou mensagem" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>

          <ScrollArea className="h-[62vh] pr-2">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma conversa encontrada.</p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((c) => (
                  <li key={`${c.accountId}-${c.id}`}>
                    <button onClick={() => setSelected(c)}
                      className={cn('w-full text-left rounded-md p-2.5 flex gap-2.5 hover:bg-accent/50 transition-colors',
                        selected?.id === c.id && 'bg-primary/10')}>
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarImage src={c.participantPicture} alt={c.participantName ?? 'contato'} />
                        <AvatarFallback className="text-xs">{initials(c.participantName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{c.participantName ?? c.participantUsername ?? 'Sem nome'}</span>
                          {(c.unreadCount ?? 0) > 0 && (
                            <Badge className="h-4 px-1.5 text-[10px]">{c.unreadCount}</Badge>
                          )}
                          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{fmt(c.updatedTime)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{c.lastMessage || '—'}</p>
                        <Badge variant="outline" className="mt-1 text-[10px] capitalize">{c.platform}</Badge>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </Card>

        <Card className="p-0 flex flex-col h-[72vh]">
          {!selected ? (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
              Selecione uma conversa para ver as mensagens.
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center gap-2.5">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={selected.participantPicture} alt={selected.participantName ?? 'contato'} />
                  <AvatarFallback className="text-xs">{initials(selected.participantName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selected.participantName ?? 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selected.participantUsername ? `@${selected.participantUsername} · ` : ''}
                    {selected.platform} · {selected.accountUsername}
                  </p>
                </div>
                {selected.url && (
                  <Button asChild variant="ghost" size="sm" className="ml-auto">
                    <a href={selected.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 p-4">
                {loadingMsgs ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-2/3" />)}
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Sem mensagens nesta conversa.</p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((m) => {
                      const out = m.direction === 'outgoing';
                      const text = m.message
                        || m.attachments?.map((a: any) => a?.payload?.generic?.elements?.[0]?.title).filter(Boolean).join('\n')
                        || (m.attachments?.length ? '[anexo]' : '');
                      return (
                        <div key={m.id} className={cn('flex', out ? 'justify-end' : 'justify-start')}>
                          <div className={cn('max-w-[75%] rounded-lg px-3 py-2',
                            out ? 'bg-primary/10' : 'bg-muted')}>
                            <p className="text-sm whitespace-pre-wrap break-words">{text || '—'}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {out ? 'Você' : m.senderName ?? 'Contato'} · {fmt(m.sentAt ?? m.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              <div className="p-3 border-t flex gap-2">
                <Input placeholder="Escreva uma resposta..." value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }} />
                <Button onClick={onSend} disabled={!draft.trim() || send.isPending}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
