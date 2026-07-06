import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

type Group = { id: string; name: string | null; member_count: number | null };

export function PostGruposAddModal({
  instanceName,
  existingGroupIds,
  onClose,
  onAdded,
}: {
  instanceName: string;
  existingGroupIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('wa_groups')
        .select('id, name, member_count')
        .eq('instance_name', instanceName)
        .eq('ativo', true)
        .order('member_count', { ascending: false })
        .limit(1000);
      const all = (data as Group[]) ?? [];
      const exclude = new Set(existingGroupIds);
      setGroups(all.filter((g) => !exclude.has(g.id)));
      setLoading(false);
    })();
  }, [instanceName, existingGroupIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => (g.name ?? '').toLowerCase().includes(q));
  }, [groups, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function add() {
    if (selected.size === 0) return;
    setSaving(true);
    const rows = Array.from(selected).map((group_id) => ({
      instance_name: instanceName,
      group_id,
      enabled: true,
    }));
    const { error } = await supabase.from('post_group_targets').insert(rows);
    setSaving(false);
    if (error) {
      console.error('[post_group_targets] insert error', error);
      return toast.error(`Falha ao adicionar grupos: ${error.message}`);
    }
    toast.success(`${rows.length} grupo${rows.length === 1 ? '' : 's'} adicionado${rows.length === 1 ? '' : 's'}`);
    onAdded();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar grupos — {instanceName}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Nenhum grupo encontrado.</div>
          ) : (
            filtered.map((g) => (
              <label
                key={g.id}
                className="flex items-center gap-3 p-2.5 hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(g.id)}
                  onCheckedChange={() => toggle(g.id)}
                />
                <span className="flex-1 text-sm">{g.name ?? '(sem nome)'}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {(g.member_count ?? 0).toLocaleString('pt-BR')}
                </span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={add} disabled={selected.size === 0 || saving}>
            Adicionar ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}