import { useState } from 'react';
import { Loader2, CalendarDays, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useEventMarketingAssets } from '@/hooks/social/useEventMarketingAssets';

interface Props {
  selectedUrls?: string[];
  onPick: (urls: string[]) => void;
  onClear?: () => void;
}

export function EventArtPicker({ selectedUrls = [], onPick, onClear }: Props) {
  const { data, isLoading, isError } = useEventMarketingAssets();
  const [openEvent, setOpenEvent] = useState<string | null>(null);

  const groups = data ?? [];
  const activeEvent = openEvent ?? groups[0]?.eventId ?? null;
  const active = groups.find((g) => g.eventId === activeEvent);

  const toggle = (url: string) => {
    const next = selectedUrls.includes(url)
      ? selectedUrls.filter((u) => u !== url)
      : [...selectedUrls, url];
    onPick(next);
  };

  return (
    <Card className="border-orange-500/25 bg-orange-500/[0.04]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarDays className="w-4 h-4 text-orange-600" />
          <Label className="text-sm font-semibold">Artes de eventos</Label>
          {!!groups.length && (
            <Badge variant="outline" className="text-[10px]">
              {groups.reduce((n, g) => n + g.assets.length, 0)} arte(s)
            </Badge>
          )}
          {selectedUrls.length > 0 && onClear && (
            <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] ml-auto" onClick={onClear}>
              <X className="w-3 h-3 mr-1" /> Limpar seleção
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando artes de eventos…
          </div>
        )}
        {isError && <p className="text-xs text-destructive">Não foi possível listar as artes de eventos.</p>}
        {!isLoading && !groups.length && (
          <p className="text-xs text-muted-foreground">
            Nenhuma arte gerada ainda. Gere o carrossel e os stories no card do evento.
          </p>
        )}

        {groups.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {groups.map((g) => (
              <Button
                key={g.eventId}
                type="button"
                size="sm"
                variant={g.eventId === activeEvent ? 'secondary' : 'ghost'}
                className="h-7 text-[11px] whitespace-nowrap"
                onClick={() => setOpenEvent(g.eventId)}
              >
                {g.eventName}
              </Button>
            ))}
          </div>
        )}

        {active && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {active.assets.map((a) => {
              const selected = selectedUrls.includes(a.url);
              return (
                <button
                  key={a.url}
                  type="button"
                  onClick={() => toggle(a.url)}
                  className={`group relative rounded-md overflow-hidden border-2 text-left transition-all ${
                    selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <img src={a.url} alt={a.label} loading="lazy" className="w-full aspect-[4/5] object-cover" />
                  {selected && (
                    <span className="absolute top-1 right-1 rounded-full bg-primary p-0.5">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </span>
                  )}
                  <span className="block truncate px-1.5 py-1 text-[10px] font-medium">{a.label}</span>
                  <span className="block px-1.5 pb-1 text-[9px] text-muted-foreground">
                    {a.width}×{a.height}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
