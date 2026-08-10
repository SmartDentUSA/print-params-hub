import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PLATFORMS = ['all', 'instagram', 'facebook', 'whatsapp', 'tiktok'] as const;
type PlatformFilter = typeof PLATFORMS[number];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30',
  facebook: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  whatsapp: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
  tiktok: 'bg-foreground/10 text-foreground border-foreground/20',
};

export function SocialContacts() {
  const [platform, setPlatform] = useState<PlatformFilter>('all');

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['social-contacts', platform],
    queryFn: async () => {
      let query = supabase.from('social_contacts').select('*').order('last_seen_at', { ascending: false, nullsFirst: false }).limit(1000);
      if (platform !== 'all') query = query.eq('channel', platform);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 120_000,
  });

  const leadIds = [...new Set((contacts ?? []).map((c: any) => c.lead_id).filter(Boolean))] as string[];
  const { data: leadNames } = useQuery({
    queryKey: ['social-contacts-leads', leadIds.join(',')],
    enabled: leadIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lia_attendances')
        .select('id, nome, real_status')
        .in('id', leadIds.slice(0, 500));
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((l: any) => [l.id, l]));
    },
  });

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt).then(() => toast.success('Copiado'));
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6" /> Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Contatos de todas as plataformas (Zernio) — sincronização, identificação de leads e
            registro na timeline são automáticos.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 flex-wrap">
          {PLATFORMS.map((p) => (
            <Button key={p} size="sm" variant={platform === p ? 'default' : 'outline'} className="capitalize h-8" onClick={() => setPlatform(p)}>
              {p === 'all' ? 'Todas' : p}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? <Skeleton className="h-64" /> : contacts?.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum contato ainda. A sincronização com o Zernio roda automaticamente.
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3">Contato</th>
                <th className="p-3">Plataforma</th>
                <th className="p-3">Telefone</th>
                <th className="p-3">ID da plataforma</th>
                <th className="p-3">Lead</th>
                <th className="p-3">Tags</th>
                <th className="p-3">Inscrito</th>
                <th className="p-3">Visto</th>
              </tr>
            </thead>
            <tbody>
              {contacts!.map((c: any) => {
                const channel = c.channel ?? 'instagram';
                const rawIdentifier: string | null =
                  c.platform_user_id ?? c.custom_fields?.platformIdentifier ?? null;
                const phoneDigits = String(
                  c.phone_e164 ?? (channel === 'whatsapp' ? rawIdentifier ?? '' : c.custom_fields?.dm_phone ?? ''),
                ).replace(/\D/g, '');
                const phone = phoneDigits.length >= 10 ? `+${phoneDigits}` : null;
                const platformId = channel === 'whatsapp' ? null : rawIdentifier;
                return (
                  <tr key={c.ig_user_id} className="border-t border-border">
                    <td className="p-3">
                      <div className="font-medium">{c.ig_username ?? phone ?? '—'}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate max-w-[220px]">
                        Zernio: {c.zernio_contact_id ?? c.ig_user_id}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={`capitalize ${PLATFORM_COLORS[channel] ?? ''}`}>{channel}</Badge>
                    </td>
                    <td className="p-3">
                      {phone ? (
                        <button onClick={() => copy(phone)} className="inline-flex items-center gap-1 text-xs font-mono hover:text-primary">
                          <Copy className="w-3 h-3" /> {phone}
                        </button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">
                      {platformId ? (
                        <button onClick={() => copy(platformId)} className="inline-flex items-center gap-1 text-xs font-mono hover:text-primary" title={`ID ${channel}`}>
                          <Copy className="w-3 h-3" /> {platformId}
                        </button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">
                      {c.lead_id ? (
                        <a href={`/admin/leads?lead=${c.lead_id}`} className="inline-flex items-center gap-1 text-xs hover:underline">
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                            {leadNames?.[c.lead_id]?.nome ?? 'Lead'}
                          </Badge>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">sem cadastro</span>
                      )}
                    </td>
                    <td className="p-3">{(c.tags ?? []).slice(0, 3).map((t: string) => <Badge key={t} variant="secondary" className="mr-1">{t}</Badge>)}</td>
                    <td className="p-3">{c.subscribed ? '✓' : '✕'}</td>
                    <td className="p-3 text-xs text-muted-foreground">{c.last_seen_at ? new Date(c.last_seen_at).toLocaleString('pt-BR') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}