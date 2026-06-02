import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Workflow as WorkflowIcon, Search, Loader2, Users, Pencil, Copy, Settings2, Instagram, Youtube, Sparkles, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { SocialPostLinkPicker, type SocialPostPickResult } from '@/components/social/flows/SocialPostLinkPicker';
import { PromoSeqInspector } from '@/components/smartops/wa-groups/WaGroupFlowBuilder';
import type { PromoSeqNode } from '@/components/smartops/wa-groups/types';

type StepKind = 'msg' | 'link_ig' | 'link_yt' | 'promo_seq';
type Step =
  | { kind: 'msg'; delay_minutes: number; message: string }
  | { kind: 'link_ig'; delay_minutes: number; url: string; caption: string; titulo?: string; thumbnail_url?: string }
  | { kind: 'link_yt'; delay_minutes: number; url: string; caption: string; titulo?: string; thumbnail_url?: string }
  | { kind: 'promo_seq'; delay_minutes: number; produto_slug: string; produto_name?: string; bucket: 'aftersales' | 'cs' | 'spin'; messages: { order: number; content: string; enabled: boolean }[]; interval_seconds: number };

function normalizeStep(s: any): Step {
  const kind: StepKind = s?.kind ?? 'msg';
  const delay = Number(s?.delay_minutes ?? 0);
  if (kind === 'link_ig' || kind === 'link_yt') return { kind, delay_minutes: delay, url: s?.url ?? '', caption: s?.caption ?? '', titulo: s?.titulo, thumbnail_url: s?.thumbnail_url };
  if (kind === 'promo_seq') return { kind, delay_minutes: delay, produto_slug: s?.produto_slug ?? '', produto_name: s?.produto_name, bucket: s?.bucket ?? 'aftersales', messages: Array.isArray(s?.messages) ? s.messages : [], interval_seconds: Number(s?.interval_seconds ?? 86400) };
  return { kind: 'msg', delay_minutes: delay, message: s?.message ?? '' };
}

function stepIcon(k: StepKind) {
  if (k === 'link_ig') return <Instagram className="w-3.5 h-3.5 text-pink-600" />;
  if (k === 'link_yt') return <Youtube className="w-3.5 h-3.5 text-red-600" />;
  if (k === 'promo_seq') return <Sparkles className="w-3.5 h-3.5 text-purple-600" />;
  return <MessageSquare className="w-3.5 h-3.5 text-primary" />;
}

function stepLabel(k: StepKind) {
  return k === 'msg' ? 'Mensagem' : k === 'link_ig' ? 'Link Instagram' : k === 'link_yt' ? 'Link YouTube' : 'Sequência promo';
}

function emptyStep(k: StepKind, delay = 60): Step {
  if (k === 'link_ig' || k === 'link_yt') return { kind: k, delay_minutes: delay, url: '', caption: '' };
  if (k === 'promo_seq') return { kind: 'promo_seq', delay_minutes: delay, produto_slug: '', bucket: 'aftersales', messages: [], interval_seconds: 86400 };
  return { kind: 'msg', delay_minutes: delay, message: '' };
}

function isStepValid(s: Step): boolean {
  if (s.kind === 'msg') return !!s.message.trim();
  if (s.kind === 'link_ig' || s.kind === 'link_yt') return !!s.url.trim();
  return !!s.produto_slug && s.messages.some((m) => m.enabled);
}

