import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Megaphone, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AdDetailDialog } from './ZernioAdDetailDialog';
import {
  useZernioAdCampaigns,
  useZernioAds,
  useAdsPeriodInsights,
  type AdAccountRef,
  type ZernioAd,
  type ZernioAdCampaign,
} from '@/hooks/social/useZernioAds';

const PERIODS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
];

export function fmtMoney(v?: number | null, currency = 'BRL') {
  if (v === undefined || v === null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v);
}
export function fmtInt(v?: number | null) {
  if (v === undefined || v === null) return '—';
  return new Intl.NumberFormat('pt-BR').format(v);
}
export function fmtPct(v?: number | null) {
  if (v === undefined || v === null) return '—';
  return `${v.toFixed(2)}%`;
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase();
  const variant = s === 'active' ? 'default' : s === 'paused' ? 'secondary' : 'outline';
  return <Badge variant={variant as never}>{s || '—'}</Badge>;
}

function budgetLabel(ad: { budget?: { amount?: number; type?: string } | null; currency?: string }) {
  const b = ad.budget;
  if (!b?.amount) return '—';
  const suffix = b.type === 'daily' ? '/dia' : b.type === 'lifetime' ? '/total' : '';
  return `${fmtMoney(b.amount, ad.currency ?? 'BRL')}${suffix}`;
}

