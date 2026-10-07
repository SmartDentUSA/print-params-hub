import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type Row = { channel: string; views: number; leads: number; conversions: number; revenue: number };
const LABEL: Record<string, string> = { form: "Formulário", specialist: "Falar com especialista", whatsapp_lia: "WhatsApp (Dra. LIA)" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function AttendanceChannelMetrics({ formId, campaignSlug, days = 90, title }: { formId?: string | null; campaignSlug?: string | null; days?: number; title?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    setRows(null);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    (supabase as any).rpc("fn_attendance_channel_metrics", { _form_id: formId ?? null, _campaign_slug: campaignSlug ?? null, _since: since })
      .then(({ data }: any) => setRows((data ?? []).map((r: any) => ({ ...r, views: +r.views, leads: +r.leads, conversions: +r.conversions, revenue: +r.revenue }))));
  }, [formId, campaignSlug, days]);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title ?? `Comparativo por canal de atendimento (${days} dias)`}</CardTitle></CardHeader>
      <CardContent>
        {!rows ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-1">Canal</th><th>Visualizações</th><th>Leads gerados</th><th>Taxa de lead</th><th>Conversões</th><th>Conversão</th><th>Valor das conversões</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.channel} className="border-t border-border">
                    <td className="py-1.5 font-medium">{LABEL[r.channel] ?? r.channel}</td>
                    <td>{r.views}</td>
                    <td>{r.leads}</td>
                    <td>{r.views ? `${((r.leads / r.views) * 100).toFixed(1)}%` : "—"}</td>
                    <td>{r.conversions}</td>
                    <td>{r.leads ? `${((r.conversions / r.leads) * 100).toFixed(1)}%` : "—"}</td>
                    <td>{brl(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">Visualizações: aberturas da página (formulário) e cliques nos botões (especialista e WhatsApp). Conversão conta só negócios ganhos depois da captura. Os dados começam a contar a partir de hoje.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
