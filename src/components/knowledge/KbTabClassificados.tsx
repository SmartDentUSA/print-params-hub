import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, MapPin, PlusCircle, Search, Eye } from 'lucide-react';
import {
  CLASSIFIED_CATEGORIES, CLASSIFIED_CONDITIONS, UFS, categoryLabel, conditionLabel,
  firstImage, formatPrice, listingUrl, type PublicListing,
} from '@/lib/classifieds';

const PAGE_SIZE = 24;
const ALL = 'all';

/** Aba "Classificados" da Base de Conhecimento — anúncios aprovados de equipamentos usados. */
export default function KbTabClassificados() {
  const [items, setItems] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);

  const [term, setTerm] = useState('');
  const [category, setCategory] = useState(ALL);
  const [condition, setCondition] = useState(ALL);
  const [uf, setUf] = useState(ALL);
  const [order, setOrder] = useState('recent');

  const filtersKey = useMemo(
    () => [term, category, condition, uf, order].join('|'),
    [term, category, condition, uf, order],
  );

  async function fetchPage(from: number) {
    let q = (supabase as any)
      .from('v_classifieds_public')
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (category !== ALL) q = q.eq('category', category);
    if (condition !== ALL) q = q.eq('condition', condition);
    if (uf !== ALL) q = q.eq('location_state', uf);
    if (term.trim()) q = q.ilike('title', `%${term.trim()}%`);

    if (order === 'price_asc') q = q.order('price', { ascending: true, nullsFirst: false });
    else if (order === 'price_desc') q = q.order('price', { ascending: false, nullsFirst: false });
    else q = q.order('published_at', { ascending: false, nullsFirst: false });

    const { data } = await q;
    return (data ?? []) as PublicListing[];
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDone(false);
    const t = setTimeout(async () => {
      const rows = await fetchPage(0);
      if (cancelled) return;
      setItems(rows);
      setDone(rows.length < PAGE_SIZE);
      setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  async function loadMore() {
    setLoadingMore(true);
    const rows = await fetchPage(items.length);
    setItems((prev) => [...prev, ...rows]);
    setDone(rows.length < PAGE_SIZE);
    setLoadingMore(false);
  }

  return (
    <div className="kb-tab-classificados mx-auto w-full max-w-6xl px-3 pb-10 sm:px-6">
      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Scanners, impressoras 3D e fresadoras negociados diretamente entre profissionais.
          Anunciar é gratuito — clientes Smart Dent publicam na hora.
        </p>
        <Button asChild className="shrink-0">
          <Link to="/usados/meus-anuncios">
            <PlusCircle className="mr-2 h-4 w-4" /> Anunciar meu equipamento
          </Link>
        </Button>
      </div>

      <div className="sticky top-0 z-10 mb-4 space-y-3 rounded-xl border bg-background/95 p-3 backdrop-blur">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por modelo, marca..."
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as categorias</SelectItem>
              {CLASSIFIED_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Qualquer estado</SelectItem>
              {CLASSIFIED_CONDITIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todo o Brasil</SelectItem>
              {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={order} onValueChange={setOrder}>
            <SelectTrigger><SelectValue placeholder="Ordenar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="price_asc">Menor preço</SelectItem>
              <SelectItem value="price_desc">Maior preço</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum equipamento encontrado com esses filtros.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((l) => {
              const img = firstImage(l.images);
              return (
                <Link key={l.id} to={listingUrl(l.slug || l.id)} className="group">
                  <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-lg">
                    <div className="relative aspect-[4/3] bg-muted">
                      {img ? (
                        <img src={img} alt={l.title} loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Sem foto
                        </div>
                      )}
                      <Badge className="absolute left-2 top-2" variant="secondary">
                        {categoryLabel(l.category)}
                      </Badge>
                      {l.is_cliente && (
                        <Badge className="absolute right-2 top-2 bg-primary text-primary-foreground">
                          Cliente Smart Dent
                        </Badge>
                      )}
                    </div>
                    <CardContent className="space-y-2 p-4">
                      <h3 className="line-clamp-2 text-sm font-semibold">{l.title}</h3>
                      <p className="text-lg font-bold text-primary">{formatPrice(l.price)}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {l.location_city || '—'}{l.location_state ? `/${l.location_state}` : ''}
                        </span>
                        <span>{conditionLabel(l.condition)}</span>
                      </div>
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Eye className="h-3 w-3" /> {l.view_count ?? 0} visualizações
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
          {!done && (
            <div className="mt-6 text-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Carregar mais
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
