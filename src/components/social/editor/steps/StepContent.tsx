import { useState, KeyboardEvent } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGenerateCaption } from '@/hooks/social/useGenerateCaption';
import type { PostInput } from '@/lib/social/postSchema';

interface Props {
  value: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
}

export function StepContent({ value, onChange }: Props) {
  const [tagInput, setTagInput] = useState('');
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiTone, setAiTone] = useState('Profissional');
  const generate = useGenerateCaption();

  const platform = value.channels?.[0]?.platform || 'instagram';
  const canGenerate = !!(value.product_name?.trim() || value.product_slug?.trim() || aiInstructions.trim());

  const handleGenerate = async () => {
    try {
      const res = await generate.mutateAsync({
        product_name: value.product_name || undefined,
        product_slug: value.product_slug || undefined,
        platform,
        instructions: aiInstructions || undefined,
        tone: aiTone,
        language: 'pt-BR',
      });
      onChange({
        caption: res.caption,
        hashtags: res.hashtags || [],
        first_comment: res.first_comment,
      });
      const meta = res._meta;
      toast.success(
        `Legenda gerada · ${meta?.product_hits ?? 0} fonte(s) de catálogo · ${meta?.rag_hits ?? 0} trecho(s) RAG`,
      );
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao gerar legenda');
    }
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
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">Gerar com IA (RAG Smart Dent)</Label>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Usa o catálogo e a base de conhecimento para criar legenda + hashtags + 1º comentário. Preencha o
            produto abaixo (nome ou slug) e/ou descreva o ângulo desejado.
          </p>
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
              Informe nome/slug do produto (campo abaixo) ou escreva uma instrução para habilitar.
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Produto (nome)</Label>
          <Input
            placeholder="Ex.: BLZ INO 200"
            value={value.product_name ?? ''}
            onChange={(e) => onChange({ product_name: e.target.value })}
          />
        </div>
        <div>
          <Label>Slug do produto</Label>
          <Input
            placeholder="blz-ino-200"
            value={value.product_slug ?? ''}
            onChange={(e) => onChange({ product_slug: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}