import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type LogRow = {
  id: string;
  group_jid: string;
  campaign_name: string | null;
  status: string | null;
  sent_at: string | null;
  error_message: string | null;
  node_type: string | null;
};

export function PostGruposHistory() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Lemos a fila de mensagens de grupo (legível por usuários autenticados) e
      // resolvemos o nome da campanha em uma segunda consulta — não há FK entre
      // as tabelas, então embed do PostgREST não funciona aqui.
      const { data, error: qErr } = await supabase
        .from('wa_message_queue')
        .select('id, group_jid, status, sent_at, created_at, error_message, node_type, campaign_id')
        .order('created_at', { ascending: false })
        .limit(100);
      if (qErr) {
        setError(qErr.message);
        setLoading(false);
        return;
      }
      const queue = (data as any[]) ?? [];
      const campaignIds = Array.from(
        new Set(queue.map((r) => r.campaign_id).filter(Boolean)),
      );
      const names = new Map<string, string>();
      if (campaignIds.length > 0) {
        const { data: camps } = await supabase
          .from('wa_campaigns')
          .select('id, name')
          .in('id', campaignIds);
        for (const c of (camps as any[]) ?? []) names.set(c.id, c.name);
      }
      setRows(
        queue.map((r) => ({
          id: r.id,
          group_jid: r.group_jid,
          campaign_name: r.campaign_id ? names.get(r.campaign_id) ?? null : null,
          status: r.status,
          sent_at: r.sent_at ?? r.created_at,
          error_message: r.error_message ?? null,
          node_type: r.node_type ?? null,
        })),
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">Carregando histórico...</div>;
  if (error) return <div className="text-sm text-destructive">Erro ao carregar histórico: {error}</div>;
  if (rows.length === 0) return <div className="text-sm text-muted-foreground">Nenhum disparo registrado ainda.</div>;

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {rows.map((r) => {
            const ok = r.status === 'sent';
            const pending = r.status === 'pending' || r.status === 'queued' || r.status === 'processing';
            return (
              <li key={r.id} className="p-3 flex items-start gap-3 text-sm">
                <Badge
                  variant={ok ? 'default' : pending ? 'secondary' : 'destructive'}
                  className="text-xs shrink-0"
                >
                  {r.status ?? '—'}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground truncate">{r.campaign_name ?? '—'}</span>
                    <span>·</span>
                    <span className="truncate">{r.group_jid}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {r.error_message
                      ? r.error_message
                      : `Mensagem ${r.node_type ?? 'msg'} para o grupo`}
                  </p>
                </div>
                {r.sent_at && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(r.sent_at), { addSuffix: true, locale: ptBR })}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}