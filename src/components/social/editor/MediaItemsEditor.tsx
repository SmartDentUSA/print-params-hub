import { useRef, useState } from 'react';
import { Upload, X, Loader2, GripVertical, Scissors, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMediaUpload } from '@/hooks/social/useMediaUpload';
import type { MediaItem } from '@/lib/social/postSchema';
import { partitionFiles, type MediaValidationError } from '@/lib/social/mediaValidation';
import { MultiUploadChoiceDialog } from './MultiUploadChoiceDialog';
import { MediaCropDialog } from './MediaCropDialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  items: MediaItem[];
  onChange: (next: MediaItem[]) => void;
  maxItems?: number;
  hint?: string;
  onSplitIntoPosts?: (files: File[]) => void;
}

function SortableTile({
  item,
  index,
  onRemove,
  onCrop,
}: {
  item: MediaItem;
  index: number;
  onRemove: () => void;
  onCrop: () => void;
}) {
  const id = `${item.url}-${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const vertical = item.width && item.height && item.height > item.width;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group border rounded-md overflow-hidden bg-muted"
    >
      <div className={cn(vertical ? 'aspect-[9/16]' : 'aspect-square')}>
        {item.type === 'video' ? (
          <video src={item.url} className="w-full h-full object-cover" muted />
        ) : (
          <img src={item.url} className="w-full h-full object-cover" alt="" />
        )}
      </div>
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        aria-label="Reordenar"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <Button
        size="icon"
        variant="destructive"
        className="absolute top-1 right-1 h-7 w-7"
        onClick={onRemove}
        aria-label="Remover"
      >
        <X className="w-3 h-3" />
      </Button>
      <div className="absolute inset-x-0 bottom-0 p-1.5 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 px-2 text-[11px]"
          onClick={onCrop}
          disabled={item.type === 'video'}
        >
          <Scissors className="w-3 h-3 mr-1" /> Cortar
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:bg-white/20" onClick={onRemove} aria-label="Excluir">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <span className="absolute top-1 left-9 px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-white">
        {item.type} · {index + 1}
      </span>
    </div>
  );
}

export function MediaItemsEditor({ items, onChange, maxItems, hint, onSplitIntoPosts }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const addMoreInput = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress } = useMediaUpload();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [invalid, setInvalid] = useState<MediaValidationError[]>([]);
  const [cropIndex, setCropIndex] = useState<number | null>(null);

  const processFiles = async (files: File[]) => {
    if (!files.length) return;
    const uploaded = await upload(files);
    if (!uploaded.length) return;
    const merged = [...items, ...uploaded];
    onChange(maxItems ? merged.slice(0, maxItems) : merged);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const arr = Array.from(files);
    const { valid, invalid: bad } = partitionFiles(arr);
    setInvalid(bad);
    if (!valid.length) return;
    if (items.length === 0 && valid.length > 1 && onSplitIntoPosts) {
      setPendingFiles(valid);
      return;
    }
    await processFiles(valid);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((m, i) => `${m.url}-${i}` === active.id);
    const newIndex = items.findIndex((m, i) => `${m.url}-${i}` === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  };

  const limitReached = !!maxItems && items.length >= maxItems;

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {items.length}
            {maxItems ? `/${maxItems}` : ''} mídia(s)
          </span>
          {uploading && <span>Enviando… {progress}%</span>}
        </div>
      )}

      {items.length === 0 && (
        <div
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors',
            'hover:bg-muted/30',
            uploading && 'pointer-events-none opacity-60',
          )}
        >
          <input
            ref={input}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Enviando {progress}%</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Upload className="w-8 h-8" />
              <span className="text-sm font-medium">Arraste imagens e vídeos aqui</span>
              <span className="text-xs">ou clique para selecionar</span>
              {hint && <span className="text-xs mt-1">{hint}</span>}
            </div>
          )}
        </div>
      )}

      {invalid.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs space-y-1">
          {invalid.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="truncate">{e.file.name}</span>
              <span className="text-muted-foreground">— {e.reason}</span>
            </div>
          ))}
          <button type="button" className="text-[11px] underline" onClick={() => setInvalid([])}>
            Limpar
          </button>
        </div>
      )}

      {items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((m, i) => `${m.url}-${i}`)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {items.map((m, idx) => (
                <SortableTile
                  key={`${m.url}-${idx}`}
                  item={m}
                  index={idx}
                  onRemove={() => onChange(items.filter((_, i) => i !== idx))}
                  onCrop={() => setCropIndex(idx)}
                />
              ))}
              <input
                ref={addMoreInput}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => !limitReached && addMoreInput.current?.click()}
                      disabled={limitReached || uploading}
                      className={cn(
                        'aspect-square border-2 border-dashed rounded-md flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors',
                        limitReached ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/30 cursor-pointer',
                      )}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-[11px]">{progress}%</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-6 h-6" />
                          <span className="text-[11px]">Adicionar mais</span>
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  {limitReached && (
                    <TooltipContent>Limite de {maxItems} mídias atingido</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </SortableContext>
        </DndContext>
      )}

      <MultiUploadChoiceDialog
        open={!!pendingFiles}
        count={pendingFiles?.length ?? 0}
        onCancel={() => setPendingFiles(null)}
        onMultiple={() => {
          if (pendingFiles && onSplitIntoPosts) onSplitIntoPosts(pendingFiles);
          setPendingFiles(null);
        }}
        onCarousel={async () => {
          const files = pendingFiles ?? [];
          setPendingFiles(null);
          await processFiles(files);
        }}
      />

      <MediaCropDialog
        open={cropIndex !== null}
        item={cropIndex !== null ? items[cropIndex] ?? null : null}
        onClose={() => setCropIndex(null)}
        onApply={(next) => {
          if (cropIndex === null) return;
          const copy = [...items];
          copy[cropIndex] = next;
          onChange(copy);
        }}
      />
    </div>
  );
}