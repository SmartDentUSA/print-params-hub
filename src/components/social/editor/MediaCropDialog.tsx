import { useRef, useState } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { MediaItem } from '@/lib/social/postSchema';

const PRESETS: { label: string; value: number | undefined }[] = [
  { label: 'Livre', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 },
];

interface Props {
  open: boolean;
  item: MediaItem | null;
  onClose: () => void;
  onApply: (next: MediaItem) => void;
}

export function MediaCropDialog({ open, item, onClose, onApply }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect ?? width / height, width, height), width, height));
  };

  const setPreset = (v: number | undefined) => {
    setAspect(v);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, v ?? width / height, width, height), width, height));
    }
  };

  const handleApply = async () => {
    if (!imgRef.current || !crop || !item) return;
    setSaving(true);
    try {
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;
      const pxCrop =
        crop.unit === '%'
          ? { x: (crop.x / 100) * img.width, y: (crop.y / 100) * img.height, width: (crop.width / 100) * img.width, height: (crop.height / 100) * img.height }
          : { x: crop.x, y: crop.y, width: crop.width, height: crop.height };

      const canvas = document.createElement('canvas');
      const cw = Math.floor(pxCrop.width * scaleX);
      const ch = Math.floor(pxCrop.height * scaleY);
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, pxCrop.x * scaleX, pxCrop.y * scaleY, cw, ch, 0, 0, cw, ch);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Falha ao gerar recorte');
      const path = `social/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('wa-media').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('wa-media').getPublicUrl(path);
      onApply({
        ...item,
        url: data.publicUrl,
        path,
        width: cw,
        height: ch,
        crop: { x: pxCrop.x, y: pxCrop.y, width: pxCrop.width, height: pxCrop.height },
      });
      onClose();
    } catch (e: any) {
      toast.error(`Erro ao cortar: ${e.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open && !!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cortar imagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant={aspect === p.value ? 'default' : 'outline'} onClick={() => setPreset(p.value)}>
                {p.label}
              </Button>
            ))}
          </div>
          {item && (
            <div className="max-h-[60vh] overflow-auto flex justify-center bg-muted/30 rounded">
              <ReactCrop crop={crop} onChange={(c) => setCrop(c)} aspect={aspect}>
                <img ref={imgRef} src={item.url} alt="" onLoad={handleLoad} className="max-h-[60vh]" crossOrigin="anonymous" />
              </ReactCrop>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleApply} disabled={saving || !crop}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Aplicar crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}