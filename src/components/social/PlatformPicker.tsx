import { Checkbox } from '@/components/ui/checkbox';
import { SOCIAL_PLATFORMS, ALL_PLATFORM_VALUES } from './socialPlatforms';

export function PlatformPicker({
  value,
  onChange,
  className = '',
}: {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  function toggle(p: string) {
    onChange(value.includes(p) ? value.filter((v) => v !== p) : [...value, p]);
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-2 text-xs">
        <button type="button" className="text-primary hover:underline" onClick={() => onChange([...ALL_PLATFORM_VALUES])}>
          Selecionar todas
        </button>
        <button type="button" className="text-muted-foreground hover:underline" onClick={() => onChange([])}>
          Limpar
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
      {SOCIAL_PLATFORMS.map((p) => (
        <label
          key={p.value}
          className="flex items-center gap-2 text-xs cursor-pointer select-none"
        >
          <Checkbox checked={value.includes(p.value)} onCheckedChange={() => toggle(p.value)} />
          {p.label}
        </label>
      ))}
      </div>
    </div>
  );
}
