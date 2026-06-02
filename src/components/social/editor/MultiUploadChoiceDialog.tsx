import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

interface Props {
  open: boolean;
  count: number;
  onCancel: () => void;
  onMultiple: () => void;
  onCarousel: () => void;
}

export function MultiUploadChoiceDialog({ open, count, onCancel, onMultiple, onCarousel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Info className="w-5 h-5 text-primary" />
          </div>
          <DialogTitle className="text-center">Atenção</DialogTitle>
          <DialogDescription className="text-center">
            Você selecionou {count} mídias. Deseja adicionar múltiplos posts ou um novo álbum?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-2 gap-2 sm:gap-2">
          <Button variant="outline" onClick={onMultiple}>Múltiplos Posts</Button>
          <Button onClick={onCarousel}>Álbum/Carrossel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}