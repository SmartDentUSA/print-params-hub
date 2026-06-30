import { getCategoryColor } from './kbCategoryColors';
import { LanguageFlags } from '@/components/LanguageFlags';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

export interface KbContentCardData {
  id: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  createdAt: string;
  categoryLetter: string | null;
  categoryName: string | null;
  categoryTk?: string | null;
  durationSeconds?: number | null;
  viewCount?: number | null;
  shareUrl?: string;
}

interface Props {
  data: KbContentCardData;
  index: number;
  buttonLabel: string;
  onClick: () => void;
}

function formatDuration(sec: number): string {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return `${h}h ${m}min`;
  }
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

function formatViews(n: number | null | undefined): string {
  const v = typeof n === 'number' && n > 0 ? n : 0;
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return `${v}`;
}

export default function KbContentCard({ data, index, buttonLabel, onClick }: Props) {
  const cat = getCategoryColor(data.categoryLetter);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fallthrough */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!data.shareUrl) return;
    const url = data.shareUrl;
    // Try native share first (mobile); falls through to clipboard on failure or unsupported
    if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
      try {
        await (navigator as any).share({ title: data.title, url });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // user cancelled
        // otherwise fall back to clipboard
      }
    }
    const ok = await copyToClipboard(url);
    if (ok) toast.success('Link copiado!', { description: url });
    else toast.error('Não foi possível copiar o link');
  };

  const viewsText = formatViews(data.viewCount);

  return (
    <article className="kb-card" style={{ animationDelay: `${index * 22}ms` }}>
      <div className="kb-cthumb-wrap" onClick={onClick} role="button" tabIndex={0}>
        {data.imageUrl ? (
          <img className="kb-cthumb" src={data.imageUrl} alt={data.title} loading="lazy" />
        ) : (
          <div className="kb-cthumb kb-cthumb-fallback" style={{ background: cat.gradient }}>
            <span>{cat.emoji}</span>
          </div>
        )}
        {typeof data.durationSeconds === 'number' && data.durationSeconds > 0 && (
          <span className="kb-dur-badge">{formatDuration(data.durationSeconds)}</span>
        )}
      </div>
      <div className="kb-cbody">
        <div className="kb-meta">
          <span className="kb-cat-badge" style={{ background: cat.bgBadge, color: cat.color }}>
            {(data.categoryLetter || '?').toUpperCase()}
          </span>
          <span className="kb-cat-label" style={{ color: cat.color }}>{data.categoryName}</span>
        </div>
        <h3 className="kb-title">{data.title}</h3>
        {data.excerpt && <p className="kb-excerpt">{data.excerpt}</p>}
        <LanguageFlags size="sm" className="mt-2" />
        <div className="kb-cfoot">
          <span className="kb-date">
            {formatDate(data.createdAt)}
            <span style={{ marginLeft: 4, color: '#5F6368', fontWeight: 500 }}>· {viewsText} views</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {data.shareUrl && (
              <button
                type="button"
                onClick={handleShare}
                title="Compartilhar"
                style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#5F6368', display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}
              >
                <Share2 size={14} />
              </button>
            )}
            <button type="button" className="kb-action-btn" onClick={onClick}>{buttonLabel}</button>
          </div>
        </div>
      </div>
    </article>
  );
}