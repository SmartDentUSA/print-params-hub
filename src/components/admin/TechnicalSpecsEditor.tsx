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

/** Labels canônicos das linhas auto-gerenciadas pela seção "Variações". */
const VARIATION_LABELS = ['GTIN/EAN', 'Peso (kg)', 'Dimensões (cm)'] as const;
type VarField = 'gtin' | 'weight' | 'dims';
const FIELD_TO_LABEL: Record<VarField, (typeof VARIATION_LABELS)[number]> = {
  gtin: 'GTIN/EAN',
  weight: 'Peso (kg)',
  dims: 'Dimensões (cm)',
};

interface VariationRow {
  name: string;
  gtin: string;
  weight: string;
  dims: string;
}

function parseVariationLabel(label: string): { field: VarField; variation: string } | null {
  const m = label.match(/^\s*(GTIN\/EAN|Peso \(kg\)|Dimensões \(cm\))\s*(?:[—–-]\s*(.+))?\s*$/i);
  if (!m) return null;
  const base = m[1].toLowerCase();
  const field: VarField = base.startsWith('gtin') ? 'gtin' : base.startsWith('peso') ? 'weight' : 'dims';
  return { field, variation: (m[2] ?? '').trim() };
}

function splitSpecs(rows: TechSpec[]): { variations: VariationRow[]; others: TechSpec[] } {
  const map = new Map<string, VariationRow>();
  const order: string[] = [];
  const others: TechSpec[] = [];
  for (const r of rows) {
    const parsed = parseVariationLabel(r.label || '');
    if (!parsed) { others.push(r); continue; }
    const key = parsed.variation || '__default__';
    if (!map.has(key)) { map.set(key, { name: parsed.variation, gtin: '', weight: '', dims: '' }); order.push(key); }
    map.get(key)![parsed.field] = r.value ?? '';
  }
  return { variations: order.map((k) => map.get(k)!), others };
}

function variationsToSpecs(variations: VariationRow[]): TechSpec[] {
  const out: TechSpec[] = [];
  for (const v of variations) {
    const suffix = v.name.trim() ? ` — ${v.name.trim()}` : '';
    (Object.keys(FIELD_TO_LABEL) as VarField[]).forEach((f) => {
      const val = (v[f] ?? '').trim();
      if (val) out.push({ label: `${FIELD_TO_LABEL[f]}${suffix}`, value: val });
    });
  }
  return out;
}

export function TechnicalSpecsEditor({ value, onChange, externalId, productName }: Props) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const rows = Array.isArray(value) ? value : [];
  const { variations, others } = splitSpecs(rows);

  const commit = (nextVariations: VariationRow[], nextOthers: TechSpec[]) => {
    onChange([...variationsToSpecs(nextVariations), ...nextOthers]);
  };

  const updateVar = (idx: number, patch: Partial<VariationRow>) => {
    commit(variations.map((v, i) => (i === idx ? { ...v, ...patch } : v)), others);
  };
  const addVar = () => commit([...variations, { name: '', gtin: '', weight: '', dims: '' }], others);
  const removeVar = (idx: number) => commit(variations.filter((_, i) => i !== idx), others);

  const update = (idx: number, patch: Partial<TechSpec>) => {
    commit(variations, others.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const add = () => commit(variations, [...others, { label: '', value: '' }]);
  const remove = (idx: number) => commit(variations, others.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= others.length) return;
    const next = [...others];
    [next[idx], next[target]] = [next[target], next[idx]];
    commit(variations, next);
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

      {/* Seção: Variações (GTIN/EAN, Peso, Dimensões) */}
      <div className="space-y-2 p-3 rounded-md border bg-background">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Variações — GTIN/EAN · Peso · Dimensões
            </Label>
            <Badge variant="secondary">{variations.length}</Badge>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addVar}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar variação
          </Button>
        </div>

        {variations.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            Nenhuma variação cadastrada. Use uma linha por SKU/cor/tamanho.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1.2fr_1.2fr_0.8fr_1fr_auto] gap-2 text-[11px] font-medium text-muted-foreground px-1">
              <div>Variação</div>
              <div>GTIN / EAN</div>
              <div>Peso (kg)</div>
              <div>Dimensões (cm)</div>
              <div className="text-right">Ações</div>
            </div>
            {variations.map((v, idx) => (
              <div key={idx} className="grid grid-cols-[1.2fr_1.2fr_0.8fr_1fr_auto] gap-2 items-center">
                <Input value={v.name} onChange={(e) => updateVar(idx, { name: e.target.value })} placeholder="Ex: 1kg Bone" className="text-sm" />
                <Input value={v.gtin} onChange={(e) => updateVar(idx, { gtin: e.target.value })} placeholder="Ex: 7890000000000" className="text-sm font-mono" />
                <Input value={v.weight} onChange={(e) => updateVar(idx, { weight: e.target.value })} placeholder="1.0" className="text-sm" />
                <Input value={v.dims} onChange={(e) => updateVar(idx, { dims: e.target.value })} placeholder="L x A x P (ex: 10 x 12 x 8)" className="text-sm" />
                <Button type="button" size="icon" variant="ghost" onClick={() => removeVar(idx)} title="Excluir variação">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Salvas como linhas na Tabela técnica (ex.: <em>GTIN/EAN — 1kg Bone</em>). Aparecem no card público e na exportação.
        </p>
      </div>

      {others.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Nenhuma outra spec cadastrada. Clique em "Adicionar linha" ou "Buscar do Sistema A".
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1.5fr_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
            <div>Label</div>
            <div>Valor</div>
            <div className="text-right">Ações</div>
          </div>
          {others.map((row, idx) => (
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
                <Button type="button" size="icon" variant="ghost" onClick={() => move(idx, 1)} disabled={idx === others.length - 1} title="Mover para baixo">
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
          Edições são salvas ao clicar em <strong>Salvar</strong> no produto e aparecem
          imediatamente no card público (PT) de {productName}. EN/ES traduzem na próxima sync.
        </p>
      )}
    </div>
  );
}