import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SourceType = "article" | "product" | "video";

interface Item {
  id: string;
  title: string;
  category?: string | null;
  preview?: string | null;
  updated_at?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (type: SourceType, id: string, title: string) => void;
}

export function WaContentNodeSelector({ open, onClose, onSelect }: Props) {
  const [tab, setTab] = useState<SourceType>("article");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(null);
      setItems([]);
      setTab("article");
    }
  }, [open]);

  const debounced = useDebounce(query, 300);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        let rows: Item[] = [];
        if (tab === "article") {
          let q = supabase
            .from("knowledge_articles")
            .select("id, title, category, meta_description, updated_at")
            .eq("is_published", true)
            .order("updated_at", { ascending: false })
            .limit(50);
          if (debounced) q = q.ilike("title", `%${debounced}%`);
          const { data, error } = await q;
          if (error) throw error;
          rows = (data ?? []).map((r: any) => ({
            id: r.id, title: r.title, category: r.category,
            preview: r.meta_description, updated_at: r.updated_at,
          }));
        } else if (tab === "product") {
          let q = supabase
            .from("system_a_catalog")
            .select("id, name, category, description, updated_at")
            .eq("active", true)
            .order("updated_at", { ascending: false })
            .limit(50);
          if (debounced) q = q.ilike("name", `%${debounced}%`);
          const { data, error } = await q;
          if (error) throw error;
          rows = (data ?? []).map((r: any) => ({
            id: r.id, title: r.name, category: r.category,
            preview: r.description, updated_at: r.updated_at,
          }));
        } else {
          let q = supabase
            .from("videos")
            .select("id, title, description, updated_at")
            .eq("status", "active")
            .order("updated_at", { ascending: false })
            .limit(50);
          if (debounced) q = q.ilike("title", `%${debounced}%`);
          const { data, error } = await q;
          if (error) throw error;
          rows = (data ?? []).map((r: any) => ({
            id: r.id, title: r.title, preview: r.description, updated_at: r.updated_at,
          }));
        }
        if (!cancelled) setItems(rows);
      } catch (err: any) {
        if (!cancelled) toast.error(err?.message || "Falha ao buscar conteúdo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, tab, debounced]);

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(tab, selected.id, selected.title);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Selecionar conteúdo</DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-3 flex-1 overflow-hidden flex flex-col">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título..."
              className="pl-9"
            />
          </div>

          <Tabs value={tab} onValueChange={(v) => { setTab(v as SourceType); setSelected(null); }}>
            <TabsList>
              <TabsTrigger value="article">Artigos</TabsTrigger>
              <TabsTrigger value="product">Produtos</TabsTrigger>
              <TabsTrigger value="video">Vídeos</TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-3">
              <ScrollArea className="h-72 rounded-md border">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground text-center">
                    Nenhum item encontrado.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {items.map((item) => {
                      const isSel = selected?.id === item.id;
                      return (
                        <li
                          key={item.id}
                          onClick={() => setSelected(item)}
                          className={cn(
                            "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                            isSel && "bg-primary/10 border-l-2 border-primary"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">{item.title}</span>
                                {item.category && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {item.category}
                                  </Badge>
                                )}
                              </div>
                              {item.preview && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {item.preview.replace(/<[^>]+>/g, "")}
                                </p>
                              )}
                              {item.updated_at && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Atualizado {new Date(item.updated_at).toLocaleDateString("pt-BR")}
                                </p>
                              )}
                            </div>
                            {isSel && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex items-center justify-between p-4 border-t bg-muted/20">
          <span className="text-sm text-muted-foreground truncate flex-1 mr-3">
            {selected ? `Selecionado: ${selected.title}` : "Nenhum item selecionado"}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!selected}>
              Usar este conteúdo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useDebounce<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}