import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Workflow as WorkflowIcon, Search, Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export function SocialSequences() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [steps, setSteps] = useState<any[]>([{ delay_minutes: 0, message: '' }]);
  const [daysWindow, setDaysWindow] = useState<number>(30);
  const [onlyFollowers, setOnlyFollowers] = useState<boolean>(true);
  const [onlySubscribed, setOnlySubscribed] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Carrega contatos elegíveis em tempo real conforme filtros
  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['social-sequence-audience', channel, daysWindow, onlyFollowers, onlySubscribed, open],
    enabled: open,
    queryFn: async () => {
      const chanFilter = channel === 'instagram_dm' ? 'instagram' : 'whatsapp';
      const since = new Date(Date.now() - daysWindow * 86_400_000).toISOString();
      let q = supabase
        .from('social_contacts')
        .select('id, ig_username, ig_user_id, channel, tags, first_seen_at, is_follower, subscribed, custom_fields')
        .eq('channel', chanFilter)
        .gte('first_seen_at', since)
        .order('first_seen_at', { ascending: false })
        .limit(500);
      if (onlyFollowers && chanFilter === 'instagram') q = q.eq('is_follower', true);
      if (onlySubscribed) q = q.eq('subscribed', true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Default = todos selecionados
  useEffect(() => {
    if (contacts) setSelectedIds(new Set(contacts.map((c: any) => c.id)));
  }, [contacts]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return contacts ?? [];
    return (contacts ?? []).filter((c: any) => {
      return (
        (c.ig_username ?? '').toLowerCase().includes(term) ||
        (c.ig_user_id ?? '').toLowerCase().includes(term) ||
        ((c.custom_fields?.manychat_id ?? '') as string).toLowerCase().includes(term) ||
        (c.tags ?? []).some((t: string) => (t ?? '').toLowerCase().includes(term))
      );
    });
  }, [contacts, searchTerm]);

  const toggleId = (id: string) => {
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const { data: sequences, isLoading } = useQuery({
    queryKey: ['social-sequences'],
    queryFn: async () => {
      const { data, error } = await supabase.from('social_sequences').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = async () => {
    try {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) { toast.error('Selecione pelo menos 1 contato'); return; }
      const { error } = await supabase.from('social_sequences').insert({
        name, channel,
        steps: steps as any,
        is_active: true,
        audience_source: 'social_contacts',
        audience_filters: { days_window: daysWindow, only_followers: onlyFollowers, only_subscribed: onlySubscribed } as any,
        audience_contact_ids: ids,
        audience_count: ids.length,
      });
      if (error) throw error;
      toast.success(`Sequência criada — ${ids.length} contato(s) inscritos`);
      setOpen(false); setName(''); setSteps([{ delay_minutes: 0, message: '' }]);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ['social-sequences'] });
    } catch (e: any) { toast.error(e.message); }
  };

  const toggle = async (id: string, is_active: boolean) => {
    await supabase.from('social_sequences').update({ is_active }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['social-sequences'] });
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><WorkflowIcon className="w-6 h-6" /> Sequências</h1>
          <p className="text-sm text-muted-foreground">Régua de mensagens automáticas com delays</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Nova sequência</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova sequência</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Canal</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram_dm">Instagram DM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ───── Público-alvo ───── */}
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <Label className="font-semibold">Público-alvo</Label>
                  <Badge variant="secondary" className="ml-auto">
                    {selectedIds.size} / {contacts?.length ?? 0} selecionados
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Entrou nos últimos (dias)</Label>
                    <Input type="number" min={1} max={365} value={daysWindow} onChange={(e) => setDaysWindow(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                  {channel === 'instagram_dm' && (
                    <div className="flex items-center gap-2 mt-5">
                      <Switch checked={onlyFollowers} onCheckedChange={setOnlyFollowers} />
                      <Label className="text-xs">Apenas seguidores</Label>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-5">
                    <Switch checked={onlySubscribed} onCheckedChange={setOnlySubscribed} />
                    <Label className="text-xs">Apenas inscritos</Label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar handle, ID, tag..." className="pl-7 h-8 text-xs" />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set((contacts ?? []).map((c: any) => c.id)))}>Todos</Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>Limpar</Button>
                </div>
                <ScrollArea className="h-56 rounded border border-border">
                  {loadingContacts ? (
                    <div className="p-6 text-center text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Carregando...</div>
                  ) : filtered.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">Nenhum contato elegível.</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/50">
                        <tr className="text-left">
                          <th className="p-2 w-8"></th>
                          <th className="p-2">Handle / Nome</th>
                          <th className="p-2">ID</th>
                          <th className="p-2">Tags</th>
                          <th className="p-2">Entrou há</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((c: any) => (
                          <tr key={c.id} className="border-t border-border hover:bg-accent/40">
                            <td className="p-2"><Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleId(c.id)} /></td>
                            <td className="p-2 truncate">{c.ig_username ?? '—'}</td>
                            <td className="p-2 truncate text-muted-foreground">{c.ig_user_id ?? c.custom_fields?.manychat_id ?? '—'}</td>
                            <td className="p-2"><span className="line-clamp-1">{(c.tags ?? []).join(', ') || '—'}</span></td>
                            <td className="p-2 whitespace-nowrap text-muted-foreground">
                              {c.first_seen_at ? formatDistanceToNowStrict(new Date(c.first_seen_at), { locale: ptBR }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>Passos</Label>
                {steps.map((s, i) => (
                  <Card key={i}><CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Atraso (min)</Label>
                      <Input type="number" className="w-24" value={s.delay_minutes} onChange={(e) => setSteps((sx) => sx.map((x, idx) => idx === i ? { ...x, delay_minutes: Number(e.target.value) } : x))} />
                      <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setSteps((sx) => sx.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    <Textarea value={s.message} onChange={(e) => setSteps((sx) => sx.map((x, idx) => idx === i ? { ...x, message: e.target.value } : x))} placeholder="Mensagem" rows={3} />
                  </CardContent></Card>
                ))}
                <Button variant="outline" size="sm" onClick={() => setSteps((sx) => [...sx, { delay_minutes: 60, message: '' }])}><Plus className="w-4 h-4 mr-1" /> Adicionar passo</Button>
              </div>
            </div>
            <DialogFooter><Button onClick={create} disabled={!name || steps.some((s) => !s.message)}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading ? <Skeleton className="h-32" /> : sequences?.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma sequência ainda.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {sequences!.map((s: any) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <Badge variant="outline">{s.channel}</Badge>
                    <span>{(s.steps ?? []).length} passos</span>
                  </div>
                </div>
                <Switch checked={s.is_active} onCheckedChange={(v) => toggle(s.id, v)} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}