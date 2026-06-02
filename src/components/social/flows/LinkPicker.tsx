import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Link2, Search, ShoppingCart, ClipboardList, BookOpen, ChevronRight, Trash2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export type LinkPickerTab = 'manual' | 'loja' | 'formulario' | 'publicacao';

export interface LinkPickerSelection {
  url: string;
  titulo: string;
  tipo: LinkPickerTab;
  thumbnail_url?: string;
  descricao?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (link: LinkPickerSelection) => void;
  initialTab?: LinkPickerTab;
  filterProduto?: string;
}

interface ViewRow {
  tipo: LinkPickerTab;
  id: string;
  titulo: string;
  url: string;
  descricao: string | null;
  thumbnail_url: string | null;
  categoria: string | null;
  preco: string | null;
}

function hostOf(url?: string | null) {
  if (!url) return '';
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; }
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function LinkPicker({ open, onOpenChange, onSelect, initialTab = 'manual', filterProduto }: Props) {
  const [tab, setTab] = useState<LinkPickerTab>(initialTab);
  const [counts, setCounts] = useState<Record<LinkPickerTab, number>>({ manual: 0, loja: 0, formulario: 0, publicacao: 0 });

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('v_flow_link_picker')
        .select('tipo');
      if (!data) return;
      const c: Record<LinkPickerTab, number> = { manual: 0, loja: 0, formulario: 0, publicacao: 0 };
      for (const r of data as { tipo: LinkPickerTab }[]) if (c[r.tipo] !== undefined) c[r.tipo]++;
      setCounts(c);
    })();
  }, [open]);

  const handleSelect = (link: LinkPickerSelection) => {
    onSelect(link);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Link2 className="w-4 h-4 text-primary" /> Adicionar link
          </SheetTitle>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as LinkPickerTab)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-4 mx-3 mt-3 h-auto bg-muted/40">
            <TabsTrigger value="manual" className="text-xs flex-col gap-0.5 py-2">
              <span>✏️ Colar</span>
            </TabsTrigger>
            <TabsTrigger value="loja" className="text-xs flex-col gap-0.5 py-2">
              <span>🛒 Loja</span>
              <span className="text-[10px] opacity-70">({counts.loja})</span>
            </TabsTrigger>
            <TabsTrigger value="formulario" className="text-xs flex-col gap-0.5 py-2">
              <span>📋 Forms</span>
              <span className="text-[10px] opacity-70">({counts.formulario})</span>
            </TabsTrigger>
            <TabsTrigger value="publicacao" className="text-xs flex-col gap-0.5 py-2">
              <span>📖 Posts</span>
              <span className="text-[10px] opacity-70">({counts.publicacao})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="flex-1 min-h-0 m-0 mt-3 px-4 pb-4 overflow-y-auto">
            <TabManual onSelect={handleSelect} />
          </TabsContent>
          <TabsContent value="loja" className="flex-1 min-h-0 m-0 mt-3 px-4 pb-4 overflow-hidden flex flex-col">
            <TabList tipo="loja" filterProduto={filterProduto} onSelect={handleSelect} placeholder="Buscar produto da loja..." showCategory />
          </TabsContent>
          <TabsContent value="formulario" className="flex-1 min-h-0 m-0 mt-3 px-4 pb-4 overflow-hidden flex flex-col">
            <TabList tipo="formulario" filterProduto={filterProduto} onSelect={handleSelect} />
          </TabsContent>
          <TabsContent value="publicacao" className="flex-1 min-h-0 m-0 mt-3 px-4 pb-4 overflow-hidden flex flex-col">
            <TabList tipo="publicacao" filterProduto={filterProduto} onSelect={handleSelect} placeholder={`Buscar em ${counts.publicacao || 591} publicações...`} limit={20} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

/* ───────────── Aba: Colar link ───────────── */

