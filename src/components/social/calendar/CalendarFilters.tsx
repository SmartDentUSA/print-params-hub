import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SOCIAL_CHANNELS, type SocialPlatform } from '@/lib/socialChannels';

export interface CalendarFiltersValue {
  platform: SocialPlatform | 'all';
  status: 'all' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'draft';
}

export function CalendarFilters({
  value,
  onChange,
}: {
  value: CalendarFiltersValue;
  onChange: (v: CalendarFiltersValue) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={value.platform} onValueChange={(v) => onChange({ ...value, platform: v as any })}>
        <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Canal" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os canais</SelectItem>
          {Object.entries(SOCIAL_CHANNELS).map(([k, m]) => (
            <SelectItem key={k} value={k}>{m.emoji} {m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as any })}>
        <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="scheduled">Agendado</SelectItem>
          <SelectItem value="publishing">Publicando</SelectItem>
          <SelectItem value="published">Publicado</SelectItem>
          <SelectItem value="failed">Falhou</SelectItem>
          <SelectItem value="draft">Rascunho</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}