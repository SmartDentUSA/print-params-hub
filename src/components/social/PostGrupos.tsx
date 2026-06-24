import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PostGruposInstanceCard } from './PostGruposInstanceCard';
import { PostGruposHistory } from './PostGruposHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Users2, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type InstanceConfig = {
  id: string;
  instance_name: string;
  enabled: boolean;
  is_primary: boolean;
  evolution_phone: string | null;
};

export function PostGrupos() {
  const [instances, setInstances] = useState<InstanceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);

  const load = useCallback(async () => {
    const [{ data }, { data: targets }] = await Promise.all([
      supabase
        .from('post_group_instance_config')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('instance_name'),
      supabase
        .from('v_post_group_targets_detail')
        .select('target_id, member_count'),
    ]);
    setInstances((data as InstanceConfig[]) ?? []);
    const rows = (targets as { member_count: number | null }[]) ?? [];
    setTotalGroups(rows.length);
    setTotalMembers(rows.reduce((s, r) => s + (r.member_count ?? 0), 0));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Send className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Post Grupos</h1>
          <p className="text-sm text-muted-foreground">
            Selecione os grupos de WhatsApp que receberão os disparos automáticos por instância.
          </p>
        </div>
      </div>

      <Tabs defaultValue="instancias" className="space-y-4">
        <TabsList>
          <TabsTrigger value="instancias">Instâncias</TabsTrigger>
          <TabsTrigger value="historico">Histórico de disparos</TabsTrigger>
        </TabsList>

        <TabsContent value="instancias" className="space-y-4">
          <Card>
            <CardContent className="py-4 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums">
                    {totalMembers.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Membros impactados
                  </div>
                </div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums">
                    {totalGroups.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Grupos selecionados
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground ml-auto max-w-xs">
                Soma de todos os grupos selecionados em todas as instâncias, independente do status ATIVA/INATIVA.
              </p>
            </CardContent>
          </Card>

          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando instâncias...</div>
          ) : instances.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma instância configurada.</div>
          ) : (
            instances.map((inst) => (
              <PostGruposInstanceCard
                key={inst.id}
                instance={inst}
                onChanged={load}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="historico">
          <PostGruposHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}