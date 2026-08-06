import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Heart, Eye, MousePointerClick, Users, TrendingUp, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { KpiStrip, EmptyChart } from './KpiStrip';
import { MetricHeatmap, emptyGrid } from './MetricHeatmap';
import {
  useBestTime, useContentDecay, useDailyMetrics, useFollowerStats, usePostAnalytics, usePostingFrequency,
  type ZernioAnalyticsFilters,
} from '@/hooks/social/useZernioAnalytics';

const METRICS = [
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comentários' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Salvos' },
  { key: 'views', label: 'Views' },
  { key: 'impressions', label: 'Impressões' },
  { key: 'reach', label: 'Alcance' },
  { key: 'clicks', label: 'Cliques' },
] as const;

const tooltipStyle = { background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8 };

function num(v: unknown) { return typeof v === 'number' && isFinite(v) ? v : 0; }

export function PostingTab({ filters }: { filters: ZernioAnalyticsFilters }) {
  const [metric, setMetric] = useState<string>('likes');
  const posts = usePostAnalytics(filters);
  const daily = useDailyMetrics(filters);
  const best = useBestTime(filters);
  const freq = usePostingFrequency(filters);
  const decay = useContentDecay(filters);
  const followers = useFollowerStats(filters);

  const rows = useMemo(() => {
    return (posts.data?.posts ?? []).map((p) => {
      const a = p.analytics ?? {};
      const platform = p.platformAnalytics?.[0]?.platform ?? '—';
      const engagement = num(a.likes) + num(a.comments) + num(a.shares) + num(a.saves);
      return {
        id: p.postId,
        platform,
        content: p.content ?? '',
        thumb: p.thumbnailUrl ?? null,
        url: p.platformAnalytics?.[0]?.platformPostUrl ?? null,
        date: p.publishedAt ?? p.scheduledFor ?? null,
        engagement,
        ...Object.fromEntries(METRICS.map((m) => [m.key, num((a as any)[m.key])])),
        engagementRate: num(a.engagementRate),
      } as Record<string, any>;
    });
  }, [posts.data]);

  const overview = posts.data?.overview ?? {};
  const totalFollowers = useMemo(() => {
    const fromStats: any[] = (followers.data as any)?.accounts ?? [];
    if (fromStats.length) return fromStats.reduce((s, a) => s + num(a.currentFollowers), 0);
    return (posts.data?.accounts ?? []).reduce((s, a: any) => s + num(a.followersCount ?? a.followerCount), 0);
  }, [followers.data, posts.data]);

  const series = useMemo(
    () => (daily.data?.dailyData ?? []).map((d) => ({
      date: d.date.slice(5),
      value: num((d.metrics as any)?.[metric]),
      posts: num(d.postCount),
    })),
    [daily.data, metric],
  );

  const platformBars = useMemo(
    () => (daily.data?.platformBreakdown ?? []).map((p: any) => ({
      platform: p.platform,
      posts: num(p.postCount),
      likes: num(p.likes),
      alcance: num(p.reach),
      engajamento: num(p.likes) + num(p.comments) + num(p.shares) + num(p.saves),
    })),
    [daily.data],
  );

  const bestGrid = useMemo(() => {
    const g = emptyGrid();
    (best.data?.slots ?? []).forEach((s) => {
      if (s.day_of_week >= 0 && s.day_of_week < 7 && s.hour >= 0 && s.hour < 24) g[s.day_of_week][s.hour] = s.avg_engagement;
    });
    return g;
  }, [best.data]);

  const freqRows = useMemo(() => {
    const f: any = freq.data ?? {};
    const raw: any[] = f.frequency ?? f.data ?? f.rows ?? f.frequencies ?? [];
    return raw.map((r) => ({
      platform: r.platform ?? '—',
      postsPorSemana: num(r.posts_per_week ?? r.postsPerWeek),
      engajamento: num(r.avg_engagement_rate ?? r.avgEngagementRate ?? r.engagement_rate),
      semanas: num(r.weeks_count ?? r.week_count ?? r.weeks),
    }));
  }, [freq.data]);

  const decayRows = useMemo(
    () => (decay.data?.buckets ?? [])
      .slice()
      .sort((a, b) => a.bucket_order - b.bucket_order)
      .map((b) => ({ label: b.bucket_label, pct: num(b.avg_pct_of_final), posts: num(b.post_count) })),
    [decay.data],
  );

  const followerSeries = useMemo(() => {
    const byDate = new Map<string, number>();
    const statsMap: Record<string, any[]> = (followers.data as any)?.stats ?? {};
    Object.values(statsMap).forEach((hist) => {
      (hist ?? []).forEach((h: any) => {
        const d = String(h.date ?? h.day ?? '').slice(0, 10);
        if (!d) return;
        byDate.set(d, (byDate.get(d) ?? 0) + num(h.followers ?? h.followerCount ?? h.count));
      });
    });
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, seguidores]) => ({ date: date.slice(5), seguidores }));
  }, [followers.data]);

  const followerGrowth = followerSeries.length > 1
    ? followerSeries[followerSeries.length - 1].seguidores - followerSeries[0].seguidores
    : 0;

  const handleExport = () => {
    const cols = ['platform', 'date', 'content', ...METRICS.map((m) => m.key), 'engagement', 'engagementRate', 'url'];
    const csv = [cols, ...rows.map((r) => cols.map((c) => r[c]))]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `social-posting-${filters.days}d.csv`;
    a.click();
  };

  const err = posts.error ?? daily.error;

  return (
    <div className="space-y-4">
      {err ? (
        <Alert variant="destructive"><AlertDescription>{String((err as Error).message)}</AlertDescription></Alert>
      ) : null}

      <KpiStrip
        loading={posts.isLoading}
        kpis={[
          { label: 'Taxa de engajamento', value: `${num(overview.engagementRate ?? overview.avgEngagementRate).toFixed(1)}%`, icon: <TrendingUp className="w-3.5 h-3.5" /> },
          { label: 'Alcance', value: num(overview.reach ?? rows.reduce((s, r) => s + r.reach, 0)), icon: <Eye className="w-3.5 h-3.5" /> },
          { label: 'Impressões', value: num(overview.impressions ?? rows.reduce((s, r) => s + r.impressions, 0)), icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { label: 'Engajamento', value: rows.reduce((s, r) => s + r.engagement, 0), icon: <Heart className="w-3.5 h-3.5" /> },
          { label: 'Cliques', value: num(overview.clicks ?? rows.reduce((s, r) => s + r.clicks, 0)), icon: <MousePointerClick className="w-3.5 h-3.5" /> },
          { label: 'Seguidores', value: totalFollowers, hint: followerGrowth ? `${followerGrowth > 0 ? '+' : ''}${followerGrowth.toLocaleString('pt-BR')} no período` : undefined, icon: <Users className="w-3.5 h-3.5" /> },
        ]}
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Métrica ao longo do tempo</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!rows.length}>
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-72">
          {daily.isLoading ? <Skeleton className="h-full w-full" /> : series.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="value" name={METRICS.find((m) => m.key === metric)?.label} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Posts e engajamento por plataforma</CardTitle></CardHeader>
          <CardContent className="h-72">
            {platformBars.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="platform" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="posts" name="Posts" fill="hsl(var(--muted-foreground))" />
                  <Bar dataKey="engajamento" name="Engajamento" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Likes por plataforma</CardTitle></CardHeader>
          <CardContent className="h-72">
            {platformBars.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformBars} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis type="category" dataKey="platform" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="likes" name="Likes" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Melhor horário para postar (engajamento médio, UTC)</CardTitle></CardHeader>
        <CardContent>
          {best.error ? <p className="text-sm text-muted-foreground">{String((best.error as Error).message)}</p> : <MetricHeatmap cells={bestGrid} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Evolução de seguidores</CardTitle></CardHeader>
        <CardContent className="h-64">
          {followers.error ? <EmptyChart label={String((followers.error as Error).message)} /> : followerSeries.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={followerSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={['auto', 'auto']} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="seguidores" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Frequência × engajamento</CardTitle></CardHeader>
          <CardContent className="h-72">
            {freqRows.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="postsPorSemana" name="Posts/semana" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis dataKey="engajamento" name="Engajamento %" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <ZAxis dataKey="semanas" range={[50, 300]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Scatter data={freqRows} fill="hsl(var(--primary))" />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Acumulação de engajamento após publicar</CardTitle></CardHeader>
          <CardContent className="h-72">
            {decayRows.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={decayRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis unit="%" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="pct" name="% do total" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top posts</CardTitle></CardHeader>
        <CardContent>
          {posts.isLoading ? <Skeleton className="h-40 w-full" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem posts no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="p-2" />
                    <th className="p-2">Post</th>
                    <th className="p-2">Plataforma</th>
                    <th className="p-2">Data</th>
                    <th className="p-2 text-right">Eng.</th>
                    {METRICS.map((m) => <th key={m.key} className="p-2 text-right">{m.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 25).map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2 w-12">
                        {r.thumb ? <img src={r.thumb} alt="" className="w-10 h-10 rounded object-cover" loading="lazy" /> : <div className="w-10 h-10 bg-muted rounded" />}
                      </td>
                      <td className="p-2 max-w-[240px]">
                        <span className="line-clamp-2 text-muted-foreground">{r.content || '—'}</span>
                      </td>
                      <td className="p-2"><Badge variant="outline" className="capitalize">{r.platform}</Badge></td>
                      <td className="p-2 text-muted-foreground">{r.date ? new Date(r.date).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="p-2 text-right font-medium tabular-nums">{r.engagement.toLocaleString('pt-BR')}</td>
                      {METRICS.map((m) => (
                        <td key={m.key} className="p-2 text-right tabular-nums">{Number(r[m.key] ?? 0).toLocaleString('pt-BR')}</td>
                      ))}
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