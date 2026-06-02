import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plus, CheckCircle2, Clock, AlertTriangle, History } from 'lucide-react';
import { useSocialMetrics } from '@/hooks/social/useSocialMetrics';
import { useUpcomingPosts } from '@/hooks/social/useUpcomingPosts';
import { useZernioSync } from '@/hooks/social/useZernioSync';
import { MetricCard } from './MetricCard';
import { normalizePlatform, SOCIAL_CHANNELS } from '@/lib/socialChannels';
import { cn } from '@/lib/utils';

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function fmtSchedule(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const statusBadgeClass: Record<string, string> = {
  scheduled: 'bg-primary/10 text-primary border-primary/20',
  publishing: 'bg-warning/10 text-warning border-warning/20',
  published: 'bg-success/10 text-success border-success/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
  draft: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

export function SocialDashboard() {
  const navigate = useNavigate();
  const { data: m } = useSocialMetrics();
  const { data: upcoming = [], isLoading } = useUpcomingPosts();
  const { sync, syncing } = useZernioSync();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Social Publisher</h1>
          <p className="text-sm text-muted-foreground">Visão geral das publicações nas redes sociais</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={sync} disabled={syncing}>
            <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
            {syncing ? 'Sincronizando…' : 'Sincronizar'}
          </Button>
          <Button onClick={() => navigate('/social/novo')}>
            <Plus className="w-4 h-4" /> Criar Post
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Publicados este mês" value={m?.published ?? 0} icon={CheckCircle2} tone="success" />
        <MetricCard label="Agendados (7 dias)" value={m?.scheduled ?? 0} icon={Clock} tone="default" />
        <MetricCard label="Falhos" value={m?.failed ?? 0} icon={AlertTriangle} tone="destructive" />
        <MetricCard label="Último sincronizado" value={relTime(m?.lastSync ?? null)} icon={History} tone="muted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos posts (7 dias)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : upcoming.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhum post agendado para os próximos 7 dias.</div>
          ) : (
            <div className="divide-y divide-border">
              {upcoming.map((p: any) => {
                const channels = Array.isArray(p.channels) ? p.channels : [];
                const media = Array.isArray(p.media_items) ? p.media_items : [];
                const thumb = media[0]?.url || media[0]?.thumbnail_url;
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors">
                    <div className="w-12 h-12 rounded bg-muted overflow-hidden shrink-0">
                      {thumb ? <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0">
                      {channels.slice(0, 3).map((c: any, i: number) => {
                        const plat = normalizePlatform(c.platform);
                        const meta = plat ? SOCIAL_CHANNELS[plat] : null;
                        return meta ? (
                          <span key={i} className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white', meta.colorClass)}>
                            {meta.emoji}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{p.caption || <span className="italic text-muted-foreground">Sem legenda</span>}</p>
                      {p.product_name && <p className="text-xs text-muted-foreground truncate">{p.product_name}</p>}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 hidden sm:block">{fmtSchedule(p.scheduled_at)}</div>
                    <Badge variant="outline" className={cn('shrink-0', statusBadgeClass[p.status ?? 'draft'])}>{p.status}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}