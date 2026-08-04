import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateDeliverable, type TrainingDeliverable } from '@/hooks/social/useTrainingDeliverables';

interface Props {
  deliverable: TrainingDeliverable | null;
  open: boolean;
  onClose: () => void;
}

export function EditDeliverableDialog({ deliverable, open, onClose }: Props) {
  const update = useUpdateDeliverable();
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [cta, setCta] = useState('');

  useEffect(() => {
    if (!deliverable) return;
    setCaption(deliverable.caption ?? '');
    setHashtags((deliverable.hashtags ?? []).join(' '));
    setFirstComment(deliverable.first_comment ?? '');
    setCta(deliverable.cta ?? '');
  }, [deliverable]);

  if (!deliverable) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Editar copy — {deliverable.platform} · {deliverable.post_type}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="del-caption">Legenda</Label>
            <Textarea id="del-caption" rows={10} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="del-hashtags">Hashtags (separadas por espaço, sem #)</Label>
            <Input id="del-hashtags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="del-first">Primeiro comentário</Label>
            <Textarea id="del-first" rows={3} value={firstComment} onChange={(e) => setFirstComment(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="del-cta">CTA</Label>
            <Input id="del-cta" value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                {
                  id: deliverable.id,
                  caption,
                  hashtags: hashtags
                    .split(/[\s,]+/)
                    .map((h) => h.replace(/^#/, '').trim())
                    .filter(Boolean),
                  first_comment: firstComment,
                  cta,
                },
                { onSuccess: onClose },
              )
            }
          >
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}