import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Inbox, Send, MessageSquare, CheckCheck, AlertTriangle, Timer } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';
import { KpiStrip, EmptyChart } from './KpiStrip';
import { MetricHeatmap, emptyGrid } from './MetricHeatmap';
import {
  useInboxHeatmap, useInboxResponseTime, useInboxSourceBreakdown, useInboxTopAccounts, useInboxVolume,
  type ZernioAnalyticsFilters,
} from '@/hooks/social/useZernioAnalytics';

const tooltipStyle = { background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8 };

function fmtSeconds(s?: number) {
  if (!s || s < 0) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

export function InboxTab({ filters }: { filters: ZernioAnalyticsFilters }) {
  const volume = useInboxVolume(filters);
  const heatmap = useInboxHeatmap(filters);
  const ttr = useInboxResponseTime(filters);
  const sources = useInboxSourceBreakdown(filters);
  const top = useInboxTopAccounts(filters);

  const summary = volume.data?.summary;
  const series = (volume.data?.timeseries ?? []).map((t) => ({
    date: String(t.date).slice(5),
    recebidas: t.received,
    enviadas: t.sent,
  }));
  const byPlatform = (volume.data?.byPlatform ?? []).map((p) => ({
    platform: p.platform,
    recebidas: p.received,
    enviadas: p.sent,
  }));

  const grid = useMemo(() => {
    const g = emptyGrid();
    (heatmap.data?.buckets ?? []).forEach((b) => {
      const d = b.dow - 1; // 1=segunda
      if (d >= 0 && d < 7 && b.hour >= 0 && b.hour < 24) g[d][b.hour] += b.received + b.sent;
    });
    return g;
  }, [heatmap.data]);

  const sourceRows = useMemo(() => {
    const raw: any[] = (sources.data as any)?.sources ?? (sources.data as any)?.breakdown ?? [];
    return raw.map((s) => ({ source: s.source ?? '—', enviadas: s.sent ?? 0, recebidas: s.received ?? 0 }));
  }, [sources.data]);

  const replyRate = summary && summary.received > 0 && ttr.data?.summary
    ? `${Math.min(100, (ttr.data.summary.sampleSize / summary.received) * 100).toFixed(0)}%`
    : '—';

  return (
    <div className="space-y-4">
      {volume.error ? (
        <Alert variant="destructive"><AlertDescription>{String((volume.error as Error).message)}</AlertDescription></Alert>
      ) : null}

      <KpiStrip
        loading={volume.isLoading}
        kpis={[
          { label: 'Recebidas', value: summary?.received ?? 0, icon: <Inbox className="w-3.5 h-3.5" /> },
          { label: 'Enviadas', value: summary?.sent ?? 0, icon: <Send className="w-3.5 h-3.5" /> },
          { label: 'Conversas', value: summary?.uniqueConversations ?? 0, icon: <MessageSquare className="w-3.5 h-3.5" /> },
          { label: 'Lidas', value: summary?.read ?? 0, icon: <CheckCheck className="w-3.5 h-3.5" /> },
          { label: 'Falhas', value: summary?.failed ?? 0, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
          { label: 'Taxa de resposta', value: replyRate, hint: `mediana ${fmtSeconds(ttr.data?.summary?.medianSeconds)}`, icon: <Timer className="w-3.5 h-3.5" /> },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Mensagens ao longo do tempo</CardTitle></CardHeader>
          <CardContent className="h-72">
            {volume.isLoading ? <Skeleton className="h-full w-full" /> : series.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="recebidas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="enviadas" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Por plataforma</CardTitle></CardHeader>
          <CardContent className="h-72">
            {byPlatform.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byPlatform}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="platform" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="recebidas" fill="hsl(var(--primary))" />
                  <Bar dataKey="enviadas" fill="hsl(var(--muted-foreground))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tempo até a primeira resposta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ['Mediana', ttr.data?.summary?.medianSeconds],
                ['Média', ttr.data?.summary?.meanSeconds],
                ['P90', ttr.data?.summary?.p90Seconds],
                ['P99', ttr.data?.summary?.p99Seconds],
              ].map(([label, v]) => (
                <div key={String(label)} className="rounded-md border border-border p-2">
                  <div className="text-[11px] text-muted-foreground">{label as string}</div>
                  <div className="font-semibold">{fmtSeconds(v as number)}</div>
                </div>
              ))}
            </div>
            <div className="h-52">
              {(ttr.data?.histogram ?? []).length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ttr.data!.histogram}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Respostas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Origem das mensagens</CardTitle></CardHeader>
          <CardContent className="h-72">
            {sourceRows.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceRows} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis type="category" dataKey="source" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="enviadas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="recebidas" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Quando as mensagens chegam (dia × hora)</CardTitle></CardHeader>
        <CardContent>
          {heatmap.error ? <p className="text-sm text-muted-foreground">{String((heatmap.error as Error).message)}</p> : <MetricHeatmap cells={grid} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Contas com mais volume</CardTitle></CardHeader>
        <CardContent>
          {(top.data?.accounts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem dados no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="p-2">Conta</th>
                    <th className="p-2">Plataforma</th>
                    <th className="p-2 text-right">Recebidas</th>
                    <th className="p-2 text-right">Enviadas</th>
                    <th className="p-2 text-right">Conversas</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {top.data!.accounts!.map((a) => (
                    <tr key={`${a.accountId}-${a.platform}`} className="border-t border-border">
                      <td className="p-2">
                        <div className="font-medium">{a.displayName || a.username || a.accountId}</div>
                        {a.username ? <div className="text-xs text-muted-foreground">@{a.username}</div> : null}
                      </td>
                      <td className="p-2"><Badge variant="outline" className="capitalize">{a.platform}</Badge></td>
                      <td className="p-2 text-right tabular-nums">{a.received.toLocaleString('pt-BR')}</td>
                      <td className="p-2 text-right tabular-nums">{a.sent.toLocaleString('pt-BR')}</td>
                      <td className="p-2 text-right tabular-nums">{(a.conversations ?? 0).toLocaleString('pt-BR')}</td>
                      <td className="p-2 text-right font-medium tabular-nums">{a.total.toLocaleString('pt-BR')}</td>
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