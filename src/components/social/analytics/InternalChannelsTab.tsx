import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bot, MessageCircle, Smartphone, Users, AlertTriangle, Sparkles } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { KpiStrip, EmptyChart } from './KpiStrip';
import { useInternalChannelAnalytics } from '@/hooks/social/useInternalChannelAnalytics';

const tooltipStyle = { background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8 };

function statusVariant(status?: string | null) {
  const s = (status ?? '').toLowerCase();
  if (s.includes('open') || s.includes('ok') || s.includes('conect')) return 'default' as const;
  if (!s) return 'outline' as const;
  return 'destructive' as const;
}

export function InternalChannelsTab({ days }: { days: number }) {
  const { data, isLoading, error } = useInternalChannelAnalytics(days);
  const lia = data?.lia;

  return (
    <div className="space-y-4">
      {error ? <Alert variant="destructive"><AlertDescription>{String((error as Error).message)}</AlertDescription></Alert> : null}

      <KpiStrip
        loading={isLoading}
        kpis={[
          { label: 'Instâncias WhatsApp', value: data?.instances?.length ?? 0, icon: <Smartphone className="w-3.5 h-3.5" /> },
          { label: 'Mensagens enviadas', value: (data?.instances ?? []).reduce((s, i) => s + (i.sent ?? 0), 0), icon: <MessageCircle className="w-3.5 h-3.5" /> },
          { label: 'Envios em grupo', value: (data?.instances ?? []).reduce((s, i) => s + (i.group_sent ?? 0), 0), icon: <Users className="w-3.5 h-3.5" /> },
          { label: 'Interações Dra. LIA', value: lia?.interactions ?? 0, icon: <Bot className="w-3.5 h-3.5" /> },
          { label: 'Sessões LIA', value: lia?.total_sessions ?? 0, hint: `${lia?.human_takeover ?? 0} com atendimento humano`, icon: <Sparkles className="w-3.5 h-3.5" /> },
          { label: 'Sem resposta', value: lia?.unanswered ?? 0, hint: lia?.avg_similarity != null ? `similaridade média ${lia.avg_similarity}` : undefined, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
        ]}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Instâncias WhatsApp (Team Members)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (data?.instances ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma instância cadastrada.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {data!.instances.map((i, idx) => (
                <div key={`${i.instance}-${i.phone ?? ''}-${idx}`} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium leading-tight">{i.name ?? i.instance}</div>
                      <div className="text-xs text-muted-foreground">{i.instance}{i.phone ? ` · ${i.phone}` : ''}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={statusVariant(i.health_status)}>{i.health_status ?? 'sem sessão'}</Badge>
                      {!i.active ? <Badge variant="outline">inativo</Badge> : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <div className="text-muted-foreground">Enviadas</div>
                      <div className="font-semibold text-base tabular-nums">{(i.sent ?? 0).toLocaleString('pt-BR')}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Falhas</div>
                      <div className="font-semibold text-base tabular-nums">{(i.sent_fail ?? 0).toLocaleString('pt-BR')}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Grupos</div>
                      <div className="font-semibold text-base tabular-nums">{(i.group_sent ?? 0).toLocaleString('pt-BR')}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {i.last_success_at ? `Último envio ok: ${new Date(i.last_success_at).toLocaleString('pt-BR')}` : 'Sem envio recente'}
                    {i.last_error_at ? ` · Último erro: ${new Date(i.last_error_at).toLocaleString('pt-BR')}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Envios WhatsApp por dia</CardTitle></CardHeader>
          <CardContent className="h-64">
            {(data?.wa_daily ?? []).length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data!.wa_daily.map((d) => ({ date: String(d.date).slice(5), envios: d.count }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="envios" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Dra. LIA — interações por dia</CardTitle></CardHeader>
          <CardContent className="h-64">
            {(data?.lia_daily ?? []).length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data!.lia_daily.map((d) => ({ date: String(d.date).slice(5), interações: d.count, 'sem resposta': d.unanswered }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="interações" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sem resposta" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}