import { Checkbox } from '@/components/ui/checkbox';
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
  function toggle(p: string) {
    onChange(value.includes(p) ? value.filter((v) => v !== p) : [...value, p]);
  }

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
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
  );
}
