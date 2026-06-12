import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useSocialPostsBank, BankFilters } from '@/hooks/social/useSocialPostsBank';
import { useZernioSync } from '@/hooks/social/useZernioSync';
import { SOCIAL_CHANNELS, SOCIAL_BRAND_HEX, SocialPlatform } from '@/lib/socialChannels';
import { SocialPostCard } from './SocialPostCard';

const PLATS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'youtube', 'pinterest', 'reddit'];
const FORMATS: { value: string; label: string }[] = [
  { value: 'all',      label: 'Todos formatos' },
  { value: 'feed',     label: 'Feed' },
  { value: 'reel',     label: 'Reel' },
  { value: 'story',    label: 'Story' },
  { value: 'video',    label: 'Vídeo' },
  { value: 'carousel', label: 'Carrossel' },
];
const PERIODS: { value: string; label: string; days: number | null }[] = [
  { value: '7',   label: 'Última semana', days: 7 },
  { value: '30',  label: 'Último mês',    days: 30 },
  { value: '90',  label: '3 meses',       days: 90 },
  { value: 'all', label: 'Tudo',          days: null },
];

export function SocialPostsBank() {
  const [filters, setFilters] = useState<BankFilters>({ orderBy: 'recent' });
  const [selectedPlats, setSelectedPlats] = useState<SocialPlatform[]>([]);
  const [product, setProduct] = useState('');
  const [format, setFormat] = useState<string>('all');
  const [period, setPeriod] = useState<string>('all');

  const effective = useMemo<BankFilters>(() => {
    const next: BankFilters = {
      ...filters,
      platforms: selectedPlats.length ? selectedPlats : undefined,
      product: product || undefined,
      format: format !== 'all' ? format : undefined,
    };
    const cfg = PERIODS.find((p) => p.value === period);
    if (cfg?.days) {
      next.from = new Date(Date.now() - cfg.days * 86400000).toISOString();
      next.to = new Date().toISOString();
    } else {
      next.from = undefined;
      next.to = undefined;
    }
    return next;
  }, [filters, selectedPlats, product, format, period]);

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
            const brand = SOCIAL_BRAND_HEX[p];
            return (
              <button key={p} onClick={() => togglePlat(p)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  active
                    ? 'text-white border-transparent shadow-sm'
                    : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
                )}
                style={active ? { backgroundColor: brand, borderColor: brand } : undefined}>
                {meta.emoji} {meta.label}
              </button>
            );
          })}
          {selectedPlats.length > 0 && (
            <button
              onClick={() => setSelectedPlats([])}
              className="px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Limpar ({selectedPlats.length})
            </button>
          )}
        </div>
        <div className="h-6 w-px bg-border mx-1" />
        <Input
          placeholder="Buscar legenda ou produto…" value={product}
          onChange={(e) => setProduct(e.target.value)}
          className="w-56 h-8"
        />
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-border rounded-md overflow-hidden bg-card">
              <Skeleton className="aspect-square w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-lg bg-card flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Inbox className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-base font-medium">Nenhum post sincronizado ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Conecte sua conta na Zernio e sincronize para ver seus posts publicados aqui.
            </p>
          </div>
          <Button onClick={sync} disabled={syncing} className="mt-2">
            <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} /> Sincronizar agora
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