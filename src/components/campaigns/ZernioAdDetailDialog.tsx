import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAdDailyInsights, type ZernioAd } from '@/hooks/social/useZernioAds';
import { fmtInt, fmtMoney, fmtPct } from './ZernioAdsTab';

interface Props {
  ad: ZernioAd | null;
  days: number;
  onClose: () => void;
}

export function AdDetailDialog({ ad, days, onClose }: Props) {
  const { data, isLoading } = useAdDailyInsights(
    ad?.accountId ?? null,
    ad?.platformAdId ?? null,
    'ad',
    days,
  );

  const series = (data?.data ?? [])
    .map((d) => ({
      date: new Date(d.date_start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      spend: Number(d.spend ?? 0),
      impressions: Number(d.impressions ?? 0),
      clicks: Number(d.clicks ?? 0),
      ctr: Number(d.ctr ?? 0),
    }))
    .reverse();

  const m = ad?.metrics;
  const cards = [
    { label: 'Investimento', value: fmtMoney(m?.spend, ad?.currency) },
    { label: 'Alcance', value: fmtInt(m?.reach) },
    { label: 'Impressões', value: fmtInt(m?.impressions) },
    { label: 'Cliques', value: fmtInt(m?.clicks) },
    { label: 'CTR', value: fmtPct(m?.ctr) },
    { label: 'CPC', value: fmtMoney(m?.cpc, ad?.currency) },
    { label: 'CPM', value: fmtMoney(m?.cpm, ad?.currency) },
    { label: 'Engajamento', value: fmtInt(m?.engagement) },
    { label: 'Leads', value: fmtInt(m?.actions?.lead ?? m?.conversions) },
    { label: 'Custo por lead', value: fmtMoney(m?.costPerConversion, ad?.currency) },
  ];

  return (
    <Dialog open={!!ad} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8 text-base">{ad?.name}</DialogTitle>
        </DialogHeader>

        {ad && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{ad.platform}</Badge>
              <Badge variant={ad.status === 'active' ? 'default' : 'secondary'}>{ad.status}</Badge>
              {ad.campaignName && <span>Campanha: {ad.campaignName}</span>}
              {ad.adSetName && <span>· Conjunto: {ad.adSetName}</span>}
              {ad.creative?.instagramPermalinkUrl && (
                <a
                  href={ad.creative.instagramPermalinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Ver publicação <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="space-y-2">
                {ad.creative?.videoUrl ? (
                  <video src={ad.creative.videoUrl} controls className="w-full rounded-lg border" />
                ) : ad.creative?.imageUrl || ad.creative?.thumbnailUrl ? (
                  <img
                    src={ad.creative.imageUrl ?? ad.creative.thumbnailUrl ?? ''}
                    alt={ad.name}
                    className="w-full rounded-lg border object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg border text-xs text-muted-foreground">
                    Sem criativo
                  </div>
                )}
                {ad.creative?.body && (
                  <p className="whitespace-pre-line text-xs text-muted-foreground">{ad.creative.body}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cards.map((c) => (
                  <div key={c.label} className="rounded-lg border p-3">
                    <p className="text-[11px] text-muted-foreground">{c.label}</p>
                    <p className="text-sm font-semibold">{c.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Desempenho diário</p>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : series.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados diários no período.</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                        <Area type="monotone" dataKey="spend" name="Investimento" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                        <Line type="monotone" dataKey="impressions" name="Impressões" stroke="hsl(var(--chart-2, var(--primary)))" dot={false} />
                        <Line type="monotone" dataKey="clicks" name="Cliques" stroke="hsl(var(--destructive))" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}