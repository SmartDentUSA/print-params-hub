import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tags } from 'lucide-react';

type Cat = { id: string; name: string; parent_id: string | null; is_active: boolean };
type TType = { id: string; name: string; category_id: string | null; is_active: boolean };

const sel = 'h-9 w-full rounded-md border bg-background px-2 text-sm';

export function TicketClassification({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const ticket = useQuery({
    queryKey: ['support_ticket_class', ticketId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('technical_tickets') as any).select('category_id, ticket_type_id').eq('id', ticketId).single();
      if (error) throw error;
      return data as { category_id: string | null; ticket_type_id: string | null };
    },
  });

  const cats = useQuery({
    queryKey: ['support-settings', 'support_ticket_categories'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('support_ticket_categories') as any).select('id, name, parent_id, is_active').order('sort_order');
      if (error) throw error;
      return (data ?? []) as Cat[];
    },
  });

  const types = useQuery({
    queryKey: ['support-settings', 'support_ticket_types'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('support_ticket_types') as any).select('id, name, category_id, is_active').order('sort_order');
      if (error) throw error;
      return (data ?? []) as TType[];
    },
  });

  const allCats = (cats.data ?? []).filter((c) => c.is_active);
  const mains = allCats.filter((c) => !c.parent_id);
  const current = ticket.data;
  const currentCat = allCats.find((c) => c.id === current?.category_id);
  const mainId = currentCat ? (currentCat.parent_id ?? currentCat.id) : '';
  const subId = currentCat?.parent_id ? currentCat.id : '';
  const subs = allCats.filter((c) => c.parent_id === mainId);
  const typeOptions = (types.data ?? []).filter((t) => t.is_active && (!t.category_id || t.category_id === mainId || t.category_id === subId));

  const save = async (patch: { category_id?: string | null; ticket_type_id?: string | null }) => {
    const { error } = await (supabase.from('technical_tickets') as any).update(patch).eq('id', ticketId);
    if (error) return toast({ title: 'Não foi possível salvar a classificação', description: error.message, variant: 'destructive' });
    qc.invalidateQueries({ queryKey: ['support_ticket_class', ticketId] });
    qc.invalidateQueries({ queryKey: ['support_tickets'] });
  };

  const onMain = (id: string) => save({ category_id: id || null, ticket_type_id: null });
  const onSub = (id: string) => save({ category_id: id || mainId || null, ticket_type_id: null });
  const onType = (id: string) => save({ ticket_type_id: id || null });

  return (
    <section className="p-6 lg:px-8 lg:py-5 border-b space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2"><Tags className="h-4 w-4 text-primary" />Classificação do chamado</h3>
      <div className="grid grid-cols-1 gap-2">
        <select className={sel} value={mainId} onChange={(e) => onMain(e.target.value)} aria-label="Categoria">
          <option value="">Categoria…</option>
          {mains.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {subs.length > 0 && (
          <select className={sel} value={subId} onChange={(e) => onSub(e.target.value)} aria-label="Subcategoria">
            <option value="">Subcategoria…</option>
            {subs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select className={sel} value={current?.ticket_type_id ?? ''} onChange={(e) => onType(e.target.value)} aria-label="Tipo de chamado">
          <option value="">Tipo de chamado…</option>
          {typeOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
    </section>
  );
}