function TabManual({ onSelect }: { onSelect: (l: LinkPickerSelection) => void }) {
  const [url, setUrl] = useState('');
  const [titulo, setTitulo] = useState('');
  const [desc, setDesc] = useState('');
  const [save, setSave] = useState(false);
  const [saved, setSaved] = useState<Array<{ id: string; titulo: string; url: string; descricao: string | null; thumbnail_url: string | null }>>([]);
  const [loading, setLoading] = useState(false);

  const loadSaved = async () => {
    const { data } = await (supabase as any)
      .from('social_flow_links_manuais')
      .select('id, titulo, url, descricao, thumbnail_url')
      .order('created_at', { ascending: false })
      .limit(10);
    setSaved(data ?? []);
  };
  useEffect(() => { loadSaved(); }, []);

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from('social_flow_links_manuais').delete().eq('id', id);
    if (error) return toast.error(error.message);
    setSaved((s) => s.filter((x) => x.id !== id));
  };

  const insert = async () => {
    if (!url.trim() || !titulo.trim()) return toast.error('Preencha URL e texto do link');
    setLoading(true);
    try {
      if (save) {
        await (supabase as any).from('social_flow_links_manuais').insert({
          titulo: titulo.trim(), url: url.trim(), descricao: desc.trim() || null,
        });
      }
      onSelect({ url: url.trim(), titulo: titulo.trim(), tipo: 'manual', descricao: desc.trim() || undefined });
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      {saved.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground uppercase">Links salvos</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {saved.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent text-sm group">
                <button className="flex-1 text-left min-w-0" onClick={() => onSelect({ url: s.url, titulo: s.titulo, tipo: 'manual', thumbnail_url: s.thumbnail_url ?? undefined })}>
                  <div className="font-medium truncate">{s.titulo}</div>
                  <div className="text-xs text-muted-foreground truncate">{hostOf(s.url)}</div>
                </button>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => remove(s.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="border-t border-border my-2" />
        </div>
      )}

      <div>
        <Label className="text-xs">URL do link</Label>
        <div className="relative">
          <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="pl-8" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Texto do link</Label>
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Ver produto completo" />
      </div>
      <div>
        <Label className="text-xs">Descrição (opcional)</Label>
        <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Breve descrição do destino" rows={2} />
      </div>
      <div className="flex items-center justify-between rounded-md border border-border p-2.5">
        <Label className="text-xs cursor-pointer">Salvar para usar em outros fluxos</Label>
        <Switch checked={save} onCheckedChange={setSave} />
      </div>
      <Button onClick={insert} disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '✓ Inserir link'}
      </Button>
    </div>
  );
}

/* ───────────── Aba genérica (loja/forms/publicações) ───────────── */

function TabList({
  tipo, onSelect, filterProduto, placeholder, showCategory, limit = 50,
}: {
  tipo: 'loja' | 'formulario' | 'publicacao';
  onSelect: (l: LinkPickerSelection) => void;
  filterProduto?: string;
  placeholder?: string;
  showCategory?: boolean;
  limit?: number;
}) {
  const [busca, setBusca] = useState(filterProduto ?? '');
  const [categoria, setCategoria] = useState<string>('__all__');
  const [items, setItems] = useState<ViewRow[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(busca, 300);

  const hasSearch = tipo !== 'formulario';

  useEffect(() => {
    if (!showCategory) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('v_flow_link_picker')
        .select('categoria')
        .eq('tipo', 'loja')
        .not('categoria', 'is', null);
      const uniq = Array.from(new Set((data ?? []).map((r: any) => r.categoria).filter(Boolean))) as string[];
      setCats(uniq.sort());
    })();
  }, [showCategory]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      let q = (supabase as any)
        .from('v_flow_link_picker')
        .select('tipo, id, titulo, url, descricao, thumbnail_url, categoria, preco')
        .eq('tipo', tipo)
        .order('titulo')
        .limit(limit);
      if (hasSearch && debounced.trim()) {
        const term = debounced.trim();
        if (tipo === 'loja') q = q.or(`titulo.ilike.%${term}%,categoria.ilike.%${term}%`);
        else q = q.or(`titulo.ilike.%${term}%,descricao.ilike.%${term}%`);
      }
      if (showCategory && categoria !== '__all__') q = q.eq('categoria', categoria);
      const { data, error } = await q;
      if (error) toast.error(error.message);
      setItems((data ?? []) as ViewRow[]);
      setLoading(false);
    })();
  }, [tipo, debounced, categoria, limit, hasSearch, showCategory]);

  return (
    <>
      {hasSearch && (
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={placeholder} className="pl-8 h-9" />
          </div>
          {showCategory && cats.length > 0 && (
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 -mx-1">
        <div className="space-y-1 px-1">
          {loading && <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
          {!loading && items.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6">Nenhum item encontrado</div>
          )}
          {!loading && items.map((it) => (
            <button
              key={`${it.tipo}-${it.id}`}
              onClick={() => onSelect({ url: it.url, titulo: it.titulo, tipo: it.tipo, thumbnail_url: it.thumbnail_url ?? undefined, descricao: it.descricao ?? undefined })}
              className="w-full flex items-center gap-2.5 p-2 rounded-md hover:bg-accent text-left transition-colors"
            >
              <Thumb tipo={it.tipo} url={it.thumbnail_url} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium line-clamp-2 leading-tight">{it.titulo}</div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {tipo === 'publicacao' ? (
                    <span className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">Base de Conhecimento</Badge>
                    </span>
                  ) : hostOf(it.url)}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </ScrollArea>
    </>
  );
}

function Thumb({ tipo, url }: { tipo: LinkPickerTab; url?: string | null }) {
  const size = tipo === 'publicacao' ? 'w-11 h-11' : 'w-10 h-10';
  if (url) {
    return <img src={url} alt="" className={`${size} rounded object-cover bg-muted shrink-0`} loading="lazy" />;
  }
  const Icon = tipo === 'loja' ? ShoppingCart : tipo === 'formulario' ? ClipboardList : BookOpen;
  const tint = tipo === 'formulario' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground';
  return (
    <div className={`${size} rounded ${tint} flex items-center justify-center shrink-0`}>
      <Icon className="w-4 h-4" />
    </div>
  );
}