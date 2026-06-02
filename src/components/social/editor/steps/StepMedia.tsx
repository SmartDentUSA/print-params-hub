import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { MediaItemsEditor } from '../MediaItemsEditor';
import type { PostInput } from '@/lib/social/postSchema';

const PLATFORM_LIMITS: Record<string, { max: number; hint: string }> = {
  instagram: { max: 10, hint: 'Carrossel IG: até 10 fotos/vídeos' },
  facebook: { max: 10, hint: 'Até 10 itens' },
  tiktok: { max: 1, hint: '1 vídeo (até 10 min)' },
  youtube: { max: 1, hint: '1 vídeo (Shorts: vertical até 60s)' },
  pinterest: { max: 1, hint: '1 imagem ou vídeo' },
  reddit: { max: 1, hint: '1 mídia' },
};

interface Props {
  value: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
  onSplitIntoPosts?: (files: File[]) => void;
}

const CAROUSEL_SUPPORTED = ['instagram', 'facebook'];

export function StepMedia({ value, onChange, onSplitIntoPosts }: Props) {
  const perChannel = value.per_channel_media ?? {};
  const selectedPlatforms = Array.from(new Set(value.channels.map((c) => c.platform)));
  const customEnabled = Object.keys(perChannel).length > 0;
  const [showCustom, setShowCustom] = useState(customEnabled);
  const isCarousel = value.post_type === 'carousel' || value.media_items.length > 1;

  useEffect(() => {
    if (value.media_items.length > 1 && value.post_type !== 'carousel') {
      onChange({ post_type: 'carousel' });
    } else if (value.media_items.length <= 1 && value.post_type === 'carousel') {
      onChange({ post_type: 'feed' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.media_items.length]);

  useEffect(() => {
    if (!isCarousel) return;
    const filtered = value.channels.filter((c) => CAROUSEL_SUPPORTED.includes(c.platform));
    if (filtered.length !== value.channels.length) {
      onChange({ channels: filtered });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCarousel]);

  const toggleCustom = (on: boolean) => {
    setShowCustom(on);
    if (!on) onChange({ per_channel_media: {} });
  };

  const setForPlatform = (platform: string, items: PostInput['media_items']) => {
    const next = { ...perChannel };
    if (items.length === 0) delete next[platform];
    else next[platform] = items;
    onChange({ per_channel_media: next });
  };

  return (
    <div className="space-y-6">
      {isCarousel && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs flex items-start gap-2">
          <Info className="w-4 h-4 text-primary mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Modo carrossel ativo</p>
            <p className="text-muted-foreground">
              Disponível em Instagram e Facebook. Canais não compatíveis (TikTok, YouTube, Pinterest, Reddit) foram removidos automaticamente.
            </p>
          </div>
        </div>
      )}
      <div>
        <Label className="text-sm font-medium">Mídia padrão (todas as plataformas sem override)</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Para carrosséis do Instagram envie até 10 itens nesta lista.
        </p>
        <MediaItemsEditor
          items={value.media_items}
          onChange={(next) => onChange({ media_items: next })}
          maxItems={10}
          hint="Imagens ou vídeos (até 100MB cada)"
          onSplitIntoPosts={onSplitIntoPosts}
        />
      </div>

      {selectedPlatforms.length > 1 && (
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Customizar mídia por plataforma</Label>
              <p className="text-xs text-muted-foreground">
                Útil para TikTok vertical vs Instagram quadrado, por exemplo.
              </p>
            </div>
            <Switch checked={showCustom} onCheckedChange={toggleCustom} />
          </div>

          {showCustom && (
            <Tabs defaultValue={selectedPlatforms[0]}>
              <TabsList className="w-full justify-start flex-wrap h-auto">
                {selectedPlatforms.map((p) => (
                  <TabsTrigger key={p} value={p} className="capitalize">
                    {p}
                    {perChannel[p]?.length ? (
                      <Badge variant="secondary" className="ml-2">
                        {perChannel[p].length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
              {selectedPlatforms.map((p) => {
                const limit = PLATFORM_LIMITS[p];
                return (
                  <TabsContent key={p} value={p} className="mt-3">
                    <MediaItemsEditor
                      items={perChannel[p] ?? []}
                      onChange={(next) => setForPlatform(p, next)}
                      maxItems={limit?.max}
                      hint={limit?.hint}
                    />
                    {(perChannel[p]?.length ?? 0) === 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Sem override — usará a mídia padrão acima.
                      </p>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>
      )}
    </div>
  );
}