import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Megaphone, Send, Instagram, Search, Loader2, RefreshCw, Info, ExternalLink, Smile } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export function SocialBroadcasts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [zernioAccountId, setZernioAccountId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [onlyFollowers, setOnlyFollowers] = useState(false);
  const [onlySubscribed, setOnlySubscribed] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState('');
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const { data: zernioAccounts } = useQuery({
    queryKey: ['zernio-accounts-ig'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_zernio_accounts')
        .select('id, platform, handle, display_name, active')
        .eq('platform', 'instagram').eq('active', true)
        .order('display_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Auto-select the only IG account, when there is exactly one.
  useEffect(() => {
    if (!open) return;
    if (zernioAccountId) return;
    if ((zernioAccounts ?? []).length === 1) {
      setZernioAccountId(zernioAccounts![0].id);
    }
  }, [open, zernioAccounts, zernioAccountId]);

  // Universe counter — total IG contacts in DB (ignoring filters), for context.
  const { data: totalIgInDb } = useQuery({
    queryKey: ['social-contacts-ig-total'],
    enabled: open,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from('social_contacts')
        .select('ig_user_id', { count: 'exact', head: true })
        .eq('channel', 'instagram');
      if (error) throw error;
      return count ?? 0;
    },
  });

  const [syncing, setSyncing] = useState(false);
  const runSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('zernio-contacts-sync', { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Sincronizados ${(data as any)?.synced ?? 0} contatos do Zernio`);
      qc.invalidateQueries({ queryKey: ['social-broadcast-contacts'] });
      qc.invalidateQueries({ queryKey: ['social-contacts-ig-total'] });
    } catch (e: any) {
      toast.error(`Falha ao sincronizar: ${e.message ?? e}`);
    } finally { setSyncing(false); }
  };

  const { data: broadcasts, isLoading } = useQuery({
    queryKey: ['social-broadcasts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_broadcasts')
        .select('*')
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const tagsArray = useMemo(
    () => tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
    [tagsInput],
  );

  const { data: contacts, isFetching: contactsLoading } = useQuery({
    queryKey: ['social-broadcast-contacts', zernioAccountId, onlyFollowers, onlySubscribed, tagsArray.join(',')],
    enabled: open && step >= 1 && !!zernioAccountId,
    queryFn: async () => {
      let q = (supabase as any)
        .from('social_contacts')
        .select('ig_user_id, ig_username, is_follower, subscribed, tags, custom_fields, first_seen_at, last_seen_at')
        .eq('channel', 'instagram')
        .order('first_seen_at', { ascending: false, nullsFirst: false })
        .limit(500);
      if (onlySubscribed) q = q.eq('subscribed', true);
      if (onlyFollowers) q = q.eq('is_follower', true);
      if (tagsArray.length) q = q.overlaps('tags', tagsArray);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Default: select all eligible whenever the eligible list changes
  useEffect(() => {
    if (!contacts) return;
    setSelectedIds(new Set(contacts.map((c) => c.ig_user_id)));
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    const q = contactSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      (c.ig_username ?? '').toLowerCase().includes(q) ||
      (c.ig_user_id ?? '').toLowerCase().includes(q),
    );
  }, [contacts, contactSearch]);

  const toggleOne = (id: string) => {
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const resetWizard = () => {
    setOpen(false); setStep(0); setName(''); setMessage(''); setScheduledAt('');
    setTagsInput(''); setZernioAccountId(''); setOnlyFollowers(false); setOnlySubscribed(true);
    setSelectedIds(new Set()); setContactSearch('');
  };

  const create = async () => {
    try {
      if (!zernioAccountId) { toast.error('Selecione a conta Zernio do Instagram'); return; }
      if (selectedIds.size === 0) { toast.error('Selecione ao menos 1 contato'); return; }
      const seg: any = {
        zernio_account_id: zernioAccountId,
        tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [],
        is_follower: onlyFollowers,
        subscribed: onlySubscribed,
        message,
        contact_ids: Array.from(selectedIds),
        contacts_count: selectedIds.size,
      };
      const { error } = await supabase.from('social_broadcasts').insert({
        name, channel: 'instagram_dm',
        segment: seg,
        scheduled_at: scheduledAt || null,
        status: scheduledAt ? 'scheduled' : 'draft',
      });
      if (error) throw error;
      toast.success('Broadcast criado');
      resetWizard();
      qc.invalidateQueries({ queryKey: ['social-broadcasts'] });
    } catch (e: any) { toast.error(e.message); }
  };

  const dispatch = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('zernio-broadcast-dispatch', { body: { broadcast_id: id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Disparo enfileirado');
      qc.invalidateQueries({ queryKey: ['social-broadcasts'] });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="w-6 h-6" /> Broadcasts</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Instagram className="w-3.5 h-3.5" /> Disparos em massa segmentados — Instagram Direct (via Zernio)
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetWizard(); }}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Novo broadcast</Button></DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Novo broadcast — passo {step + 1}/4</DialogTitle></DialogHeader>
            {step === 0 && (
              <div className="space-y-3">
                <div className="flex gap-2 items-start rounded-md border border-pink-500/30 bg-pink-500/5 p-2.5 text-xs text-foreground/80">
                  <Info className="w-4 h-4 mt-0.5 text-pink-500 flex-shrink-0" />
                  <div>
                    Disparo via <strong>Instagram Direct (Zernio)</strong>. Contatos de WhatsApp, Facebook ou TikTok <strong>não são elegíveis</strong> neste canal.
                    {typeof totalIgInDb === 'number' && (
                      <> Universo atual: <strong>{totalIgInDb}</strong> contatos IG sincronizados.</>
                    )}
                  </div>
                </div>
                <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div>
                  <Label>Conta Instagram (Zernio) — único canal suportado</Label>
                  <Select value={zernioAccountId} onValueChange={setZernioAccountId} disabled={(zernioAccounts ?? []).length === 1}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(zernioAccounts ?? []).length === 0 && (
                        <div className="p-2 text-xs text-muted-foreground">Nenhuma conta IG sincronizada. Rode "Sincronizar Zernio" em Contatos.</div>
                      )}
                      {(zernioAccounts ?? []).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.display_name ?? a.handle ?? a.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(zernioAccounts ?? []).length === 1 && (
                    <p className="text-[11px] text-muted-foreground mt-1">Conta única detectada — selecionada automaticamente.</p>
                  )}
                </div>
                <div><Label>Tags dos contatos (vírgula, opcional)</Label>
                  <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="vip, lead_quente" />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <Label className="cursor-pointer text-sm">
                    Apenas seguidores
                    <span className="text-[11px] text-muted-foreground ml-2">(filtra por <code>is_follower</code>)</span>
                  </Label>
                  <Switch checked={onlyFollowers} onCheckedChange={setOnlyFollowers} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <Label className="cursor-pointer text-sm">
                    Somente inscritos (opt-in)
                    <span className="text-[11px] text-muted-foreground ml-2">recomendado</span>
                  </Label>
                  <Switch checked={onlySubscribed} onCheckedChange={setOnlySubscribed} />
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder="Buscar por @handle ou IG ID…"
                      className="pl-8 h-9"
                    />
                  </div>
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {selectedIds.size} sel. · {contacts?.length ?? 0} elegíveis{typeof totalIgInDb === 'number' ? ` de ${totalIgInDb} IG` : ''}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set((contacts ?? []).map((c) => c.ig_user_id)))}>
                    Todos
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                    Limpar
                  </Button>
                </div>
                <div className="rounded-md border border-border">
                  <div className="grid grid-cols-[28px_1fr_140px_140px_1fr_110px] gap-2 px-3 py-2 text-[11px] font-semibold uppercase text-muted-foreground border-b">
                    <div></div>
                    <div>Handle</div>
                    <div>Instagram ID</div>
                    <div>ManyChat ID</div>
                    <div>Tags</div>
                    <div>Entrou há</div>
                  </div>
                  <ScrollArea className="h-[360px]">
                    {contactsLoading && (
                      <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                    )}
                    {!contactsLoading && filteredContacts.length === 0 && (
                      <div className="py-8 px-6 space-y-3 text-sm">
                        <div className="font-semibold text-foreground">Nenhum contato elegível com esses filtros.</div>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                          {!zernioAccountId && <li>Nenhuma conta Instagram selecionada no passo anterior.</li>}
                          {onlyFollowers && <li><strong>“Apenas seguidores”</strong> está ligado — desligue se a base não tem followers marcados.</li>}
                          {onlySubscribed && <li><strong>“Somente inscritos (opt-in)”</strong> está ligado — contatos sem <code>subscribed=true</code> ficam de fora.</li>}
                          {tagsArray.length > 0 && <li>Filtro por tags ativo: <code>{tagsArray.join(', ')}</code>.</li>}
                          {typeof totalIgInDb === 'number' && totalIgInDb === 0 && <li>Não há contatos Instagram em <code>social_contacts</code>. Rode a sincronização do Zernio.</li>}
                          {typeof totalIgInDb === 'number' && totalIgInDb > 0 && contacts?.length === 0 && <li>Existem {totalIgInDb} contatos IG no banco, mas nenhum passou pelos filtros acima.</li>}
                        </ul>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button size="sm" variant="outline" onClick={() => setStep(0)}>Voltar e ajustar filtros</Button>
                          <Button size="sm" variant="outline" onClick={runSync} disabled={syncing}>
                            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Sincronizando…' : 'Sincronizar Zernio agora'}
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link to="/social/contatos"><ExternalLink className="w-3.5 h-3.5 mr-1.5" />Inspecionar contatos</Link>
                          </Button>
                        </div>
                      </div>
                    )}
                    {!contactsLoading && filteredContacts.map((c) => {
                      const checked = selectedIds.has(c.ig_user_id);
                      const mc = (c.custom_fields ?? {})?.manychat_id ?? null;
                      const t = Array.isArray(c.tags) ? c.tags : [];
                      return (
                        <div
                          key={c.ig_user_id}
                          className="grid grid-cols-[28px_1fr_140px_140px_1fr_110px] gap-2 px-3 py-1.5 items-center text-xs border-b border-border/40 hover:bg-accent/40 cursor-pointer"
                          onClick={() => toggleOne(c.ig_user_id)}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleOne(c.ig_user_id)} onClick={(e) => e.stopPropagation()} />
                          <div className="truncate font-medium">@{c.ig_username ?? '—'}</div>
                          <div className="truncate font-mono text-[10px] text-muted-foreground">{c.ig_user_id}</div>
                          <div className="truncate font-mono text-[10px] text-muted-foreground">{mc ?? '—'}</div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {t.length ? t.slice(0, 3).join(', ') + (t.length > 3 ? ` +${t.length - 3}` : '') : '—'}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {c.first_seen_at ? formatDistanceToNowStrict(new Date(c.first_seen_at), { locale: ptBR }) : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </ScrollArea>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Lista limitada a 500 contatos. Use tags ou filtros para refinar.
                </p>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Mensagem</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="h-8 gap-1">
                        <Smile className="w-4 h-4" /> Emojis
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-3" align="end">
                      <EmojiPicker onSelect={(emoji) => {
                        const el = messageRef.current;
                        if (!el) { setMessage((m) => m + emoji); return; }
                        const start = el.selectionStart ?? el.value.length;
                        const end = el.selectionEnd ?? el.value.length;
                        const before = el.value.slice(0, start);
                        const after = el.value.slice(end);
                        const next = before + emoji + after;
                        setMessage(next);
                        requestAnimationFrame(() => {
                          el.focus();
                          el.setSelectionRange(start + emoji.length, start + emoji.length);
                        });
                      }} />
                    </PopoverContent>
                  </Popover>
                </div>
                <Textarea ref={messageRef} value={message} onChange={(e) => setMessage(e.target.value)} rows={8} placeholder="Olá {{first_name}}, …" />
                <p className="text-xs text-muted-foreground">Variáveis: {'{{first_name}}'}, {'{{name}}'} — preenchidas a partir do contato.</p>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-3">
                <Label>Data/hora (vazio = manual)</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                <Card><CardContent className="p-3 text-sm">
                  <div className="font-semibold mb-1">{name || 'Sem nome'}</div>
                  <div className="text-muted-foreground text-xs">Canal: Instagram Direct (Zernio)</div>
                  <div className="text-muted-foreground text-xs">
                    Conta: {(zernioAccounts ?? []).find((a: any) => a.id === zernioAccountId)?.display_name ?? '—'}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Filtros: tags={tagsInput || '—'} · seguidores={onlyFollowers ? 'sim' : 'não'} · inscritos={onlySubscribed ? 'sim' : 'não'}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Destinatários: {selectedIds.size} contatos
                  </div>
                  <p className="mt-2 text-xs whitespace-pre-wrap">{message}</p>
                </CardContent></Card>
              </div>
            )}
            <DialogFooter>
              {step > 0 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Voltar</Button>}
              {step < 3 ? (
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={
                    (step === 0 && (!name || !zernioAccountId)) ||
                    (step === 1 && selectedIds.size === 0) ||
                    (step === 2 && !message)
                  }
                >Avançar</Button>
              ) : (
                <Button onClick={create}>Criar</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading ? <Skeleton className="h-64" /> : broadcasts?.length === 0 ? (
        <Card><CardContent className="py-12 text-center space-y-3">
          <Megaphone className="w-12 h-12 mx-auto text-muted-foreground" />
          <h3 className="font-semibold">Nenhum broadcast</h3>
          <p className="text-sm text-muted-foreground">Crie seu primeiro DM em massa pelo Instagram.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {broadcasts!.map((b: any) => (
            <Card key={b.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1"><Instagram className="w-3 h-3" /> {b.channel === 'instagram_dm' ? 'IG Direct' : b.channel}</Badge>
                    <Badge variant="secondary">{b.status}</Badge>
                    {b.scheduled_at && <span>{new Date(b.scheduled_at).toLocaleString('pt-BR')}</span>}
                    <span>Enviados: {b.total_sent ?? 0}</span>
                  </div>
                </div>
                {(b.status === 'draft' || b.status === 'scheduled') && (
                  <Button size="sm" onClick={() => dispatch(b.id)}><Send className="w-3.5 h-3.5 mr-1" /> Disparar</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}