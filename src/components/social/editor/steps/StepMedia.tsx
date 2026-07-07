import { useEffect, useMemo, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Info, GripVertical, X, Pin, Sparkles, Loader2, Image as ImageIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { MediaItemsEditor } from '../MediaItemsEditor';
import { MediaCompatibilityPanel } from '../MediaCompatibilityPanel';
import type { PostInput } from '@/lib/social/postSchema';
import { presetForPlatform, IMAGE_PRESETS, type ImagePresetId } from '@/lib/social/imagePresets';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  carrosselImages?: string[];
  onCarrosselReorder?: (next: string[]) => void;
  onCarrosselRemove?: (url: string) => void;
}

const CAROUSEL_SUPPORTED = ['instagram', 'facebook'];

function AIImagePanel({
  value,
  onChange,
}: {
  value: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const platform = value.channels?.[0]?.platform || 'instagram';
  const recommended = useMemo(() => presetForPlatform(platform), [platform]);
  const [presetId, setPresetId] = useState<ImagePresetId>(recommended.id as ImagePresetId);
  useEffect(() => { setPresetId(recommended.id as ImagePresetId); }, [recommended.id]);
  const preset = IMAGE_PRESETS[presetId];

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error('Descreva a imagem que deseja gerar');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-generate-image', {
        body: {
          prompt,
          product_name: value.product_name || undefined,
          platform,
          preset_id: preset.id,
          aspect: preset.aspect === '1:1' ? 'square' : preset.aspect === '16:9' ? 'horizontal' : 'vertical',
          width: preset.width,
          height: preset.height,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok || !data?.url) {
        throw new Error(data?.error || data?.details || 'Falha ao gerar imagem');
      }
      onChange({
        media_items: [...value.media_items, { url: data.url, type: 'image' as const, path: data.path }],
      });
      toast.success('Imagem gerada e adicionada à mídia');
      setPrompt('');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao gerar imagem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold">Gerar imagem por IA</Label>
          <Badge variant="outline" className="text-[10px]">Poe · Nano-Banana</Badge>
          {value.product_name && (
            <Badge variant="secondary" className="text-[10px] ml-auto">
              Produto: {value.product_name}
            </Badge>
          )}
        </div>
        <Textarea
          rows={3}
          placeholder="Ex.: cena minimalista de uma impressora 3D dental sobre bancada de mármore com iluminação azul suave, foco em precisão e fluxo digital"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={presetId} onValueChange={(v) => setPresetId(v as ImagePresetId)} disabled={loading}>
            <SelectTrigger className="w-72 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(IMAGE_PRESETS).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label} — {p.width}×{p.height}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" onClick={generate} disabled={loading} className="ml-auto">
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-1" /> Gerar imagem</>
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {preset.note} Recomendado para <strong>{platform}</strong>. Gerada por Nano-Banana (Poe) e salva no Storage.
        </p>
      </CardContent>
    </Card>
  );
}

