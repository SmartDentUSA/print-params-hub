import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users } from "lucide-react";

interface GroupRow {
  id: string;
  group_jid: string;
  name: string | null;
  member_count: number | null;
  instance_name: string | null;
  is_admin?: boolean;
}

interface Props {
  selectedIds: string[];
  onChange: (selectedIds: string[], jids: string[], names: string[], totalMembers: number) => void;
  instanceFilter?: string;
  className?: string;
  /** Quando true, inclui também grupos onde a instância não é admin (uso: blast pontual). */
  includeNonAdmin?: boolean;
}

export function WaGroupMultiSelect({ selectedIds, onChange, instanceFilter, className, includeNonAdmin = false }: Props) {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = (supabase as any)
        .from("wa_groups")
        .select("id, group_jid, name, member_count, instance_name, is_admin")
        .eq("enabled", true)
        .order("name", { ascending: true });
      if (!includeNonAdmin) q = q.eq("is_admin", true);
      if (instanceFilter) q = q.eq("instance_name", instanceFilter);
      const { data } = await q;
      if (!cancelled) {
        setGroups((data ?? []) as GroupRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [instanceFilter, includeNonAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g => (g.name ?? "").toLowerCase().includes(q));
  }, [groups, search]);

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    emit(next);
  };

  const emit = (ids: string[]) => {
    const selected = groups.filter(g => ids.includes(g.id));
    const total = selected.reduce((sum, g) => sum + (g.member_count ?? 0), 0);
    onChange(ids, selected.map(g => g.group_jid), selected.map(g => g.name ?? ""), total);
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every(g => selectedIds.includes(g.id));
  const toggleAll = () => {
    if (allVisibleSelected) {
      emit(selectedIds.filter(id => !filtered.some(g => g.id === id)));
    } else {
      const set = new Set([...selectedIds, ...filtered.map(g => g.id)]);
      emit(Array.from(set));
    }
  };

  const totalSelectedMembers = useMemo(() => {
    return groups.filter(g => selectedIds.includes(g.id)).reduce((s, g) => s + (g.member_count ?? 0), 0);
  }, [groups, selectedIds]);

  return (
    <div className={className}>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar grupo..."
          className="pl-8 h-8 text-xs"
        />
      </div>

      {loading ? (
        <div className="space-y-1.5">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground italic text-center py-6">
          {includeNonAdmin ? "Nenhum grupo encontrado." : "Nenhum grupo elegível (admin + ativado)."}
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={toggleAll}
            className="text-[11px] text-primary hover:underline mb-1.5"
          >
            {allVisibleSelected ? "Desmarcar visíveis" : "Selecionar visíveis"}
          </button>
          <div className="max-h-64 overflow-y-auto border rounded divide-y">
            {filtered.map(g => {
              const checked = selectedIds.includes(g.id);
              return (
                <label
                  key={g.id}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/40 cursor-pointer text-xs"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(g.id)} />
                  <span className="flex-1 truncate">{g.name ?? "Sem nome"}</span>
                  {includeNonAdmin && g.is_admin === false && (
                    <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-700 dark:text-amber-400">
                      não admin
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Users className="w-2.5 h-2.5" />
                    {g.member_count ?? 0}
                  </Badge>
                </label>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-2 text-[11px] text-muted-foreground">
        Selecionados: <span className="font-semibold text-foreground">{selectedIds.length}</span> grupos
        {" · "}
        <span className="font-semibold text-foreground">{totalSelectedMembers}</span> membros
      </div>
    </div>
  );
}

export default WaGroupMultiSelect;