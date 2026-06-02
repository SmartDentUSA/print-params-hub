import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CalendarPost } from '@/hooks/social/useCalendarPosts';

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RescheduleDialog({
  open,
  post,
  targetDate,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  post: CalendarPost | null;
  targetDate: Date | null;
  onConfirm: (iso: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!post || !targetDate) return;
    const original = post.scheduled_at ? new Date(post.scheduled_at) : new Date();
    const merged = new Date(targetDate);
    merged.setHours(original.getHours(), original.getMinutes(), 0, 0);
    setValue(toLocalInput(merged));
  }, [post, targetDate]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar post</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground line-clamp-2">{post?.caption || 'Sem legenda'}</p>
          <div className="space-y-1.5">
            <Label>Nova data e hora</Label>
            <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            onClick={() => {
              const d = new Date(value);
              if (isNaN(d.getTime())) return;
              onConfirm(d.toISOString());
            }}
          >
            Reagendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}