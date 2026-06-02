import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Search, RefreshCw, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PLATFORMS = ['all', 'instagram', 'facebook', 'whatsapp', 'tiktok'] as const;
type PlatformFilter = typeof PLATFORMS[number];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30',
  facebook: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  whatsapp: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
  tiktok: 'bg-foreground/10 text-foreground border-foreground/20',
};

export function SocialContacts() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [syncing, setSyncing] = useState(false);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['social-contacts', q, platform],
    queryFn: async () => {
      let query = supabase.from('social_contacts').select('*').order('last_seen_at', { ascending: false, nullsFirst: false }).limit(200);
      if (platform !== 'all') query = query.eq('channel', platform);
      if (q) query = query.or(`ig_username.ilike.%${q}%,ig_user_id.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const sync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('zernio-contacts-sync', { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const synced = (data as any)?.synced ?? 0;
      toast.success(`Sincronizados ${synced} contatos do Zernio`);
      qc.invalidateQueries({ queryKey: ['social-contacts'] });
    } catch (e: any) {
      toast.error(`Falha ao sincronizar: ${e.message ?? e}`);
    } finally { setSyncing(false); }
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt).then(() => toast.success('Copiado'));
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6" /> Contacts</h1>
          <p className="text-sm text-muted-foreground">Manage contacts across all platforms (Zernio)</p>
        </div>
        <Button onClick={sync} disabled={syncing} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando…' : 'Sincronizar Zernio'}
        </Button>
      </header>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative max-w-sm flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" placeholder="Buscar por @, nome ou ID" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {PLATFORMS.map((p) => (
            <Button key={p} size="sm" variant={platform === p ? 'default' : 'outline'} className="capitalize h-8" onClick={() => setPlatform(p)}>
              {p === 'all' ? 'Todas' : p}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? <Skeleton className="h-64" /> : contacts?.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum contato. Clique em <span className="font-medium">Sincronizar Zernio</span> para puxar os contatos das contas conectadas.
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3">Contato</th>
                <th className="p-3">Plataforma</th>
                <th className="p-3">ManyChat ID</th>
                <th className="p-3">Tags</th>
                <th className="p-3">Inscrito</th>
                <th className="p-3">Visto</th>
              </tr>
            </thead>
            <tbody>
              {contacts!.map((c: any) => {
                const mcId = c.custom_fields?.manychat_id ?? null;
                const channel = c.channel ?? 'instagram';
                return (
                  <tr key={c.ig_user_id} className="border-t border-border">
                    <td className="p-3">
                      <div className="font-medium">{c.ig_username ?? '—'}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate max-w-[220px]">{c.ig_user_id}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={`capitalize ${PLATFORM_COLORS[channel] ?? ''}`}>{channel}</Badge>
                    </td>
                    <td className="p-3">
                      {mcId ? (
                        <button onClick={() => copy(mcId)} className="inline-flex items-center gap-1 text-xs font-mono hover:text-primary">
                          <Copy className="w-3 h-3" /> {mcId}
                        </button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">{(c.tags ?? []).slice(0, 3).map((t: string) => <Badge key={t} variant="secondary" className="mr-1">{t}</Badge>)}</td>
                    <td className="p-3">{c.subscribed ? '✓' : '✕'}</td>
                    <td className="p-3 text-xs text-muted-foreground">{c.last_seen_at ? new Date(c.last_seen_at).toLocaleString('pt-BR') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}