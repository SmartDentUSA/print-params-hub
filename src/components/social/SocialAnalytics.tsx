import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, Heart, MessageCircle, Eye, Share2, BarChart3, Download } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from 'recharts';
import { useSocialAnalytics, useResyncMetrics, type AnalyticsFilters } from '@/hooks/social/useSocialAnalytics';

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit', 'linkedin', 'threads', 'twitter'];

export function SocialAnalytics() {
  const [filters, setFilters] = useState<AnalyticsFilters>({ days: 30 });
  const { data: posts, isLoading, refetch } = useSocialAnalytics(filters);
  const resync = useResyncMetrics();
  const [syncing, setSyncing] = useState(false);

  const stats = useMemo(() => {
    const p = posts ?? [];
    const totals = p.reduce(
      (a, x) => ({
        reach: a.reach + (x.reach ?? 0),
        impressions: a.impressions + (x.impressions ?? 0),
        engagement: a.engagement + (x.likes ?? 0) + (x.comments ?? 0) + (x.shares ?? 0) + (x.saves ?? 0),
        views: a.views + (x.views ?? 0),
      }),
      { reach: 0, impressions: 0, engagement: 0, views: 0 },
    );
    const byPlatform = p.reduce<Record<string, { posts: number; engagement: number; reach: number }>>((a, x) => {
      const k = x.platform ?? 'desconhecido';
      a[k] ??= { posts: 0, engagement: 0, reach: 0 };
      a[k].posts++;
      a[k].engagement += (x.likes ?? 0) + (x.comments ?? 0) + (x.shares ?? 0) + (x.saves ?? 0);
      a[k].reach += x.reach ?? 0;
      return a;
    }, {});
    const platformData = Object.entries(byPlatform).map(([platform, v]) => ({ platform, ...v }));

    // Série diária (engagement por dia)
    const byDay = new Map<string, number>();
    p.forEach((x) => {
      if (!x.published_at) return;
      const d = new Date(x.published_at).toISOString().slice(0, 10);
      const eng = (x.likes ?? 0) + (x.comments ?? 0) + (x.shares ?? 0) + (x.saves ?? 0);
      byDay.set(d, (byDay.get(d) ?? 0) + eng);
    });
    const series = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, engagement]) => ({ date: date.slice(5), engagement }));

    // Heatmap dia da semana × hora
    const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    p.forEach((x) => {
      if (!x.published_at) return;
      const d = new Date(x.published_at);
      const eng = (x.likes ?? 0) + (x.comments ?? 0) + (x.shares ?? 0) + (x.saves ?? 0);
      heat[d.getDay()][d.getHours()] += eng;
    });

    // Top posts (mais engajamento)
    const topPosts = [...p]
      .map((x) => ({ ...x, engagement: (x.likes ?? 0) + (x.comments ?? 0) + (x.shares ?? 0) + (x.saves ?? 0) }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10);

    return { totals, platformData, series, heat, topPosts, count: p.length };
  }, [posts]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r: any = await resync();
      toast.success(`Sync ok: ${r?.updated ?? 0} atualizados`);
      refetch();
    } catch (e: any) {
      toast.error(`Falha: ${e.message ?? e}`);
    } finally { setSyncing(false); }
  };

  const handleExport = () => {
    const rows = [
      ['platform', 'published_at', 'likes', 'comments', 'shares', 'saves', 'reach', 'impressions', 'views', 'post_url'],
      ...(posts ?? []).map((p) => [
        p.platform, p.published_at, p.likes, p.comments, p.shares, p.saves, p.reach, p.impressions, p.views, p.post_url ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `social-analytics-${filters.days}d.csv`;
    a.click();
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Analytics Social</h1>
          <p className="text-sm text-muted-foreground">Métricas Zernio dos posts publicados</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(filters.days)} onValueChange={(v) => setFilters({ ...filters, days: Number(v) as any })}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.platform ?? 'all'} onValueChange={(v) => setFilters({ ...filters, platform: v === 'all' ? undefined : v })}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Plataforma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} /> Sync
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!posts?.length}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Eye className="w-4 h-4" />} label="Alcance total" value={stats.totals.reach} />
          <StatCard icon={<Heart className="w-4 h-4" />} label="Engajamento" value={stats.totals.engagement} />
          <StatCard icon={<MessageCircle className="w-4 h-4" />} label="Impressões" value={stats.totals.impressions} />
          <StatCard icon={<Share2 className="w-4 h-4" />} label="Views" value={stats.totals.views} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Engajamento ao longo do tempo</CardTitle></CardHeader>
          <CardContent className="h-64">
            {stats.series.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                  <Line type="monotone" dataKey="engagement" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Por plataforma</CardTitle></CardHeader>
          <CardContent className="h-64">
            {stats.platformData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.platformData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="platform" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="posts" fill="hsl(var(--muted-foreground))" />
                  <Bar dataKey="engagement" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Melhor horário (dia × hora)</CardTitle></CardHeader>
        <CardContent>
          <Heatmap data={stats.heat} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 posts</CardTitle></CardHeader>
        <CardContent>
          {stats.topPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem posts no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="p-2"></th>
                    <th className="p-2">Plataforma</th>
                    <th className="p-2">Publicado</th>
                    <th className="p-2 text-right">Eng.</th>
                    <th className="p-2 text-right">Alcance</th>
                    <th className="p-2 text-right">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topPosts.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-2 w-12">
                        {p.thumbnail_url || p.media_url ? (
                          <img src={p.thumbnail_url ?? p.media_url ?? ''} className="w-10 h-10 object-cover rounded" alt="" />
                        ) : <div className="w-10 h-10 bg-muted rounded" />}
                      </td>
                      <td className="p-2"><Badge variant="outline" className="capitalize">{p.platform}</Badge></td>
                      <td className="p-2 text-muted-foreground">{p.published_at ? new Date(p.published_at).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="p-2 text-right font-medium">{p.engagement.toLocaleString('pt-BR')}</td>
                      <td className="p-2 text-right">{(p.reach ?? 0).toLocaleString('pt-BR')}</td>
                      <td className="p-2 text-right">{(p.views ?? 0).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon} {label}</div>
        <div className="text-2xl font-bold mt-1">{value.toLocaleString('pt-BR')}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Sem dados no período</div>;
}

function Heatmap({ data }: { data: number[][] }) {
  const max = Math.max(1, ...data.flat());
  const days = ['D','S','T','Q','Q','S','S'];
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `auto repeat(24, minmax(14px, 1fr))` }}>
        <div></div>
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} className="text-[9px] text-muted-foreground text-center">{h}</div>
        ))}
        {data.map((row, di) => (
          <>
            <div key={`d-${di}`} className="text-[10px] text-muted-foreground pr-1 flex items-center">{days[di]}</div>
            {row.map((v, hi) => {
              const opacity = v === 0 ? 0.06 : 0.15 + 0.85 * (v / max);
              return (
                <div
                  key={`c-${di}-${hi}`}
                  className="aspect-square rounded-sm"
                  style={{ backgroundColor: `hsl(var(--primary) / ${opacity})` }}
                  title={`${days[di]} ${hi}h: ${v}`}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}