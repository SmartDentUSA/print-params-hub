import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PostInput } from '@/lib/social/postSchema';

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Lisbon',
  'Europe/London',
  'UTC',
];

interface Props {
  value: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
}

function nowLocalIso() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StepSchedule({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border rounded-md p-3">
        <div>
          <div className="font-medium text-sm">Publicar agora</div>
          <div className="text-xs text-muted-foreground">Envia imediatamente para a fila</div>
        </div>
        <Switch checked={value.publish_now} onCheckedChange={(v) => onChange({ publish_now: v })} />
      </div>

      {!value.publish_now && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Data e hora</Label>
            <Input
              type="datetime-local"
              value={value.scheduled_at ?? ''}
              min={nowLocalIso()}
              onChange={(e) => onChange({ scheduled_at: e.target.value })}
            />
          </div>
          <div>
            <Label>Fuso horário</Label>
            <Select value={value.timezone} onValueChange={(v) => onChange({ timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}