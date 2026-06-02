import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Workflow as WorkflowIcon, Activity, CheckCircle2, Pencil, Copy, Trash2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export function SocialFlowsList() {
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
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

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const { data: src, error: err1 } = await supabase
        .from('social_flows')
        .select('*')
        .eq('id', id)
        .single();
      if (err1) throw err1;
      const { id: _id, created_at, updated_at, total_triggered, total_completed, total_leads_converted, ...rest } = src as any;
      const { error } = await supabase.from('social_flows').insert({
        ...rest,
        name: `${src.name} (cópia)`,
        is_active: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-flows'] });
      toast.success('Flow duplicado');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao duplicar'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('social_flows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-flows'] });
      toast.success('Flow excluído');
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao excluir'),
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
        <TooltipProvider><div className="grid gap-3">
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
                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Switch checked={!!f.is_active} onCheckedChange={(v) => toggle.mutate({ id: f.id, is_active: v })} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{f.is_active ? 'Desativar' : 'Ativar'}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to={`/social/flows/${f.id}/sessoes`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4" /></Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Sessões</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to={`/social/flows/${f.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="w-4 h-4" /></Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Editar</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={duplicate.isPending}
                        onClick={() => duplicate.mutate(f.id)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicar</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setToDelete({ id: f.id, name: f.name })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Excluir</TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          ))}
        </div></TooltipProvider>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir flow?</AlertDialogTitle>
            <AlertDialogDescription>
              O flow <strong>{toDelete?.name}</strong> e todas suas sessões/triggers serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && remove.mutate(toDelete.id)}
              disabled={remove.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}