import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { X, Sparkles, Loader2, Package, Library, Check, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useGenerateCaption } from '@/hooks/social/useGenerateCaption';
import { useProductKnowledgeCopies, type ReadyCopy } from '@/hooks/social/useProductKnowledgeCopies';
import { SearchableProductSelect } from '@/components/SearchableProductSelect';
import { SystemACarouselPicker } from '@/components/social/editor/SystemACarouselPicker';
import type { SystemACarousel } from '@/hooks/social/useSystemACarousels';
import { supabase } from '@/integrations/supabase/client';
import type { PostInput } from '@/lib/social/postSchema';

interface Props {
  value: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
  carrosselSlides?: string[];
  carrosselTipo?: string;
  produtoSlug?: string;
  selectedCarrosselImages?: string[];
  onToggleCarrosselImage?: (url: string) => void;
  onSelectAllCarrossel?: () => void;
  onClearCarrossel?: () => void;
  showSystemAPicker?: boolean;
  pickedCarrouselRef?: string;
  onPickSystemACarousel?: (c: SystemACarousel) => void;
}

export function StepContent({
  value,
  onChange,
  carrosselSlides = [],
  carrosselTipo = '',
  produtoSlug = '',
  selectedCarrosselImages = [],
  onToggleCarrosselImage,
  onSelectAllCarrossel,
  onClearCarrossel,
  showSystemAPicker = false,
  pickedCarrouselRef,
  onPickSystemACarousel,
}: Props) {
  const [tagInput, setTagInput] = useState('');
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiTone, setAiTone] = useState('Profissional');
  const generate = useGenerateCaption();

  const platform = value.channels?.[0]?.platform || 'instagram';

  // Catálogo (Sistema A) + Resinas para o dropdown de produto
  const [products, setProducts] = useState<Array<{ id: string; name: string; category?: string; slug?: string }>>([]);
  const [resins, setResins] = useState<Array<{ id: string; name: string; manufacturer: string; slug?: string; type?: string }>>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: cat }, { data: res }] = await Promise.all([
        supabase
          .from('system_a_catalog')
          .select('id,name,category,slug')
          .eq('active', true)
          .order('name', { ascending: true })
          .limit(500),
        supabase
          .from('resins')
          .select('id,name,manufacturer,slug,type')
          .eq('active', true)
          .order('name', { ascending: true })
          .limit(500),
      ]);
      if (!mounted) return;
      setProducts((cat ?? []) as any);
      setResins((res ?? []) as any);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const hasProduct = !!(value.product_ref || value.product_slug || value.product_name);
  const canGenerate = hasProduct;

  const knowledge = useProductKnowledgeCopies(value.product_slug || undefined, value.product_name || undefined);
  const readyCopies: ReadyCopy[] = knowledge.data?.ready_copies ?? [];

  const onProductChange = (val: string) => {
    if (!val || val === 'none') {
      onChange({ product_ref: '', product_name: '', product_slug: '', product_category: '' });
      return;
    }
    if (val.startsWith('product:')) {
      const id = val.slice('product:'.length);
      const p = products.find((x) => x.id === id);
      if (!p) return;
      onChange({
        product_ref: val,
        product_name: p.name,
        product_slug: p.slug || '',
        product_category: p.category || '',
      });
    } else if (val.startsWith('resin:')) {
      const id = val.slice('resin:'.length);
      const r = resins.find((x) => x.id === id);
      if (!r) return;
      onChange({
        product_ref: val,
        product_name: `${r.manufacturer} ${r.name}`.trim(),
        product_slug: r.slug || '',
        product_category: r.type ? `Resina ${r.type}` : 'Resina',
      });
    }
  };

  // Pré-selecionar produto via slug do query param (apenas uma vez)
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (!produtoSlug) return;
    if (value.product_ref) return;
    if (!products.length && !resins.length) return;
    const p = products.find((x) => x.slug === produtoSlug);
    if (p) {
      autoSelectedRef.current = true;
      onProductChange(`product:${p.id}`);
      return;
    }
    const r = resins.find((x) => x.slug === produtoSlug);
    if (r) {
      autoSelectedRef.current = true;
      onProductChange(`resin:${r.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoSlug, products, resins, value.product_ref]);

  const handleGenerate = async () => {
    try {
      const res = await generate.mutateAsync({
        product_name: value.product_name || undefined,
        product_slug: value.product_slug || undefined,
        platform,
        instructions: aiInstructions || undefined,
        tone: aiTone,
        language: 'pt-BR',
        external_enrichment: knowledge.data?.enrichment || undefined,
      });
      onChange({
        caption: res.caption,
        hashtags: res.hashtags || [],
        first_comment: res.first_comment,
      });
      const meta = res._meta;
      toast.success(
        `Legenda gerada · catálogo: ${meta?.product_hits ?? 0} · RAG: ${meta?.rag_hits ?? 0}${meta?.export_hits ? ' · Sistema A ✓' : ''}`,
      );
    } catch (e: any) {
      const code = e?.code;
      if (code === 'AI_CREDITS_EXHAUSTED') {
        toast.error('IA sem créditos no momento', {
          description: readyCopies.length
            ? `Use uma das ${readyCopies.length} copies prontas do Sistema A acima ou escreva manualmente.`
            : 'Escreva a legenda manualmente abaixo. Quando os créditos forem recarregados, a geração volta automaticamente.',
          duration: 8000,
        });
      } else if (code === 'AI_RATE_LIMITED') {
        toast.error('IA sobrecarregada — tente novamente em alguns segundos.');
      } else {
        toast.error(e?.message || 'Falha ao gerar legenda');
      }
    }
  };

  const applyReadyCopy = (c: ReadyCopy) => {
    onChange({ caption: c.text });
    toast.success('Copy do Sistema A aplicada — ajuste e publique');
  };

  const sourceBadge: Record<ReadyCopy['source'], { label: string; cls: string }> = {
    cs: { label: 'CS', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
    aftersales: { label: 'Pós-venda', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
    google_ads: { label: 'Google Ads', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
    seo: { label: 'SEO', cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30' },
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (!t) return;
    if (value.hashtags.includes(t)) return;
    if (value.hashtags.length >= 30) return;
    onChange({ hashtags: [...value.hashtags, t] });
    setTagInput('');
  };

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !tagInput && value.hashtags.length) {
      onChange({ hashtags: value.hashtags.slice(0, -1) });
    }
  };

  return (
    <div className="space-y-5">
      {showSystemAPicker && onPickSystemACarousel && (
        <SystemACarouselPicker
          selectedRef={pickedCarrouselRef}
          onPick={onPickSystemACarousel}
          onClear={onClearCarrossel}
        />
      )}

      {carrosselSlides.length > 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <Label className="text-sm font-semibold">🖼️ Carrossel Recebido do Gerador</Label>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px]">
                Novo
              </Badge>
              <span className="text-[11px] text-muted-foreground ml-auto">
                Carrossel {carrosselTipo || '—'} — {carrosselSlides.length} slides
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-[11px]"
                onClick={onSelectAllCarrossel}
                disabled={selectedCarrosselImages.length === carrosselSlides.length}
              >
                Selecionar todos
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={onClearCarrossel}
                disabled={selectedCarrosselImages.length === 0}
              >
                Limpar seleção
              </Button>
              <span className="text-[11px] text-muted-foreground ml-auto">
                {selectedCarrosselImages.length}/{carrosselSlides.length} selecionados
              </span>
            </div>

            <div className="flex md:grid md:grid-cols-3 gap-2 overflow-x-auto md:overflow-visible pb-1">
              {carrosselSlides.map((url, i) => {
                const selected = selectedCarrosselImages.includes(url);
                return (
                  <div
                    key={url}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggleCarrosselImage?.(url)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggleCarrosselImage?.(url);
                      }
                    }}
                    className={`relative shrink-0 w-[120px] md:w-auto md:aspect-square aspect-square rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                      selected ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-border hover:border-emerald-500/50'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Slide ${i + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = '0.3';
                      }}
                    />
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded flex items-center justify-center border-2 ${selected ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-background/90 border-border'}`}>
                      {selected && <Check className="w-3 h-3" />}
                    </div>
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-white">
                      {i + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">Gerar com IA (RAG Smart Dent)</Label>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Usa o catálogo Smart Dent + base de conhecimento. <b>Selecione o produto</b> da publicação antes
            de gerar.
          </p>

          <div>
            <Label className="text-xs flex items-center gap-1.5 mb-1">
              <Package className="w-3.5 h-3.5" /> Produto da publicação
              <span className="text-destructive">*</span>
            </Label>
            <SearchableProductSelect
              value={value.product_ref || 'none'}
              onValueChange={onProductChange}
              products={products}
              resins={resins as any}
            />
            {value.product_name && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Vinculado: <b>{value.product_name}</b>
                {value.product_category ? ` · ${value.product_category}` : ''}
              </p>
            )}
          </div>

          {hasProduct && (
            <div className="rounded-md border bg-background/60 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Library className="w-3.5 h-3.5 text-primary" />
                <Label className="text-xs font-semibold">Copies prontas do Sistema A</Label>
                {knowledge.isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                {knowledge.data?.matched && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Check className="w-3 h-3" /> {readyCopies.length} copy(ies)
                  </Badge>
                )}
              </div>
              {!knowledge.isLoading && readyCopies.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Sem copies prontas para este produto. Gere com IA ou escreva você mesmo abaixo.
                </p>
              )}
              {readyCopies.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {readyCopies.map((c) => {
                    const b = sourceBadge[c.source];
                    return (
                      <div key={c.id} className="rounded-md border bg-card p-2 flex flex-col gap-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${b.cls}`}>{b.label}</Badge>
                          <span className="text-[10px] text-muted-foreground truncate">{c.label}</span>
                        </div>
                        <p className="text-[11px] line-clamp-3 whitespace-pre-wrap leading-snug">{c.text}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 self-end text-[11px]"
                          onClick={() => applyReadyCopy(c)}
                        >
                          Usar esta copy
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <Textarea
            rows={2}
            placeholder="Ex.: foco em ortodontistas, destacar precisão e fluxo digital, tom consultivo"
            value={aiInstructions}
            onChange={(e) => setAiInstructions(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={aiTone} onValueChange={setAiTone}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Profissional">Profissional</SelectItem>
                <SelectItem value="Educativo">Educativo</SelectItem>
                <SelectItem value="Direto">Direto</SelectItem>
                <SelectItem value="Inspirador">Inspirador</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="capitalize">{platform}</Badge>
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={!canGenerate || generate.isPending}
              className="ml-auto"
            >
              {generate.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Gerando...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-1" /> Gerar legenda + hashtags + 1º comentário</>
              )}
            </Button>
          </div>
          {!canGenerate && (
            <p className="text-xs text-muted-foreground">
              Selecione o produto da publicação acima para habilitar a geração com IA.
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label>Legenda</Label>
          <span className="text-xs text-muted-foreground">{value.caption?.length ?? 0}/2200</span>
        </div>
        <Textarea
          rows={6}
          maxLength={2200}
          placeholder="Escreva a legenda..."
          value={value.caption ?? ''}
          onChange={(e) => onChange({ caption: e.target.value })}
        />
      </div>

      <div>
        <Label>Hashtags ({value.hashtags.length}/30)</Label>
        <div className="flex flex-wrap gap-1.5 mt-1.5 p-2 border rounded-md bg-background min-h-[44px]">
          {value.hashtags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">
              #{t}
              <button type="button" onClick={() => onChange({ hashtags: value.hashtags.filter((h) => h !== t) })}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <input
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
            placeholder="Digite e pressione Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={onTagKey}
            onBlur={addTag}
          />
        </div>
      </div>

      <div>
        <Label>Primeiro comentário (opcional)</Label>
        <Textarea
          rows={3}
          maxLength={2200}
          placeholder="Pode usar para mais hashtags ou CTA"
          value={value.first_comment ?? ''}
          onChange={(e) => onChange({ first_comment: e.target.value })}
        />
      </div>
    </div>
  );
}