function ProductImagesPanel({
  value,
  onChange,
}: {
  value: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
}) {
  const [images, setImages] = useState<Array<{ url: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  const slugs = useMemo(() => {
    const all = [value.product_slug, ...(value.extra_products || []).map((e) => e.slug)].filter(Boolean) as string[];
    return Array.from(new Set(all));
  }, [value.product_slug, value.extra_products]);

  const names = useMemo(() => {
    const all = [value.product_name, ...(value.extra_products || []).map((e) => e.name)].filter(Boolean) as string[];
    return Array.from(new Set(all));
  }, [value.product_name, value.extra_products]);

  useEffect(() => {
    let mounted = true;
    if (slugs.length === 0 && names.length === 0) {
      setImages([]);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        let q = supabase
          .from('system_a_catalog')
          .select('name, slug, image_url, og_image_url')
          .eq('active', true)
          .limit(20);
        if (slugs.length) {
          q = q.in('slug', slugs);
        } else if (names.length) {
          q = q.or(names.map((n) => `name.ilike.%${n.replace(/[%_,]/g, '')}%`).join(','));
        }
        const { data } = await q;
        if (!mounted) return;
        const list: Array<{ url: string; name: string }> = [];
        for (const r of (data || []) as any[]) {
          const u = r.image_url || r.og_image_url;
          if (u) list.push({ url: u, name: r.name });
        }
        setImages(list);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slugs.join('|'), names.join('|')]);

  const addImage = (url: string) => {
    if (value.media_items.some((m) => m.url === url)) {
      toast.info('Imagem já adicionada');
      return;
    }
    onChange({ media_items: [...value.media_items, { url, type: 'image' as const }] });
    toast.success('Imagem do produto adicionada');
  };

  if (slugs.length === 0 && names.length === 0) return null;

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-emerald-600" />
          <Label className="text-sm font-semibold">Imagens dos produtos selecionados</Label>
          {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          <Badge variant="outline" className="text-[10px] ml-auto">{images.length} disponível(eis)</Badge>
        </div>
        {!loading && images.length === 0 && (
          <p className="text-[11px] text-muted-foreground">Nenhuma imagem encontrada no catálogo para os produtos selecionados.</p>
        )}
        {images.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {images.map((img) => (
              <button
                key={img.url}
                type="button"
                onClick={() => addImage(img.url)}
                className="group relative aspect-square border rounded-md overflow-hidden bg-muted hover:ring-2 hover:ring-emerald-500/50"
                title={`Adicionar ${img.name}`}
              >
                <img src={img.url} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <span className="absolute bottom-0 inset-x-0 px-1 py-0.5 text-[9px] bg-black/60 text-white truncate">
                  {img.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CarrosselSortableCard({
  url,
  index,
  onRemove,
}: {
  url: string;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group border rounded-md overflow-hidden bg-muted w-[120px] h-[120px] shrink-0"
    >
      <img src={url} alt={`Slide ${index + 1}`} className="w-full h-full object-cover" />
      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-600 text-white font-semibold">
        {index + 1}
      </span>
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute bottom-1 left-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        aria-label="Reordenar"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <Button
        size="icon"
        variant="destructive"
        className="absolute top-1 right-1 h-6 w-6"
        onClick={onRemove}
        aria-label="Remover"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

export function StepMedia({
  value,
  onChange,
  onSplitIntoPosts,
  carrosselImages = [],
  onCarrosselReorder,
  onCarrosselRemove,
}: Props) {
  const perChannel = value.per_channel_media ?? {};
  const selectedPlatforms = Array.from(new Set(value.channels.map((c) => c.platform)));
  const customEnabled = Object.keys(perChannel).length > 0;
  const [showCustom, setShowCustom] = useState(customEnabled);
  const totalMediaCount = carrosselImages.length + value.media_items.length;
  const isCarousel = value.post_type === 'carousel' || totalMediaCount > 1;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (totalMediaCount > 1 && value.post_type !== 'carousel') {
      onChange({ post_type: 'carousel' });
    } else if (totalMediaCount <= 1 && value.post_type === 'carousel') {
      onChange({ post_type: 'feed' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMediaCount]);

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

  const handleCarrosselDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = carrosselImages.indexOf(String(active.id));
    const newIndex = carrosselImages.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onCarrosselReorder?.(arrayMove(carrosselImages, oldIndex, newIndex));
  };

  return (
    <div className="space-y-6">
      {carrosselImages.length > 0 && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-emerald-600" />
            <Label className="text-sm font-semibold">📌 Imagens do Carrossel</Label>
            <Badge variant="outline" className="text-[10px]">{carrosselImages.length}</Badge>
            <span className="text-[11px] text-muted-foreground ml-auto">
              Arraste para reordenar — publicadas antes dos uploads manuais
            </span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCarrosselDragEnd}>
            <SortableContext items={carrosselImages} strategy={rectSortingStrategy}>
              <div className="flex flex-wrap gap-2">
                {carrosselImages.map((url, i) => (
                  <CarrosselSortableCard
                    key={url}
                    url={url}
                    index={i}
                    onRemove={() => onCarrosselRemove?.(url)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

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
        <div className="space-y-3 mb-3">
          <ProductImagesPanel value={value} onChange={onChange} />
          <AIImagePanel value={value} onChange={onChange} />
        </div>
        <MediaItemsEditor
          items={value.media_items}
          onChange={(next) => onChange({ media_items: next })}
          maxItems={10}
          hint="Imagens ou vídeos (até 500MB cada)"
          onSplitIntoPosts={onSplitIntoPosts}
        />
        {value.media_items.length > 0 && value.channels.length > 0 && (
          <div className="mt-3">
            <MediaCompatibilityPanel value={value} />
          </div>
        )}
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