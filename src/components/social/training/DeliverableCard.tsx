import { useState } from 'react';
import { CheckCircle2, ExternalLink, Pencil, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApproveDeliverable, type TrainingDeliverable } from '@/hooks/social/useTrainingDeliverables';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  deliverable: TrainingDeliverable;
  onEdit: (d: TrainingDeliverable) => void;
}

export function DeliverableCard({ deliverable: d, onEdit }: Props) {
  const approve = useApproveDeliverable();
  const [slot, setSlot] = useState(() => toLocalInput(d.suggested_at));

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="capitalize">
          {d.platform}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {d.post_type}
        </Badge>
        <span className="text-sm font-medium">
          Turma {d.turma?.turma_number ?? '—'} {d.turma?.label ? `· ${d.turma.label}` : ''}
        </span>
        {d.status === 'changes_requested' && <Badge variant="destructive">Ajustes solicitados</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">
          {format(new Date(d.created_at), 'dd/MM HH:mm')}
        </span>
      </div>

      {d.caption && (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground line-clamp-6">{d.caption}</p>
      )}

      {!!d.hashtags.length && (
        <p className="text-xs text-muted-foreground">{d.hashtags.map((h) => `#${h}`).join(' ')}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {d.media.map((m) => (
          <a
            key={m.id}
            href={m.drive_web_view_link ?? `https://drive.google.com/file/d/${m.drive_file_id}/view`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
          >
            <ExternalLink className="h-3 w-3" />
            {m.generated_filename}
          </a>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t pt-3">
        <div className="space-y-1">
          <Label htmlFor={`slot-${d.id}`} className="text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" /> Horário sugerido
            {d.suggestion_confidence ? ` (${d.suggestion_confidence})` : ''}
          </Label>
          <Input
            id={`slot-${d.id}`}
            type="datetime-local"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            className="w-56"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => onEdit(d)}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> Editar copy
        </Button>
        <Button
          size="sm"
          disabled={approve.isPending}
          onClick={() =>
            approve.mutate({ id: d.id, scheduled_at: slot ? new Date(slot).toISOString() : null })
          }
        >
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aprovar e agendar
        </Button>
      </div>
    </Card>
  );
}