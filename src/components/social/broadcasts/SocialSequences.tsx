import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Workflow as WorkflowIcon } from 'lucide-react';
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
import { toast } from 'sonner';

export function SocialSequences() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [steps, setSteps] = useState<any[]>([{ delay_minutes: 0, message: '' }]);

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
      const { error } = await supabase.from('social_sequences').insert({ name, channel, steps: steps as any, is_active: true });
      if (error) throw error;
      toast.success('Sequência criada');
      setOpen(false); setName(''); setSteps([{ delay_minutes: 0, message: '' }]);
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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