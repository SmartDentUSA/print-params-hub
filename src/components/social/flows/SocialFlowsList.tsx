import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Workflow as WorkflowIcon, Activity, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export function SocialFlowsList() {
  const qc = useQueryClient();
  const { data: flows, isLoading } = useQuery({
    queryKey: ['social-flows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_flows')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('social_flows').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-flows'] });
      toast.success('Status atualizado');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro'),
  });

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><WorkflowIcon className="w-6 h-6" /> Flows IG DM</h1>
          <p className="text-sm text-muted-foreground">Automações de Instagram Direct & comentários via Zernio</p>
        </div>
        <Link to="/social/flows/novo">
          <Button><Plus className="w-4 h-4 mr-1" /> Novo Flow</Button>
        </Link>
      </header>

      {isLoading ? (
        <div className="grid gap-3">{[0,1,2].map(i => <Skeleton key={i} className="h-24" />)}</div>
      ) : flows?.length === 0 ? (
        <Card><CardContent className="py-12 text-center space-y-3">
          <WorkflowIcon className="w-12 h-12 mx-auto text-muted-foreground" />
          <h3 className="font-semibold">Nenhum flow criado</h3>
          <p className="text-sm text-muted-foreground">Crie seu primeiro flow para automatizar respostas no IG.</p>
          <Link to="/social/flows/novo"><Button>Criar primeiro flow</Button></Link>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {flows!.map((f: any) => (
            <Card key={f.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link to={`/social/flows/${f.id}`} className="font-medium hover:underline">{f.name}</Link>
                  {f.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{f.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="capitalize">{f.channel}</Badge>
                    <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {f.total_triggered ?? 0}</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {f.total_completed ?? 0}</span>
                    <span>{f.total_leads_converted ?? 0} leads</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Switch checked={!!f.is_active} onCheckedChange={(v) => toggle.mutate({ id: f.id, is_active: v })} />
                  <Link to={`/social/flows/${f.id}/sessoes`}>
                    <Button variant="ghost" size="sm">Sessões</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}