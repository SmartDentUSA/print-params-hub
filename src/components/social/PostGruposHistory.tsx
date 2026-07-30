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
  last_sent_at: string | null;
  send_count: number | null;
};

export function PostGruposHistory() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('wa_group_sent_fingerprints')
        .select('id, group_jid, last_sent_at, send_count, last_campaign_id, wa_campaigns:last_campaign_id(name, status)')
        .not('last_campaign_id', 'is', null)
        .order('last_sent_at', { ascending: false })
        .limit(50);
      const mapped: LogRow[] = ((data as any[]) ?? []).map((r) => ({
        id: r.id,
        group_jid: r.group_jid,
        campaign_name: r.wa_campaigns?.name ?? null,
        status: r.wa_campaigns?.status ?? null,
        last_sent_at: r.last_sent_at,
        send_count: r.send_count,
      }));
      setRows(mapped);
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
            const ok = r.status === 'completed' || r.status === 'active';
            return (
              <li key={r.id} className="p-3 flex items-start gap-3 text-sm">
                <Badge variant={ok ? 'default' : 'destructive'} className="text-xs shrink-0">
                  {r.status ?? '—'}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground truncate">{r.campaign_name ?? '—'}</span>
                    <span>·</span>
                    <span className="truncate">{r.group_jid}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {r.send_count ?? 1} envio(s) registrados para este grupo
                  </p>
                </div>
                {r.last_sent_at && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(r.last_sent_at), { addSuffix: true, locale: ptBR })}
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