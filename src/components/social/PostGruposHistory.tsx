import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type LogRow = {
  id: string;
  group_jid: string | null;
  instance_name: string | null;
  message_preview: string | null;
  status: string | null;
  sent_at: string | null;
  dispatch_source: string | null;
};

export function PostGruposHistory() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('wa_group_dispatch_log')
        .select('id, group_jid, instance_name, message_preview, status, sent_at, dispatch_source')
        .order('sent_at', { ascending: false })
        .limit(50);
      setRows((data as LogRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">Carregando histórico...</div>;
  if (rows.length === 0) return <div className="text-sm text-muted-foreground">Nenhum disparo registrado ainda.</div>;

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {rows.map((r) => {
            const ok = r.status === 'sent' || r.status === 'success';
            return (
              <li key={r.id} className="p-3 flex items-start gap-3 text-sm">
                <Badge variant={ok ? 'default' : 'destructive'} className="text-xs shrink-0">
                  {r.status ?? '—'}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{r.instance_name ?? '—'}</span>
                    <span>·</span>
                    <span className="truncate">{r.group_jid ?? '—'}</span>
                    {r.dispatch_source && (
                      <>
                        <span>·</span>
                        <span>{r.dispatch_source}</span>
                      </>
                    )}
                  </div>
                  {r.message_preview && (
                    <p className="mt-1 line-clamp-2 text-muted-foreground">{r.message_preview}</p>
                  )}
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