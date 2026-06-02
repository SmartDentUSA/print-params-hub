import { Heart, MessageCircle, Eye, Link as LinkIcon, Image as ImageIcon, Layers, Video, Film } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  normalizePlatform, SOCIAL_CHANNELS, SOCIAL_BRAND_HEX,
  aspectRatioFor, classifyFormat,
} from '@/lib/socialChannels';

function fmtNumber(n?: number | null): string {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function relativeDate(iso?: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d}d`;
  if (d < 30) return `há ${Math.floor(d / 7)}sem`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function SocialPostCard({ post }: { post: any }) {
  const plat = normalizePlatform(post.platform);
  const meta = plat ? SOCIAL_CHANNELS[plat] : null;
  const brandHex = plat ? SOCIAL_BRAND_HEX[plat] : '#888';
  const fmtClass = classifyFormat(post.format);
  const isCarousel = fmtClass === 'carousel' || (Array.isArray(post.media) && post.media.length > 1);
  const formatIcon = fmtClass === 'reel' || fmtClass === 'short' ? Film
                   : fmtClass === 'video' ? Video
                   : isCarousel ? Layers
                   : ImageIcon;
  const FormatIcon = formatIcon;
  const thumb = post.thumbnail_url || post.media_url;
  const link = post.short_link || post.post_url;

  const copyLink = async () => {
    if (!link) return toast.error('Sem link disponível');
    await navigator.clipboard.writeText(link);
    toast.success('Link copiado');
  };

  return (
    <Card className="overflow-hidden group transition-shadow hover:shadow-medium">
      <div
        className="relative bg-muted overflow-hidden"
        style={{ aspectRatio: aspectRatioFor(post.format) }}
      >
        {thumb ? (
          <img src={thumb} alt={post.caption ?? ''} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-2"
            style={{ background: `linear-gradient(135deg, ${brandHex}1f, ${brandHex}0a)` }}
          >
            <FormatIcon className="w-10 h-10" style={{ color: brandHex }} aria-hidden />
            <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: brandHex }}>
              {meta?.label ?? 'social'} · {post.format ?? 'sem mídia'}
            </span>
          </div>
        )}
        {meta && (
          <span
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-sm"
            style={{ backgroundColor: brandHex }}
          >
            {meta.emoji} {meta.label}
          </span>
        )}
        {post.format && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/60 text-white backdrop-blur-sm">
            {post.format}
          </span>
        )}
        {isCarousel && (
          <span className="absolute bottom-2 right-2 p-1 rounded bg-black/60 text-white">
            <Layers className="w-3 h-3" />
          </span>
        )}
        {link && (
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={copyLink}>
              <LinkIcon className="w-3 h-3" /> Copiar link
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <a href={link} target="_blank" rel="noreferrer">Abrir</a>
            </Button>
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="text-sm line-clamp-2 min-h-[2.5rem]">
          {post.caption || <span className="italic text-muted-foreground">Sem legenda</span>}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1" title="Curtidas"><Heart className="w-3 h-3" />{fmtNumber(post.likes)}</span>
          <span className="flex items-center gap-1" title="Comentários"><MessageCircle className="w-3 h-3" />{fmtNumber(post.comments)}</span>
          <span className="flex items-center gap-1" title="Alcance"><Eye className="w-3 h-3" />{fmtNumber(post.reach ?? post.views)}</span>
          <span className="ml-auto" title={post.published_at ?? ''}>{relativeDate(post.published_at)}</span>
        </div>
      </div>
    </Card>
  );
}