import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";

interface CatalogProduct { id: string; name: string; category?: string | null; }

interface Props {
  selectedIds: string[];
  selectedNames: string[];
  onChange: (ids: string[], names: string[]) => void;
}

/** Multi-select de produtos do portfólio Smart Dent (system_a_catalog).
 *  Usado no editor de cursos online para vincular o tema da aula a produtos. */
export function CourseProductPicker({ selectedIds, selectedNames, onChange }: Props) {
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("system_a_catalog")
        .select("id, name, category")
        .eq("active", true)
        .eq("approved", true)
        .order("name");
      setItems((data ?? []) as CatalogProduct[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items.slice(0, 80);
    return items.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 80);
  }, [items, search]);

  const toggle = (p: CatalogProduct) => {
    const has = selectedIds.includes(p.id);
    const ids = has ? selectedIds.filter((x) => x !== p.id) : [...selectedIds, p.id];
    const names = has
      ? selectedNames.filter((_, i) => selectedIds[i] !== p.id)
      : [...selectedNames, p.name];
    onChange(ids, names);
  };

  const remove = (id: string) => {
    const idx = selectedIds.indexOf(id);
    if (idx < 0) return;
    const ids = selectedIds.filter((x) => x !== id);
    const names = selectedNames.filter((_, i) => i !== idx);
    onChange(ids, names);
  };

  return (
    <div className="space-y-2">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map((id, i) => (
            <Badge key={id} variant="secondary" className="gap-1">
              {selectedNames[i] ?? "Produto"}
              <button type="button" onClick={() => remove(id)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        placeholder={loading ? "Carregando portfólio…" : "Buscar produto do portfólio Smart Dent…"}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={loading}
      />
      <div className="max-h-56 overflow-auto rounded-md border bg-background">
        {filtered.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">Nenhum produto encontrado.</div>
        ) : (
          filtered.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <label
                key={p.id}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(p)} />
                <span className="flex-1 truncate">{p.name}</span>
              </label>
            );
          })
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Estes produtos aparecem como tags no card público da agenda online, indicando o tema da aula.
      </p>
    </div>
  );
}