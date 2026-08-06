import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { useResyncMetrics } from '@/hooks/social/useSocialAnalytics';
import { useZernioAccounts } from '@/hooks/social/useZernioAccounts';
import { PostingTab } from './analytics/PostingTab';
import { InboxTab } from './analytics/InboxTab';
import { InternalChannelsTab } from './analytics/InternalChannelsTab';

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit', 'linkedin', 'threads', 'twitter'];

export function SocialAnalytics() {
  const [days, setDays] = useState(30);
  const [platform, setPlatform] = useState('all');
  const [accountId, setAccountId] = useState('all');
  const [source, setSource] = useState('all');
  const { data: accounts } = useZernioAccounts();
  const resync = useResyncMetrics();
  const [syncing, setSyncing] = useState(false);

  const filters = {
    days,
    platform: platform === 'all' ? undefined : platform,
    accountId: accountId === 'all' ? undefined : accountId,
    source: source === 'all' ? undefined : source,
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r: any = await resync();
      toast.success(`Sync ok: ${r?.updated ?? 0} atualizados`);
    } catch (e: any) {
      toast.error(`Falha: ${e.message ?? e}`);
    } finally { setSyncing(false); }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Analytics Social</h1>
          <p className="text-sm text-muted-foreground">Publicações, inbox e canais internos (WhatsApp e Dra. LIA)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
              <SelectItem value="180">180 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Plataforma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as redes</SelectItem>
              {PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {(accounts ?? []).map((a) => (
                <SelectItem key={a.zernio_account_id} value={a.zernio_account_id}>
                  {a.display_name || a.handle || a.platform}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              <SelectItem value="late">Via Zernio</SelectItem>
              <SelectItem value="external">Externos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} /> Sync
          </Button>
        </div>
      </header>

      <Tabs defaultValue="posting">
        <TabsList>
          <TabsTrigger value="posting">Publicações</TabsTrigger>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="internal">Canais internos</TabsTrigger>
        </TabsList>
        <TabsContent value="posting" className="mt-4">
          <PostingTab filters={filters} />
        </TabsContent>
        <TabsContent value="inbox" className="mt-4">
          <InboxTab filters={filters} />
        </TabsContent>
        <TabsContent value="internal" className="mt-4">
          <InternalChannelsTab days={days} />
        </TabsContent>
      </Tabs>
    </div>
  );
}