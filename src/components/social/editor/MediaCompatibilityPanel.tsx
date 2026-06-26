import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useMediaAspects } from '@/hooks/social/useMediaAspects';
import { findCompatIssues, aspectLabel } from '@/lib/social/mediaCompat';
import { CHANNEL_FORMAT_OPTIONS } from './ChannelFormatIcon';
import type { PostInput } from '@/lib/social/postSchema';

/**
 * Mostra alertas quando a mídia anexada não bate com a proporção exigida
 * pelos canais selecionados. Evita o erro "Aspect ratio is outside range"
 * do Zernio (Instagram Feed rejeita imagens verticais 9:16, por exemplo).
 */
export function MediaCompatibilityPanel({ value }: { value: PostInput }) {
  const aspects = useMediaAspects(value.media_items);
  if (aspects.length === 0 || value.channels.length === 0) return null;

  const selected = value.channels
    .map((c) => {
      const opt = CHANNEL_FORMAT_OPTIONS.find(
        (o) => o.platform === c.platform && o.format === c.format,
      );
      return opt ? { key: opt.key, label: opt.label } : null;
    })
    .filter(Boolean) as Array<{ key: any; label: string }>;

  const issues = findCompatIssues(selected, aspects);

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
          Proporção compatível com todos os canais selecionados
        </span>
        <span className="ml-auto text-muted-foreground">
          {aspects.map((a) => aspectLabel(a.width, a.height)).join(' · ')}
        </span>
      </div>
    );
  }

  // Agrupa por canal
  const byChannel = new Map<string, typeof issues>();
  for (const i of issues) {
    const arr = byChannel.get(i.label) ?? [];
    arr.push(i);
    byChannel.set(i.label, arr);
  }

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-sm font-semibold text-amber-900 dark:text-amber-300">
          Imagem incompatível com {byChannel.size} canal(is)
        </span>
      </div>
      <ul className="space-y-1.5 text-xs">
        {Array.from(byChannel.entries()).map(([label, list]) => {
          const first = list[0];
          return (
            <li key={label} className="flex items-start gap-2">
              <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-300 shrink-0">
                {label}
              </Badge>
              <span className="text-foreground/80">
                detectada <strong>{first.detected}</strong> · esperado{' '}
                <strong>{first.rule.ideal ?? `${first.rule.min}–${first.rule.max}`}</strong>
                {first.rule.fixHint && ` — ${first.rule.fixHint}.`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
        O Zernio rejeita o post inteiro se um canal recusar. Remova o canal incompatível ou
        substitua a mídia antes de publicar.
      </p>
    </div>
  );
}