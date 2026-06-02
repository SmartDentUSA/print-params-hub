import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function SocialFlowSessions() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['flow-sessions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_sessions')
        .select('*')
        .eq('flow_id', id)
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-4">
      <Link to="/social/flows"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button></Link>
      <h1 className="text-2xl font-bold">Sessões do flow</h1>
      {isLoading ? <Skeleton className="h-64" /> : data?.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma sessão ainda.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {data!.map((s: any) => (
            <Card key={s.id}>
              <CardContent className="p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{s.id.slice(0,8)}</div>
                  <div>Nó atual: <code className="text-xs">{s.current_node_id ?? '—'}</code></div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{s.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(s.updated_at ?? s.created_at).toLocaleString('pt-BR')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}