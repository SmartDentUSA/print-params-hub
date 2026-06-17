import { getCategoryColor } from './kbCategoryColors';
import { LanguageFlags } from '@/components/LanguageFlags';
import { Share2 } from 'lucide-react';

export interface KbContentCardData {
  id: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  createdAt: string;
  categoryLetter: string | null;
  categoryName: string | null;
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

function formatViews(n: number | null | undefined): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

export default function KbContentCard({ data, index, buttonLabel, onClick }: Props) {
  const cat = getCategoryColor(data.categoryLetter);
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
          <span className="kb-date">{formatDate(data.createdAt)}</span>
          <button type="button" className="kb-action-btn" onClick={onClick}>{buttonLabel}</button>
        </div>
      </div>
    </article>
  );
}