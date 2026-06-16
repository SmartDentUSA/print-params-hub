import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Save, AlertCircle, Lock, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { defaultPost, postSchema, type PostInput } from '@/lib/social/postSchema';
import { useCreateScheduledPost } from '@/hooks/social/useCreateScheduledPost';
import { useUpdateScheduledPost } from '@/hooks/social/useUpdateScheduledPost';
import { useScheduledPost } from '@/hooks/social/useScheduledPost';
import { useMediaUpload } from '@/hooks/social/useMediaUpload';
import type { MediaItem } from '@/lib/social/postSchema';
import { StepContent } from './steps/StepContent';
import { StepMedia } from './steps/StepMedia';
import { StepChannels } from './steps/StepChannels';
import { StepSchedule } from './steps/StepSchedule';
import { StepReview } from './steps/StepReview';
import { SocialPostPreview } from './SocialPostPreview';
import type { SystemACarousel } from '@/hooks/social/useSystemACarousels';

const STEPS = [
  { id: 0, label: 'Conteúdo' },
  { id: 1, label: 'Mídia' },
  { id: 2, label: 'Canais' },
  { id: 3, label: 'Agendamento' },
  { id: 4, label: 'Revisão' },
] as const;

const SUPABASE_PUBLIC_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://okeogjgqijbfkudfjadz.supabase.co';

