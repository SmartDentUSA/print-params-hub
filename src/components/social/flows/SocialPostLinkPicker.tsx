import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Instagram, Youtube, Facebook, Music2, Image as ImgIcon } from 'lucide-react';
import { toast } from 'sonner';

export type SocialPickerPlatform = 'instagram' | 'youtube' | 'facebook' | 'tiktok';

export interface SocialPostPickResult {
  url: string;
  titulo: string;
  thumbnail_url?: string;
  caption?: string;
  platform: SocialPickerPlatform | string;
  post_id?: string;
  source: 'accounts' | 'product';
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (post: SocialPostPickResult) => void;
  /** Restringe por plataforma. Omitir para mostrar todas. */
  platform?: SocialPickerPlatform;
  /** Slug do produto vinculado ao flow para a aba "Do produto". */
  produtoSlug?: string;
}

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  tiktok: Music2,
};

function useDebounced<T>(v: T, ms = 250) {
  const [s, setS] = useState(v);
  useEffect(() => { const t = setTimeout(() => setS(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return s;
}

function shortCaption(c?: string | null, n = 140) {
  if (!c) return '';
  const t = c.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

function platformLabel(p?: string) {
  switch (p) {
    case 'instagram': return 'Instagram';
    case 'youtube': return 'YouTube';
    case 'facebook': return 'Facebook';
    case 'tiktok': return 'TikTok';
    default: return p ?? '';
  }
}

export function SocialPostLinkPicker({ open, onOpenChange, onSelect, platform, produtoSlug }: Props) {
  const [tab, setTab] = useState<'accounts' | 'product'>('accounts');

  useEffect(() => {
    if (open) setTab(produtoSlug ? 'accounts' : 'accounts');
  }, [open, produtoSlug]);

  const handle = (p: SocialPostPickResult) => {
    onSelect(p);
    onOpenChange(false);
  };

  const title = platform
    ? `Selecionar publicação de ${platformLabel(platform)}`
    : 'Selecionar publicação';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:max-w-[440px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            {platform && PLATFORM_ICONS[platform] ? (
              (() => { const I = PLATFORM_ICONS[platform]; return <I className="w-4 h-4 text-primary" />; })()
            ) : <ImgIcon className="w-4 h-4 text-primary" />}
            {title}
          </SheetTitle>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-2 mx-3 mt-3 h-auto bg-muted/40">
            <TabsTrigger value="accounts" className="text-xs py-2">📱 Minhas contas</TabsTrigger>
            <TabsTrigger value="product" className="text-xs py-2" disabled={!produtoSlug}>
              📦 Do produto {produtoSlug ? '' : '(vazio)'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="flex-1 min-h-0 m-0 mt-3 px-3 pb-3 overflow-hidden flex flex-col">
            <AccountsTab platform={platform} onSelect={handle} />
          </TabsContent>
          <TabsContent value="product" className="flex-1 min-h-0 m-0 mt-3 px-3 pb-3 overflow-hidden flex flex-col">
            {produtoSlug && <ProductTab slug={produtoSlug} platform={platform} onSelect={handle} />}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

/* ────────────── Aba: Minhas contas (social_posts) ────────────── */

interface AccountRow {
  id: string;
  caption: string | null;
  post_url: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  platform: string | null;
  published_at: string | null;
}

function AccountsTab({ platform, onSelect }: { platform?: SocialPickerPlatform; onSelect: (p: SocialPostPickResult) => void }) {
  const [busca, setBusca] = useState('');
  const [items, setItems] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(busca, 300);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = (supabase as any)
        .from('social_posts')
        .select('id, caption, post_url, thumbnail_url, media_url, platform, published_at')
        .not('post_url', 'is', null)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(60);
      if (platform) q = q.eq('platform', platform);
      if (debounced.trim()) q = q.ilike('caption', `%${debounced.trim()}%`);
      const { data, error } = await q;
      if (error) toast.error(error.message);
      setItems((data ?? []) as AccountRow[]);
      setLoading(false);
    })();
  }, [platform, debounced]);

  return (
    <>
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na legenda..." className="pl-8 h-9" />
      </div>
      <ScrollArea className="flex-1 -mx-1">
        <div className="space-y-1.5 px-1">
          {loading && <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
          {!loading && items.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhuma publicação sincronizada{platform ? ` em ${platformLabel(platform)}` : ''}.
              <div className="text-xs mt-1 opacity-70">Rode o sync de contas (Zernio) para popular.</div>
            </div>
          )}
          {!loading && items.map((it) => {
            const I = PLATFORM_ICONS[it.platform ?? ''] ?? ImgIcon;
            const thumb = it.thumbnail_url ?? it.media_url ?? undefined;
            const caption = it.caption ?? '';
            const firstLine = caption.split('\n').map(s => s.trim()).filter(Boolean)[0] ?? 'Publicação sem legenda';
            return (
              <button
                key={it.id}
                onClick={() => onSelect({
                  url: it.post_url!,
                  titulo: shortCaption(firstLine, 60) || platformLabel(it.platform ?? '') || 'Publicação',
                  thumbnail_url: thumb,
                  caption,
                  platform: it.platform ?? '',
                  post_id: it.id,
                  source: 'accounts',
                })}
                className="w-full flex gap-2.5 p-2 rounded-md text-left hover:bg-accent transition-colors"
              >
                {thumb ? (
                  <img src={thumb} alt="" loading="lazy" className="w-14 h-14 rounded object-cover bg-muted shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded bg-muted flex items-center justify-center shrink-0">
                    <I className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 capitalize">{it.platform ?? '—'}</Badge>
                    {it.published_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(it.published_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm leading-tight line-clamp-3">{shortCaption(caption, 200) || firstLine}</div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );
}

/* ────────────── Aba: Do produto (knowledge-export-full) ────────────── */

interface ProductVideo { url: string; title?: string; description?: string; thumbnail?: string }

function ProductTab({ slug, platform, onSelect }: { slug: string; platform?: SocialPickerPlatform; onSelect: (p: SocialPostPickResult) => void }) {
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<{ platform: SocialPickerPlatform; items: ProductVideo[] }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-export-full', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 200 }),
        });
        const json = await res.json();
        const prod = (json?.products ?? []).find((p: any) => p?.slug === slug || (p?.slug ?? '').endsWith('/' + slug));
        const v = prod?.videos ?? {};
        const buckets: { platform: SocialPickerPlatform; items: ProductVideo[] }[] = [];
        const wanted: SocialPickerPlatform[] = platform ? [platform] : ['instagram', 'youtube', 'tiktok', 'facebook'];
        for (const p of wanted) {
          if (Array.isArray(v[p]) && v[p].length) buckets.push({ platform: p, items: v[p] });
        }
        if (!cancelled) setVideos(buckets);
      } catch (e: any) {
        if (!cancelled) toast.error('Falha ao buscar do Sistema A: ' + (e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, platform]);

  const total = useMemo(() => videos.reduce((s, b) => s + b.items.length, 0), [videos]);

  return (
    <ScrollArea className="flex-1 -mx-1">
      <div className="space-y-3 px-1">
        {loading && <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
        {!loading && total === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhum vídeo/post deste produto retornado pelo Sistema A.
          </div>
        )}
        {!loading && videos.map((b) => {
          const I = PLATFORM_ICONS[b.platform] ?? ImgIcon;
          return (
            <div key={b.platform}>
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <I className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase text-muted-foreground">{platformLabel(b.platform)}</span>
                <span className="text-[10px] text-muted-foreground">({b.items.length})</span>
              </div>
              <div className="space-y-1.5">
                {b.items.map((it, i) => {
                  const firstLine = (it.title || it.description || '').split('\n').map(s => s.trim()).filter(Boolean)[0] ?? 'Publicação';
                  return (
                    <button
                      key={`${b.platform}-${i}-${it.url}`}
                      onClick={() => onSelect({
                        url: it.url,
                        titulo: shortCaption(firstLine, 60),
                        thumbnail_url: it.thumbnail || undefined,
                        caption: it.description || it.title || '',
                        platform: b.platform,
                        source: 'product',
                      })}
                      className="w-full flex gap-2.5 p-2 rounded-md text-left hover:bg-accent transition-colors"
                    >
                      {it.thumbnail ? (
                        <img src={it.thumbnail} alt="" loading="lazy" className="w-14 h-14 rounded object-cover bg-muted shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded bg-muted flex items-center justify-center shrink-0">
                          <I className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm leading-tight line-clamp-3">{shortCaption(it.description || it.title || firstLine, 200)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default SocialPostLinkPicker;