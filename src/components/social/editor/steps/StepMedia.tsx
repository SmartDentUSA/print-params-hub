import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
}

export function StepMedia({ value, onChange }: Props) {
  const perChannel = value.per_channel_media ?? {};
  const selectedPlatforms = Array.from(new Set(value.channels.map((c) => c.platform)));
  const customEnabled = Object.keys(perChannel).length > 0;
  const [showCustom, setShowCustom] = useState(customEnabled);

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