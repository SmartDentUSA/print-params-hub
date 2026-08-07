import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCampaignRevenueDetail } from '@/hooks/social/useZernioAds';

const money = (v?: number | null) =>
  v === null || v === undefined
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const date = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');

interface Props {
  campaignId: string | null;
  campaignName?: string;
  days: number;
  onClose: () => void;
}

export function CampaignRevenueDialog({ campaignId, campaignName, days, onClose }: Props) {
  const q = useCampaignRevenueDetail(campaignId, days);
  const rows = q.data ?? [];
  const total = rows.reduce((s, r) => s + (r.deal_value ?? 0), 0);

  return (
    <Dialog open={!!campaignId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            Receita atribuída — {campaignName ?? campaignId}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Propostas ganhas de leads que converteram nesta campanha, contadas a partir do momento da
          conversão (data real de fechamento no CRM). Inclui compras de produtos diferentes do
          anunciado — marcadas como cross-sell.
        </p>

        {q.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Nenhum negócio ganho atribuído a esta campanha no período.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Lead</th>
                  <th className="px-2 py-2 text-left">Funil</th>
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2 text-center">Conversão</th>
                  <th className="px-2 py-2 text-center">Fechamento</th>
                  <th className="px-2 py-2 text-right">Lead time</th>
                  <th className="px-2 py-2 text-left">Anunciado → comprado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.deal_id} className="border-b">
                    <td className="px-2 py-2">
                      <span className="block font-medium">{r.lead_name ?? '—'}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.deal_title ?? `#${r.piperun_deal_id ?? ''}`}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">{r.pipeline_name ?? '—'}</td>
                    <td className="px-2 py-2 text-right font-medium">{money(r.deal_value)}</td>
                    <td className="px-2 py-2 text-center text-xs">{date(r.converted_at)}</td>
                    <td className="px-2 py-2 text-center text-xs">{date(r.closed_at)}</td>
                    <td className="px-2 py-2 text-right text-xs">
                      {r.lead_time_days === null ? '—' : `${r.lead_time_days} d`}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      <span className="text-muted-foreground">{r.campaign_product ?? '—'}</span>
                      {' → '}
                      <span>{r.purchased_products?.join(', ') || '—'}</span>
                      {r.cross_sell ? (
                        <Badge variant="secondary" className="ml-2">cross-sell</Badge>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="px-2 py-2 text-xs uppercase text-muted-foreground">Total</td>
                  <td />
                  <td className="px-2 py-2 text-right font-bold">{money(total)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}