import { useEffect, useMemo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { SOCIAL_PLATFORMS } from './socialPlatforms';

export function PlatformPicker({
  value,
  onChange,
  className = '',
}: {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const [available, setAvailable] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('social_posts')
        .select('platform')
        .not('platform', 'is', null)
        .limit(5000);
      if (!alive) return;
      setAvailable(Array.from(new Set((data ?? []).map((r: any) => r.platform).filter(Boolean))));
    })();
    return () => { alive = false; };
  }, []);

  // Só oferece redes que realmente têm posts no banco (evita filtro impossível
  // de satisfazer). Redes já selecionadas continuam visíveis para poder desmarcar.
  const options = useMemo(() => {
    if (!available) return SOCIAL_PLATFORMS;
    return SOCIAL_PLATFORMS.filter((p) => available.includes(p.value) || value.includes(p.value));
  }, [available, value]);
  const optionValues = useMemo(() => options.map((p) => p.value), [options]);

  function toggle(p: string) {
    onChange(value.includes(p) ? value.filter((v) => v !== p) : [...value, p]);
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-2 text-xs">
        <button type="button" className="text-primary hover:underline" onClick={() => onChange([...optionValues])}>
          Selecionar todas
        </button>
        <button type="button" className="text-muted-foreground hover:underline" onClick={() => onChange([])}>
          Limpar
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
      {options.map((p) => (
        <label
          key={p.value}
          className="flex items-center gap-2 text-xs cursor-pointer select-none"
        >
          <Checkbox checked={value.includes(p.value)} onCheckedChange={() => toggle(p.value)} />
          {p.label}
        </label>
      ))}
      </div>
      {available && SOCIAL_PLATFORMS.length > options.length && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Redes sem posts no banco estão ocultas.
        </p>
      )}
    </div>
  );
}