export default function ZernioAdsTab() {
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('active');
  const [days, setDays] = useState('30');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<ZernioAd | null>(null);

  const filters = {
    platform: platform === 'all' ? undefined : platform,
    status: status === 'all' ? undefined : status,
    days: Number(days),
  };
  const campaignsQ = useZernioAdCampaigns(filters);
  const adsQ = useZernioAds(filters);

  const campaigns: ZernioAdCampaign[] = campaignsQ.data?.campaigns ?? [];
  const ads: ZernioAd[] = adsQ.data?.ads ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return campaigns;
    return campaigns.filter((c) => (c.campaignName ?? '').toLowerCase().includes(term));
  }, [campaigns, search]);

  const adsByCampaign = useMemo(() => {
    const map = new Map<string, ZernioAd[]>();
    for (const a of ads) {
      const k = a.platformCampaignId ?? a.campaignName ?? '';
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return map;
  }, [ads]);

  const adAccounts = useMemo<AdAccountRef[]>(() => {
    const map = new Map<string, AdAccountRef>();
    for (const c of campaigns) {
      if (!c.platformAdAccountId) continue;
      map.set(`${c.accountId}:${c.platformAdAccountId}`, {
        accountId: c.accountId,
        platformAdAccountId: c.platformAdAccountId,
        platform: c.platform,
      });
    }
    return [...map.values()];
  }, [campaigns]);

  const periodQ = useAdsPeriodInsights(adAccounts, Number(days));
  const periodByCampaign = periodQ.data?.byCampaign;

  const totals = useMemo(() => {
    const acc = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    if (!periodByCampaign) return acc;
    const term = search.trim().toLowerCase();
    if (!term) {
      const t = periodQ.data!.totals;
      return { spend: t.spend, impressions: t.impressions, clicks: t.clicks, conversions: t.leads };
    }
    for (const c of filtered) {
      const m = periodByCampaign.get(c.platformCampaignId ?? '');
      if (!m) continue;
      acc.spend += m.spend;
      acc.impressions += m.impressions;
      acc.clicks += m.clicks;
      acc.conversions += m.leads;
    }
    return acc;
  }, [filtered, periodByCampaign, periodQ.data, search]);

  const loading = campaignsQ.isLoading || adsQ.isLoading || periodQ.isLoading;
  const err = (campaignsQ.error ?? adsQ.error) as Error | null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as plataformas</SelectItem>
            <SelectItem value="facebook">Facebook / Instagram</SelectItem>
            <SelectItem value="google">Google</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          className="w-[240px]"
          placeholder="Buscar campanha..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => { campaignsQ.refetch(); adsQ.refetch(); periodQ.refetch(); }}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {err && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-2 py-4 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>Não foi possível ler os anúncios na Zernio: {err.message}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Investimento', value: fmtMoney(totals.spend) },
          { label: 'Impressões', value: fmtInt(totals.impressions) },
          { label: 'Cliques', value: fmtInt(totals.clicks) },
          { label: 'Conversões', value: fmtInt(totals.conversions) },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Métricas do período selecionado ({PERIODS.find((p) => p.value === days)?.label.toLowerCase()})
        {periodQ.data ? `: ${periodQ.data.fromDate} a ${periodQ.data.toDate}` : ''}. Somente contas Meta
        possuem insights por período na Zernio.
      </p>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="w-4 h-4 text-primary" />
            Campanhas de anúncios ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma campanha para os filtros escolhidos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Conta</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Orçamento</th>
                    <th className="px-3 py-2 text-right">Investido</th>
                    <th className="px-3 py-2 text-right">Impressões</th>
                    <th className="px-3 py-2 text-right">Cliques</th>
                    <th className="px-3 py-2 text-right">CTR</th>
                    <th className="px-3 py-2 text-right">CPC</th>
                    <th className="px-3 py-2 text-right">Leads</th>
                    <th className="px-3 py-2 text-right">Custo/lead</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const key = c.platformCampaignId ?? c.campaignName;
                    const children = adsByCampaign.get(c.platformCampaignId ?? '') ?? [];
                    const isOpen = !!open[key];
                    const pm = periodByCampaign?.get(c.platformCampaignId ?? '');
                    const pLeads = pm?.leads;
                    const pCpl = pm && pLeads ? pm.spend / pLeads : undefined;
                    return (
                      <>
                        <tr key={key} className="border-b hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <button
                              className="flex items-center gap-1 text-left font-medium"
                              onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                            >
                              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              <span className="line-clamp-1">{c.campaignName}</span>
                              <Badge variant="outline" className="ml-2">{children.length || c.adCount || 0} anúncios</Badge>
                            </button>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{c.platformAdAccountName ?? '—'}</td>
                          <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                          <td className="px-3 py-2 text-right">{budgetLabel(c)}</td>
                          <td className="px-3 py-2 text-right font-medium">{fmtMoney(pm ? pm.spend : undefined, c.currency)}</td>
                          <td className="px-3 py-2 text-right">{fmtInt(pm?.impressions)}</td>
                          <td className="px-3 py-2 text-right">{fmtInt(pm?.clicks)}</td>
                          <td className="px-3 py-2 text-right">{fmtPct(pm?.ctr)}</td>
                          <td className="px-3 py-2 text-right">{fmtMoney(pm?.cpc, c.currency)}</td>
                          <td className="px-3 py-2 text-right">{fmtInt(pLeads)}</td>
                          <td className="px-3 py-2 text-right">{fmtMoney(pCpl, c.currency)}</td>
                        </tr>
                        {isOpen &&
                          children.map((a) => (
                            <tr key={a._id} className="border-b bg-muted/10 text-xs hover:bg-muted/30">
                              <td className="px-3 py-2 pl-10">
                                <button className="flex items-center gap-2 text-left" onClick={() => setDetail(a)}>
                                  {a.creative?.thumbnailUrl ? (
                                    <img src={a.creative.thumbnailUrl} alt={a.name} className="h-8 w-8 rounded object-cover" loading="lazy" />
                                  ) : (
                                    <span className="h-8 w-8 rounded bg-muted" />
                                  )}
                                  <span>
                                    <span className="block font-medium underline-offset-2 hover:underline">{a.name}</span>
                                    <span className="block text-muted-foreground">{a.adSetName}</span>
                                  </span>
                                </button>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{a.platform}</td>
                              <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                              <td className="px-3 py-2 text-right">{budgetLabel(a)}</td>
                              <td className="px-3 py-2 text-right">{fmtMoney(a.metrics?.spend, a.currency)}</td>
                              <td className="px-3 py-2 text-right">{fmtInt(a.metrics?.impressions)}</td>
                              <td className="px-3 py-2 text-right">{fmtInt(a.metrics?.clicks)}</td>
                              <td className="px-3 py-2 text-right">{fmtPct(a.metrics?.ctr)}</td>
                              <td className="px-3 py-2 text-right">{fmtMoney(a.metrics?.cpc, a.currency)}</td>
                              <td className="px-3 py-2 text-right">{fmtInt(a.metrics?.actions?.lead ?? a.metrics?.conversions)}</td>
                              <td className="px-3 py-2 text-right">{fmtMoney(a.metrics?.costPerConversion, a.currency)}</td>
                            </tr>
                          ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AdDetailDialog ad={detail} days={Number(days)} onClose={() => setDetail(null)} />
    </div>
  );
}