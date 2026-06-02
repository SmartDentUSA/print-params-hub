import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSocialPostsBank, BankFilters } from '@/hooks/social/useSocialPostsBank';
import { useZernioSync } from '@/hooks/social/useZernioSync';
import { SOCIAL_CHANNELS, SocialPlatform } from '@/lib/socialChannels';
import { SocialPostCard } from './SocialPostCard';

const PLATS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit'];

export function SocialPostsBank() {
  const [filters, setFilters] = useState<BankFilters>({ orderBy: 'recent' });
  const [selectedPlats, setSelectedPlats] = useState<SocialPlatform[]>([]);
  const [product, setProduct] = useState('');

  const effective = useMemo<BankFilters>(() => ({
    ...filters,
    platforms: selectedPlats.length ? selectedPlats : undefined,
    product: product || undefined,
  }), [filters, selectedPlats, product]);

  const { data: posts = [], isLoading } = useSocialPostsBank(effective);
  const { sync, syncing } = useZernioSync();

  const togglePlat = (p: SocialPlatform) =>
    setSelectedPlats((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Banco de Posts
            <Badge variant="outline">{posts.length}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">Posts sincronizados das redes sociais</p>
        </div>
        <Button variant="outline" onClick={sync} disabled={syncing}>
          <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
          {syncing ? 'Sincronizando…' : 'Sincronizar'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-3 rounded-md border border-border bg-card">
        <div className="flex flex-wrap gap-1">
          {PLATS.map((p) => {
            const meta = SOCIAL_CHANNELS[p];
            const active = selectedPlats.includes(p);
            return (
              <button key={p} onClick={() => togglePlat(p)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  active ? cn('text-white border-transparent', meta.colorClass)
                         : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
                )}>
                {meta.emoji} {meta.label}
              </button>
            );
          })}
        </div>
        <div className="h-6 w-px bg-border mx-1" />
        <Input
          placeholder="Produto…" value={product}
          onChange={(e) => setProduct(e.target.value)}
          className="w-40 h-8"
        />
        <Input
          type="date" value={filters.from ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
          className="w-36 h-8"
        />
        <Input
          type="date" value={filters.to ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
          className="w-36 h-8"
        />
        <Select value={filters.orderBy ?? 'recent'} onValueChange={(v) => setFilters((f) => ({ ...f, orderBy: v as BankFilters['orderBy'] }))}>
          <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
            <SelectItem value="likes">Mais curtidos</SelectItem>
            <SelectItem value="reach">Maior alcance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Carregando posts…</div>
      ) : posts.length === 0 ? (
        <div className="p-10 text-center border border-dashed border-border rounded-md">
          <p className="text-sm text-muted-foreground">Nenhum post no banco ainda.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={sync} disabled={syncing}>
            <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} /> Sincronizar agora
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((p: any) => <SocialPostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}