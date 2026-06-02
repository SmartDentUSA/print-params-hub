import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function SocialContacts() {
  const [q, setQ] = useState('');

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['social-contacts', q],
    queryFn: async () => {
      let query = supabase.from('social_contacts').select('*').order('last_seen_at', { ascending: false }).limit(200);
      if (q) query = query.or(`ig_username.ilike.%${q}%,ig_user_id.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6" /> Contatos</h1>
        <p className="text-sm text-muted-foreground">Contatos capturados via IG e WhatsApp</p>
      </header>
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" placeholder="Buscar por @ ou ID" />
      </div>
      {isLoading ? <Skeleton className="h-64" /> : contacts?.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum contato.</CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3">Usuário</th>
                <th className="p-3">Canal</th>
                <th className="p-3">Tags</th>
                <th className="p-3">Inscrito</th>
                <th className="p-3">Visto</th>
              </tr>
            </thead>
            <tbody>
              {contacts!.map((c: any) => (
                <tr key={c.ig_user_id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-medium">@{c.ig_username ?? '—'}</div>
                    <div className="text-xs text-muted-foreground font-mono">{c.ig_user_id}</div>
                  </td>
                  <td className="p-3"><Badge variant="outline">{c.channel ?? 'instagram'}</Badge></td>
                  <td className="p-3">{(c.tags ?? []).map((t: string) => <Badge key={t} variant="secondary" className="mr-1">{t}</Badge>)}</td>
                  <td className="p-3">{c.subscribed ? '✓' : '✕'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{c.last_seen_at ? new Date(c.last_seen_at).toLocaleString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </div>
  );
}