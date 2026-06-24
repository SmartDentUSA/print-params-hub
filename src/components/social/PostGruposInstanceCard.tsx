import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { PostGruposAddModal } from './PostGruposAddModal';

type Instance = {
  id: string;
  instance_name: string;
  enabled: boolean;
  is_primary: boolean;
  evolution_phone: string | null;
};

type TargetRow = {
  target_id: string;
  group_id: string;
  group_name: string | null;
  member_count: number | null;
  tipo: string | null;
};

export function PostGruposInstanceCard({ instance, onChanged }: { instance: Instance; onChanged: () => void }) {
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: rows }, { count }] = await Promise.all([
      supabase
        .from('v_post_group_targets_detail')
        .select('target_id, group_id, group_name, member_count, tipo')
        .eq('instance_name', instance.instance_name)
        .order('member_count', { ascending: false }),
      supabase
        .from('wa_groups')
        .select('id', { count: 'exact', head: true })
        .eq('instance_name', instance.instance_name)
        .eq('ativo', true),
    ]);
    setTargets((rows as TargetRow[]) ?? []);
    setAvailableCount(count ?? 0);
    setLoading(false);
  }, [instance.instance_name]);

  useEffect(() => { load(); }, [load]);

  async function toggleEnabled(next: boolean) {
    const { error } = await supabase
      .from('post_group_instance_config')
      .update({ enabled: next })
      .eq('id', instance.id);
    if (error) return toast.error('Falha ao atualizar instância');
    toast.success(next ? 'Instância ativada' : 'Instância desativada');
    onChanged();
  }

  async function removeTarget(target_id: string) {
    const { error } = await supabase.from('post_group_targets').delete().eq('id', target_id);
    if (error) return toast.error('Falha ao remover grupo');
    toast.success('Grupo removido');
    load();
  }

  const totalMembers = targets.reduce((sum, t) => sum + (t.member_count ?? 0), 0);
  const isActive = instance.enabled;

  return (
    <Card className={isActive ? '' : 'opacity-75'}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{instance.instance_name}</h3>
              {instance.is_primary && <Badge variant="secondary" className="text-xs">primária</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalMembers.toLocaleString('pt-BR')} membros · {availableCount} grupos disponíveis
              {instance.evolution_phone && ` · ${instance.evolution_phone}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${isActive ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            {isActive ? 'ATIVA' : 'INATIVA'}
          </span>
          <Switch checked={isActive} onCheckedChange={toggleEnabled} />
        </div>
      </CardHeader>

      {isActive ? (
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Grupos selecionados para disparo
            </span>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground py-4">Carregando...</div>
          ) : targets.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-md">
              Nenhum grupo selecionado. Clique em "Adicionar" para começar.
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do grupo</TableHead>
                    <TableHead className="w-24 text-right">Membros</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map((t) => (
                    <TableRow key={t.target_id}>
                      <TableCell className="font-medium">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                        {t.group_name ?? '(sem nome)'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(t.member_count ?? 0).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removeTarget(t.target_id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {targets.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {targets.length} grupo{targets.length === 1 ? '' : 's'} selecionado{targets.length === 1 ? '' : 's'} ·{' '}
              {totalMembers.toLocaleString('pt-BR')} membros alcançados
            </p>
          )}
        </CardContent>
      ) : (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Desabilitada — grupos salvos, disparo suspenso.
          </p>
        </CardContent>
      )}

      {addOpen && (
        <PostGruposAddModal
          instanceName={instance.instance_name}
          existingGroupIds={targets.map((t) => t.group_id)}
          onClose={() => setAddOpen(false)}
          onAdded={() => { setAddOpen(false); load(); }}
        />
      )}
    </Card>
  );
}