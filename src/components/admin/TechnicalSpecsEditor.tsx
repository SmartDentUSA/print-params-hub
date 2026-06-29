import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowUp, ArrowDown, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TechSpec {
  label: string;
  value: string;
}

interface Props {
  value: TechSpec[];
  onChange: (next: TechSpec[]) => void;
  externalId?: string | null;
  productName?: string | null;
}

export function TechnicalSpecsEditor({ value, onChange, externalId, productName }: Props) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const rows = Array.isArray(value) ? value : [];

  const update = (idx: number, patch: Partial<TechSpec>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };
  const add = () => onChange([...rows, { label: '', value: '' }]);
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const fetchFromSystemA = async () => {
    if (!externalId) {
      toast({ title: 'Sem external_id', description: 'Produto não tem ID do Sistema A.', variant: 'destructive' });
      return;
    }
    if (rows.length > 0 && !window.confirm(`Substituir ${rows.length} spec(s) atuais pelo conteúdo vindo do Sistema A?`)) return;
    setSyncing(true);
    try {
      const url = `/functions/v1/smart-ops-refresh-system-a-cache?product_id=${encodeURIComponent(externalId)}`;
      const { data, error } = await supabase.functions.invoke('smart-ops-refresh-system-a-cache', {
        body: { product_id: externalId },
      });
      if (error) throw error;
      // Re-read the row to get fresh specs
      const { data: row } = await supabase
        .from('system_a_catalog')
        .select('extra_data')
        .eq('external_id', externalId)
        .maybeSingle();
      const specs = ((row?.extra_data as any)?.system_a_live?.technical_specs ?? []) as TechSpec[];
      onChange(specs);
      toast({ title: 'Specs sincronizadas', description: `${specs.length} linha(s) importadas do Sistema A.` });
    } catch (e) {
      toast({ title: 'Falha ao sincronizar', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">📊 Tabela técnica</Label>
          <Badge variant="outline">{rows.length} spec{rows.length === 1 ? '' : 's'}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={fetchFromSystemA} disabled={syncing || !externalId}>
            {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Buscar do Sistema A
          </Button>
          <Button type="button" size="sm" onClick={add}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar linha
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Nenhuma spec cadastrada. Clique em "Adicionar linha" ou "Buscar do Sistema A".
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1.5fr_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
            <div>Label</div>
            <div>Valor</div>
            <div className="text-right">Ações</div>
          </div>
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1.5fr_auto] gap-2 items-center">
              <Input
                value={row.label}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder="Ex: Indicação clínica"
                className="text-sm"
              />
              <Input
                value={row.value}
                onChange={(e) => update(idx, { value: e.target.value })}
                placeholder="Ex: Placas miorrelaxantes"
                className="text-sm"
              />
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0} title="Mover para cima">
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => move(idx, 1)} disabled={idx === rows.length - 1} title="Mover para baixo">
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => remove(idx)} title="Excluir linha">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {productName && (
        <p className="text-[10px] text-muted-foreground">
          As alterações só serão salvas ao clicar em "Salvar" no produto. As specs aparecem no card público (PT) de {productName}.
        </p>
      )}
    </div>
  );
}