export function SocialSequences() {
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null); // null = create

  const { data: sequences, isLoading } = useQuery({
    queryKey: ['social-sequences'],
    queryFn: async () => {
      const { data, error } = await supabase.from('social_sequences').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = async (id: string, is_active: boolean) => {
    await supabase.from('social_sequences').update({ is_active }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['social-sequences'] });
  };

  const duplicate = async (s: any) => {
    const { id, created_at, updated_at, ...rest } = s;
    const { error } = await supabase.from('social_sequences').insert({ ...rest, name: `${s.name} (cópia)`, is_active: false });
    if (error) { toast.error(error.message); return; }
    toast.success('Sequência duplicada');
    qc.invalidateQueries({ queryKey: ['social-sequences'] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('social_sequences').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Sequência excluída');
    qc.invalidateQueries({ queryKey: ['social-sequences'] });
  };

  const openCreate = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (s: any) => { setEditing(s); setEditorOpen(true); };

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><WorkflowIcon className="w-6 h-6" /> Sequências</h1>
          <p className="text-sm text-muted-foreground">Régua de mensagens automáticas com delays</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Nova sequência</Button>
      </header>

      <SequenceEditorDialog
        open={editorOpen}
        onOpenChange={(v) => { setEditorOpen(v); if (!v) setEditing(null); }}
        sequence={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ['social-sequences'] })}
      />

      {isLoading ? <Skeleton className="h-32" /> : sequences?.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma sequência ainda.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {sequences!.map((s: any) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <Badge variant="outline">{s.channel}</Badge>
                    <span>{(s.steps ?? []).length} passos</span>
                    {typeof s.audience_count === 'number' && <span>· {s.audience_count} contato(s)</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(s)}><Settings2 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" title="Renomear" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" title="Duplicar" onClick={() => duplicate(s)}><Copy className="w-4 h-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" title="Excluir" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir sequência?</AlertDialogTitle>
                        <AlertDialogDescription>"{s.name}" será removida permanentemente. Inscrições ativas serão canceladas.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Switch checked={s.is_active} onCheckedChange={(v) => toggle(s.id, v)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============= Editor (create + edit) =============
function SequenceEditorDialog({ open, onOpenChange, sequence, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; sequence: any | null; onSaved: () => void }) {
  const isEdit = !!sequence;
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [steps, setSteps] = useState<Step[]>([emptyStep('msg', 0)]);
  const [daysWindow, setDaysWindow] = useState<number>(30);
  const [onlyFollowers, setOnlyFollowers] = useState<boolean>(true);
  const [onlySubscribed, setOnlySubscribed] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reselect, setReselect] = useState(false);
  const [postPickerFor, setPostPickerFor] = useState<{ index: number; platform: 'instagram' | 'youtube' } | null>(null);
  const [saving, setSaving] = useState(false);

  // Hidrata em edit
  useEffect(() => {
    if (!open) return;
    if (sequence) {
      setName(sequence.name ?? '');
      setChannel(sequence.channel ?? 'whatsapp');
      setSteps((sequence.steps ?? []).map(normalizeStep));
      const f = sequence.audience_filters ?? {};
      setDaysWindow(Number(f.days_window ?? 30));
      setOnlyFollowers(f.only_followers ?? true);
      setOnlySubscribed(f.only_subscribed ?? true);
      setSelectedIds(new Set(sequence.audience_contact_ids ?? []));
      setReselect(false);
    } else {
      setName(''); setChannel('whatsapp'); setSteps([emptyStep('msg', 0)]);
      setDaysWindow(30); setOnlyFollowers(true); setOnlySubscribed(true);
      setSelectedIds(new Set()); setReselect(true);
    }
    setSearchTerm('');
  }, [open, sequence]);

  const audienceActive = reselect || !isEdit;

  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['social-sequence-audience', channel, daysWindow, onlyFollowers, onlySubscribed, audienceActive],
    enabled: open && audienceActive,
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

  // Default = todos selecionados, ao trocar filtros (apenas no modo "reselect" ou create)
  useEffect(() => {
    if (!audienceActive || !contacts) return;
    if (!isEdit || reselect) setSelectedIds(new Set(contacts.map((c: any) => c.id)));
  }, [contacts, audienceActive, reselect, isEdit]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return contacts ?? [];
    return (contacts ?? []).filter((c: any) =>
      (c.ig_username ?? '').toLowerCase().includes(term) ||
      (c.ig_user_id ?? '').toLowerCase().includes(term) ||
      ((c.custom_fields?.manychat_id ?? '') as string).toLowerCase().includes(term) ||
      (c.tags ?? []).some((t: string) => (t ?? '').toLowerCase().includes(term)),
    );
  }, [contacts, searchTerm]);

  const toggleId = (id: string) => setSelectedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const updateStep = (i: number, patch: Partial<Step>) => setSteps((sx) => sx.map((x, idx) => idx === i ? ({ ...(x as any), ...(patch as any) }) : x));
  const changeKind = (i: number, k: StepKind) => setSteps((sx) => sx.map((x, idx) => idx === i ? emptyStep(k, x.delay_minutes) : x));

  const stepsValid = steps.length > 0 && steps.every(isStepValid);

  const save = async () => {
    if (!name.trim()) { toast.error('Nome obrigatório'); return; }
    if (!stepsValid) { toast.error('Preencha todos os passos'); return; }
    const ids = Array.from(selectedIds);
    if (audienceActive && ids.length === 0) { toast.error('Selecione pelo menos 1 contato'); return; }
    setSaving(true);
    try {
      const payload: any = {
        name, channel,
        steps: steps as any,
      };
      if (audienceActive) {
        payload.audience_source = 'social_contacts';
        payload.audience_filters = { days_window: daysWindow, only_followers: onlyFollowers, only_subscribed: onlySubscribed };
        payload.audience_contact_ids = ids;
        payload.audience_count = ids.length;
      }
      if (isEdit) {
        const { error } = await supabase.from('social_sequences').update(payload).eq('id', sequence.id);
        if (error) throw error;
        toast.success('Sequência atualizada');
      } else {
        payload.is_active = true;
        const { error } = await supabase.from('social_sequences').insert(payload);
        if (error) throw error;
        toast.success(`Sequência criada — ${ids.length} contato(s) inscritos`);
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar sequência' : 'Nova sequência'}</DialogTitle></DialogHeader>
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

          {/* Público-alvo */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <Label className="font-semibold">Público-alvo</Label>
              <Badge variant="secondary" className="ml-auto">
                {audienceActive ? `${selectedIds.size} / ${contacts?.length ?? 0} selecionados` : `${selectedIds.size} contato(s) inscritos`}
              </Badge>
            </div>

            {!audienceActive && (
              <Button variant="outline" size="sm" onClick={() => setReselect(true)}>Re-selecionar público</Button>
            )}

            {audienceActive && (<>
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
                        <th className="p-2 w-8"></th><th className="p-2">Handle / Nome</th><th className="p-2">ID</th><th className="p-2">Tags</th><th className="p-2">Entrou há</th>
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
            </>)}
          </div>

          {/* Passos */}
          <div className="space-y-2">
            <Label>Passos</Label>
            {steps.map((s, i) => (
              <Card key={i}><CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-medium">{stepIcon(s.kind)} <span>Passo {i + 1}</span></div>
                  <Select value={s.kind} onValueChange={(v) => changeKind(i, v as StepKind)}>
                    <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="msg">{stepLabel('msg')}</SelectItem>
                      <SelectItem value="link_ig">{stepLabel('link_ig')}</SelectItem>
                      <SelectItem value="link_yt">{stepLabel('link_yt')}</SelectItem>
                      <SelectItem value="promo_seq">{stepLabel('promo_seq')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="text-xs ml-2">Atraso (min)</Label>
                  <Input type="number" className="w-24 h-8" value={s.delay_minutes} onChange={(e) => updateStep(i, { delay_minutes: Number(e.target.value) } as any)} />
                  <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setSteps((sx) => sx.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4" /></Button>
                </div>

                {s.kind === 'msg' && (
                  <Textarea value={s.message} onChange={(e) => updateStep(i, { message: e.target.value } as any)} placeholder="Mensagem" rows={3} />
                )}

                {(s.kind === 'link_ig' || s.kind === 'link_yt') && (
                  <div className="space-y-2">
                    {s.url ? (
                      <div className="flex items-center gap-2 rounded border border-border bg-muted/30 p-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{s.titulo || 'Link'}</div>
                          <a href={s.url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline truncate block">{s.url}</a>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setPostPickerFor({ index: i, platform: s.kind === 'link_ig' ? 'instagram' : 'youtube' })}>Trocar</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => setPostPickerFor({ index: i, platform: s.kind === 'link_ig' ? 'instagram' : 'youtube' })}>
                        {s.kind === 'link_ig' ? <Instagram className="w-3.5 h-3.5 mr-1.5 text-pink-600" /> : <Youtube className="w-3.5 h-3.5 mr-1.5 text-red-600" />}
                        Selecionar link do {s.kind === 'link_ig' ? 'Instagram' : 'YouTube'}
                      </Button>
                    )}
                    <Textarea value={s.caption} onChange={(e) => updateStep(i, { caption: e.target.value } as any)} placeholder="Mensagem que acompanha o link (editável)" rows={3} />
                  </div>
                )}

                {s.kind === 'promo_seq' && (
                  <PromoSeqInspector
                    node={{ id: `seq-${i}`, type: 'promo_seq', produto_slug: s.produto_slug, produto_name: s.produto_name, bucket: s.bucket, messages: s.messages, interval_seconds: s.interval_seconds } as PromoSeqNode}
                    onChange={(p) => updateStep(i, p as any)}
                  />
                )}
              </CardContent></Card>
            ))}
            <Button variant="outline" size="sm" onClick={() => setSteps((sx) => [...sx, emptyStep('msg', 60)])}><Plus className="w-4 h-4 mr-1" /> Adicionar passo</Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !name || !stepsValid || (audienceActive && selectedIds.size === 0)}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {isEdit ? 'Salvar' : `Criar (${selectedIds.size})`}
          </Button>
        </DialogFooter>

        <SocialPostLinkPicker
          open={!!postPickerFor}
          onOpenChange={(o) => { if (!o) setPostPickerFor(null); }}
          platform={postPickerFor?.platform}
          onSelect={(p: SocialPostPickResult) => {
            if (!postPickerFor) return;
            updateStep(postPickerFor.index, { url: p.url, caption: p.caption ?? '', titulo: p.titulo, thumbnail_url: p.thumbnail_url } as any);
            setPostPickerFor(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}