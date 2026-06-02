import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Megaphone, Send, Instagram } from 'lucide-react';
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
import { toast } from 'sonner';

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

  const create = async () => {
    try {
      if (!zernioAccountId) { toast.error('Selecione a conta Zernio do Instagram'); return; }
      const seg: any = {
        zernio_account_id: zernioAccountId,
        tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [],
        is_follower: onlyFollowers,
        subscribed: onlySubscribed,
        message,
      };
      const { error } = await supabase.from('social_broadcasts').insert({
        name, channel: 'instagram_dm',
        segment: seg,
        scheduled_at: scheduledAt || null,
        status: scheduledAt ? 'scheduled' : 'draft',
      });
      if (error) throw error;
      toast.success('Broadcast criado');
      setOpen(false); setStep(0); setName(''); setMessage(''); setScheduledAt('');
      setTagsInput(''); setZernioAccountId(''); setOnlyFollowers(false); setOnlySubscribed(true);
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Novo broadcast</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo broadcast — passo {step + 1}/3</DialogTitle></DialogHeader>
            {step === 0 && (
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label>Conta Zernio (Instagram)</Label>
                  <Select value={zernioAccountId} onValueChange={setZernioAccountId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a conta…" /></SelectTrigger>
                    <SelectContent>
                      {(zernioAccounts ?? []).length === 0 && (
                        <div className="p-2 text-xs text-muted-foreground">Nenhuma conta IG sincronizada. Rode "Sincronizar Zernio" em Contatos.</div>
                      )}
                      {(zernioAccounts ?? []).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.display_name ?? a.handle ?? a.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Tags dos contatos (vírgula, opcional)</Label>
                  <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="vip, lead_quente" />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <Label className="cursor-pointer text-sm">Apenas seguidores</Label>
                  <Switch checked={onlyFollowers} onCheckedChange={setOnlyFollowers} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <Label className="cursor-pointer text-sm">Somente inscritos (opt-in)</Label>
                  <Switch checked={onlySubscribed} onCheckedChange={setOnlySubscribed} />
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-3">
                <Label>Mensagem</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} placeholder="Olá {{first_name}}, …" />
                <p className="text-xs text-muted-foreground">Variáveis: {'{{first_name}}'}, {'{{name}}'} — preenchidas a partir do contato.</p>
              </div>
            )}
            {step === 2 && (
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
                  <p className="mt-2 text-xs whitespace-pre-wrap">{message}</p>
                </CardContent></Card>
              </div>
            )}
            <DialogFooter>
              {step > 0 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Voltar</Button>}
              {step < 2 ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 ? (!name || !zernioAccountId) : !message}>Avançar</Button>
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