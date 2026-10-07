import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeEquipmentLabel } from '@/utils/equipmentLabel';
import { resolveLeadDisplayName } from '@/utils/leadDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Phone, Mail, MapPin, Wrench, GraduationCap, Ticket, UserRound, RefreshCw, AlertCircle, Activity } from 'lucide-react';

type HistoryTicket = { id: string; ticket_full_id: string; equipment: string | null; serial_number: string | null; kanban_status: string; created_at: string };
type ActivityEntry = { id: string; event_type: string; event_timestamp: string; entity_name: string | null; source_channel: string | null };
type Context = { client: Record<string, string | string[] | null> | null; tickets: HistoryTicket[]; ticket_count: number; summary?: { open: number; resolved: number; priority: boolean }; activity: ActivityEntry[] };
const EQUIPMENT = [
  ['equip_scanner', 'Scanner intraoral'], ['equip_scanner_bancada', 'Scanner de bancada'],
  ['equip_impressora', 'Impressora 3D'], ['equip_cad', 'CAD'], ['equip_pos_impressao', 'Pós-impressão'],
  ['equip_fresadora', 'Fresadora'], ['equip_notebook', 'Notebook'],
] as const;
const date = (value: string) => new Date(value).toLocaleDateString('pt-BR');
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;

export function SupportClientProfile({ ticketId, equipment, serial, fallbackName, fallbackPhone, fallbackEmail }: {
  ticketId: string; equipment: string | null; serial: string | null; fallbackName?: string | null; fallbackPhone?: string | null; fallbackEmail?: string | null;
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['support_client_context', ticketId],
    queryFn: async (): Promise<Context> => {
      const { data, error } = await supabase.functions.invoke('support-client-context', { body: { ticket_id: ticketId } });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const detail = await error.context.json().catch(() => null);
          throw new Error(detail?.error || 'Não foi possível carregar a ficha');
        }
        throw error;
      }
      return data;
    },
    staleTime: 30000,
  });
  const client = data?.client;
  const name = client ? resolveLeadDisplayName(client) : fallbackName || 'Cliente';
  const phone = text(client?.telefone_normalized) || fallbackPhone;
  const email = text(client?.email) || fallbackEmail;
  const devices: { label: string; category: string; serial: string | null }[] = EQUIPMENT.flatMap(([field, category]) => {
    const label = sanitizeEquipmentLabel(client?.[field]);
    const number = text(client?.[`${field}_serial`]);
    return label || number ? [{ label: label || category, category, serial: number }] : [];
  });
  const cleanEquipment = sanitizeEquipmentLabel(equipment);
  if ((cleanEquipment || serial) && !devices.some(d => d.label === cleanEquipment && d.serial === serial)) {
    devices.unshift({ label: cleanEquipment || 'Equipamento do chamado', category: 'Neste chamado', serial });
  }
  const training = text(client?.cs_treinamento);
  const trainingDate = text(client?.data_treinamento);
  const trainedEquipment = Array.isArray(client?.imersao_equipamentos_treinados) ? client.imersao_equipamentos_treinados : [];
  return <aside className="w-full min-w-0 border-t lg:border-t-0 lg:border-l bg-card overflow-y-auto">
    <div className="p-6 lg:p-8 border-b">
      <p className="text-xs font-medium text-muted-foreground mb-4">FICHA DO CLIENTE</p>
      <div className="flex items-center gap-3">
         <div className="h-16 w-16 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-2xl font-semibold shrink-0">{name.slice(0, 1).toUpperCase()}</div>
         <div className="min-w-0"><h2 className="font-semibold text-2xl break-words">{name}</h2>{data && <p className="text-sm text-muted-foreground mt-1">{data.ticket_count} chamados no histórico</p>}</div>
      </div>
      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        {phone && <p className="flex items-start gap-2"><Phone className="h-4 w-4 shrink-0 mt-0.5" /><span className="break-all">{phone}</span></p>}
        {email && <p className="flex items-start gap-2"><Mail className="h-4 w-4 shrink-0 mt-0.5" /><span className="break-all">{email}</span></p>}
        {(client?.cidade || client?.uf) && <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0" />{[client.cidade, client.uf].filter(Boolean).join(' / ')}</p>}
        {text(client?.proprietario_lead_crm) && <p className="flex gap-2"><UserRound className="h-4 w-4 shrink-0" /><span>Vendedor: {text(client?.proprietario_lead_crm)}</span></p>}
      </div>
      {data?.summary && <div className="mt-5 border-t pt-4 flex flex-wrap gap-5 text-sm"><span><strong>{data.summary.open}</strong> abertos</span><span><strong>{data.summary.resolved}</strong> resolvidos / encerrados</span>{data.summary.priority && <Badge variant="destructive">Prioritário · Edge Mini</Badge>}</div>}
    </div>
    {isLoading && <p className="p-5 text-sm text-muted-foreground">Carregando ficha do cliente…</p>}
    {error && <div className="p-5 text-sm space-y-3"><p className="flex gap-2 text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error.message}</p><Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Tentar novamente</Button></div>}
    {data && !client && <p className="p-5 text-sm text-muted-foreground">Cadastro canônico do cliente não disponível para este chamado.</p>}
    <Tabs defaultValue="equipment" className="p-6 lg:p-8">
      <TabsList className="w-full grid grid-cols-3"><TabsTrigger value="equipment">Ficha</TabsTrigger><TabsTrigger value="tickets">Chamados</TabsTrigger><TabsTrigger value="timeline">Timeline</TabsTrigger></TabsList>
      <TabsContent value="equipment" className="mt-5 space-y-6">
        <section><h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Wrench className="h-4 w-4 text-primary" />Equipamentos e seriais</h3>
          {devices.length ? <div className="space-y-3">{devices.map((d, i) => <div key={`${d.category}-${i}`} className="support-equipment-row p-4 rounded-lg"><p className="text-xs text-muted-foreground mb-2">{d.category}</p><div className="flex flex-wrap justify-between gap-2"><p className="text-base font-medium break-words">{d.label}</p><p className="text-xs font-mono break-all text-muted-foreground">{d.serial ? `SN ${d.serial}` : 'Serial não cadastrado'}</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum equipamento cadastrado.</p>}
        </section>
        <section><h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><GraduationCap className="h-4 w-4 text-primary" />Treinamentos</h3>
          {training || trainingDate || trainedEquipment.length ? <div className="text-sm space-y-2">{training && <p>{training}</p>}{trainingDate && <p className="text-muted-foreground">Data: {trainingDate}</p>}{trainedEquipment.map((item, i) => <p key={i}>{item}</p>)}</div> : <p className="text-sm text-muted-foreground">Nenhum treinamento cadastrado.</p>}
        </section>
      </TabsContent>
      <TabsContent value="tickets" className="mt-5 divide-y">{data?.tickets.length ? data.tickets.map(t => <section key={t.id} className="py-3"><div className="flex justify-between gap-2"><p className="font-mono text-xs text-primary">#{t.ticket_full_id}</p><span className="text-xs text-muted-foreground">{date(t.created_at)}</span></div><p className="text-sm mt-2 break-words">{t.equipment || 'Equipamento não informado'}</p>{t.serial_number && <p className="text-xs font-mono mt-1">SN {t.serial_number}</p>}<Badge variant="secondary" className="mt-2">{t.kanban_status.replace(/_/g, ' ')}</Badge></section>) : <p className="text-sm text-muted-foreground py-3">Sem histórico disponível.</p>}</TabsContent>
      <TabsContent value="timeline" className="mt-5 space-y-4">{data?.activity.length ? data.activity.map(a => <div key={a.id} className="flex gap-3"><Activity className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" /><div className="min-w-0"><p className="text-sm break-words">{a.entity_name || a.event_type.replace(/_/g, ' ')}</p><p className="text-xs text-muted-foreground mt-1">{date(a.event_timestamp)}{a.source_channel ? ` · ${a.source_channel}` : ''}</p></div></div>) : <p className="text-sm text-muted-foreground">Sem atividades registradas.</p>}</TabsContent>
    </Tabs>
  </aside>;
}