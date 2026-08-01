import { Info, Type, Ruler, Images, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CHANNEL_FORMAT_OPTIONS } from './ChannelFormatIcon';
import { CHANNEL_SPECS } from '@/lib/social/channelSpecs';
import type { PostInput } from '@/lib/social/postSchema';

/**
 * Mostra os requisitos (tamanho de imagem, proporção, nº de mídias, título
 * obrigatório e limite de legenda) de cada canal/formato selecionado.
 * Sempre visível quando há canais marcados — independente de já ter mídia.
 */
export function ChannelRequirementsPanel({ value }: { value: PostInput }) {
  const rows = value.channels
    .map((c) => {
      const opt = CHANNEL_FORMAT_OPTIONS.find(
        (o) => o.platform === c.platform && o.format === c.format,
      );
      if (!opt) return null;
      const spec = CHANNEL_SPECS[opt.key];
      if (!spec) return null;
      const missingTitle = !!spec.titleRequired && !c.title?.trim();
      return { opt, spec, missingTitle };
    })
    .filter(Boolean) as Array<{ opt: any; spec: any; missingTitle: boolean }>;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Requisitos dos canais selecionados</span>
        <Badge variant="outline" className="text-[10px] ml-auto">{rows.length} formato(s)</Badge>
      </div>
      <ul className="space-y-2">
        {rows.map(({ opt, spec, missingTitle }) => (
          <li key={opt.key} className="text-xs border-l-2 pl-2.5 py-0.5" style={{ borderLeftColor: opt.brandHex }}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">{opt.label} · {opt.format}</span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Ruler className="w-3 h-3" /> {spec.size} ({spec.aspect})
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Images className="w-3 h-3" /> {spec.maxMedia === 0 ? 'sem mídia' : `até ${spec.maxMedia} item(ns)`}
              </span>
              {spec.captionLimit && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Type className="w-3 h-3" /> legenda até {spec.captionLimit} caracteres
                </span>
              )}
              {spec.titleRequired && (
                <Badge
                  variant={missingTitle ? 'destructive' : 'secondary'}
                  className="text-[10px] inline-flex items-center gap-1"
                >
                  {missingTitle && <AlertCircle className="w-3 h-3" />}
                  Título obrigatório
                </Badge>
              )}
            </div>
            {spec.note && <p className="text-[11px] text-muted-foreground mt-0.5">{spec.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