export function SocialPostEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const { data: loaded, isLoading: loadingPost } = useScheduledPost(id);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<PostInput>(defaultPost);
  const [hydrated, setHydrated] = useState(false);
  const { save, saveMany, saving } = useCreateScheduledPost();
  const { save: update, saving: updating } = useUpdateScheduledPost();
  const { upload, uploading } = useMediaUpload();
  const [splitQueue, setSplitQueue] = useState<MediaItem[] | null>(null);

  // ---- Carrossel recebido do Sistema A (via query params) ----
  const carrosselSource = searchParams.get('source');
  const carrosselRef = searchParams.get('ref') ?? '';
  const carrosselProdutoSlug = searchParams.get('produto') ?? '';
  const carrosselTipo = searchParams.get('tipo') ?? '';
  const carrosselTotalRaw = parseInt(searchParams.get('total') ?? '0', 10);
  const carrosselTotal = Number.isFinite(carrosselTotalRaw)
    ? Math.max(0, Math.min(20, carrosselTotalRaw))
    : 0;
  const isCarrosselMode = carrosselSource === 'carrossel' && !!carrosselRef && carrosselTotal > 0;

  const carrosselSlides = useMemo(() => {
    if (!isCarrosselMode) return [] as string[];
    const cleanRef = carrosselRef.replace(/^\/+|\/+$/g, '');
    return Array.from({ length: carrosselTotal }, (_, i) =>
      `${SUPABASE_PUBLIC_URL}/storage/v1/object/public/wa-media/${cleanRef}/slide-${i}.png`,
    );
  }, [isCarrosselMode, carrosselRef, carrosselTotal]);

  const [selectedCarrosselImages, setSelectedCarrosselImages] = useState<string[]>([]);
  const [pickedCarrouselRef, setPickedCarrouselRef] = useState<string | undefined>(undefined);

  const toggleCarrosselImage = (url: string) => {
    setSelectedCarrosselImages((cur) =>
      cur.includes(url) ? cur.filter((u) => u !== url) : [...cur, url],
    );
  };
  const selectAllCarrossel = () => setSelectedCarrosselImages(carrosselSlides);
  const clearCarrossel = () => {
    setSelectedCarrosselImages([]);
    setPickedCarrouselRef(undefined);
  };
  const reorderCarrossel = (next: string[]) => setSelectedCarrosselImages(next);
  const removeCarrossel = (url: string) =>
    setSelectedCarrosselImages((cur) => cur.filter((u) => u !== url));

  const pickSystemACarousel = (c: SystemACarousel) => {
    setSelectedCarrosselImages(c.slides);
    setPickedCarrouselRef(c.ref);
    onChange({ post_type: 'carousel' });
  };

  const carrosselAsMedia: MediaItem[] = useMemo(
    () => selectedCarrosselImages.map((url) => ({ url, type: 'image' as const })),
    [selectedCarrosselImages],
  );

  // valor efetivo do post (mídia = carrossel + uploads manuais)
  const effectiveData: PostInput = useMemo(
    () => ({ ...data, media_items: [...carrosselAsMedia, ...data.media_items] }),
    [data, carrosselAsMedia],
  );

  useEffect(() => {
    if (loaded && !hydrated) {
      setData(loaded.data);
      setHydrated(true);
    }
  }, [loaded, hydrated]);

  const editable = !isEdit || (loaded && ['scheduled', 'failed', 'draft'].includes(loaded.status));
  const readOnly = isEdit && !!loaded && !editable;

  const onChange = (patch: Partial<PostInput>) => setData((d) => ({ ...d, ...patch }));

  const validation = useMemo(() => postSchema.safeParse(effectiveData), [effectiveData]);
  const issuesByStep = useMemo(() => {
    const map: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const key = issue.path[0];
        if (key === 'caption' || key === 'hashtags' || key === 'first_comment') map[0].push(issue.message);
        else if (key === 'media_items') map[1].push(issue.message);
        else if (key === 'channels') map[2].push(issue.message);
        else if (key === 'scheduled_at' || key === 'publish_now' || key === 'timezone') map[3].push(issue.message);
      }
    }
    return map;
  }, [validation]);

  const canAdvance = issuesByStep[step].length === 0;

  const handleSave = async () => {
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? 'Verifique os campos');
      return;
    }
    if (isEdit && id) {
      await update(id, validation.data);
    } else if (splitQueue && splitQueue.length > 0) {
      const drafts: PostInput[] = splitQueue.map((m) => ({
        ...validation.data,
        media_items: [m],
        per_channel_media: {},
        post_type: 'feed',
      }));
      await saveMany(drafts);
    } else {
      await save(validation.data);
    }
  };

  const handleSplitIntoPosts = async (files: File[]) => {
    const uploaded = await upload(files);
    if (!uploaded.length) return;
    setSplitQueue(uploaded);
    onChange({ media_items: [uploaded[0]], post_type: 'feed' });
    toast.success(`${uploaded.length} mídias enfileiradas. Será criado 1 post por mídia ao agendar.`);
  };

  if (isEdit && loadingPost) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Carregando post…</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Editar Post' : 'Criar Post'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? `Status atual: ${loaded?.status ?? '—'}` : 'Publique ou agende em múltiplos canais'}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/social')}>Cancelar</Button>
      </div>

      {readOnly && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Este post está com status <b>{loaded?.status}</b> e não pode ser editado.
        </div>
      )}

      {splitQueue && splitQueue.length > 0 && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span>
              <b>Modo lote:</b> {splitQueue.length} posts serão criados (1 por mídia) usando a caption, canais e agendamento configurados aqui.
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSplitQueue(null)}>Cancelar lote</Button>
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const has = issuesByStep[i].length > 0;
          return (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors',
                step === i ? 'bg-primary text-primary-foreground border-primary'
                           : 'bg-background hover:bg-muted',
              )}
            >
              <span className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px]',
                step === i ? 'bg-primary-foreground/20' : 'bg-muted',
              )}>
                {i < step && !has ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              {s.label}
              {has && <AlertCircle className="w-3 h-3 text-destructive" />}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card className="p-4 md:p-6 space-y-6">
          {step === 0 && (
            <StepContent
              value={data}
              onChange={onChange}
              carrosselSlides={carrosselSlides}
              carrosselTipo={carrosselTipo}
              produtoSlug={carrosselProdutoSlug}
              selectedCarrosselImages={selectedCarrosselImages}
              onToggleCarrosselImage={toggleCarrosselImage}
              onSelectAllCarrossel={selectAllCarrossel}
              onClearCarrossel={clearCarrossel}
              showSystemAPicker={!isCarrosselMode && !isEdit}
              pickedCarrouselRef={pickedCarrouselRef}
              onPickSystemACarousel={pickSystemACarousel}
            />
          )}
          {step === 1 && (
            <StepMedia
              value={data}
              onChange={onChange}
              onSplitIntoPosts={handleSplitIntoPosts}
              carrosselImages={selectedCarrosselImages}
              onCarrosselReorder={reorderCarrossel}
              onCarrosselRemove={removeCarrossel}
            />
          )}
          {step === 2 && <StepChannels value={data} onChange={onChange} />}
          {step === 3 && <StepSchedule value={data} onChange={onChange} />}
          {step === 4 && <StepReview value={effectiveData} />}

          {issuesByStep[step].length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive space-y-1">
              {issuesByStep[step].map((msg, i) => (
                <div key={i} className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" /> {msg}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={!canAdvance || readOnly} onClick={() => setStep((s) => s + 1)}>
                Avançar <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button disabled={!validation.success || saving || updating || readOnly} onClick={handleSave}>
                <Save className="w-4 h-4" />
                {saving || updating ? 'Salvando...' : isEdit ? 'Salvar alterações' : data.publish_now ? 'Publicar agora' : 'Agendar'}
              </Button>
            )}
          </div>
        </Card>

        <div className="hidden lg:block">
          <SocialPostPreview value={effectiveData} />
        </div>
      </div>
    </div>
  );
}