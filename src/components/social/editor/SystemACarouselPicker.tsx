import { Loader2, Images, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useSystemACarousels, type SystemACarousel } from '@/hooks/social/useSystemACarousels';

interface Props {
  selectedRef?: string;
  onPick: (c: SystemACarousel) => void;
  onClear?: () => void;
}

function fmtDate(iso: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

export function SystemACarouselPicker({ selectedRef, onPick, onClear }: Props) {
  const { data, isLoading, isError } = useSystemACarousels();

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Images className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold">Carrosseis do Sistema A</Label>
          {data && (
            <Badge variant="outline" className="text-[10px]">
              {data.length} disponível(is)
            </Badge>
          )}
          {selectedRef && onClear && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] ml-auto"
              onClick={onClear}
            >
              <X className="w-3 h-3 mr-1" /> Limpar seleção
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando carrosseis…
          </div>
        )}

        {isError && (
          <p className="text-xs text-destructive">Não foi possível listar os carrosseis.</p>
        )}

        {!isLoading && data && data.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum carrossel disponível ainda. Gere um pelo Sistema A ou abra este editor pelo
            link de publicação direto do gerador.
          </p>
        )}

        {data && data.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {data.map((c) => {
              const selected = c.ref === selectedRef;
              return (
                <button
                  key={c.ref}
                  type="button"
                  onClick={() => onPick(c)}
                  className={`group relative aspect-square rounded-md overflow-hidden border-2 text-left transition-all ${
                    selected
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border hover:border-primary/50'
                  }`}
                  title={c.productHint || c.ref}
                >
                  <img
                    src={c.firstSlideUrl}
                    alt={c.productHint || c.ref}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.opacity = '0.3';
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                    <div className="text-[10px] text-white/90 truncate font-medium">
                      {c.productHint || c.ref}
                    </div>
                    <div className="text-[9px] text-white/70 flex items-center gap-1">
                      <span>{c.total} slides</span>
                      {c.createdAt && <span>· {fmtDate(c.createdAt)}</span>}
                    </div>
                  </div>
                  {selected && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}