import { useRef } from 'react';
import { Upload, X, Loader2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMediaUpload } from '@/hooks/social/useMediaUpload';
import type { MediaItem } from '@/lib/social/postSchema';
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
}

function SortableTile({
  item,
  index,
  onRemove,
}: {
  item: MediaItem;
  index: number;
  onRemove: () => void;
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
        className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
      >
        <X className="w-3 h-3" />
      </Button>
      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-white">
        {item.type} · {index + 1}
      </span>
    </div>
  );
}

export function MediaItemsEditor({ items, onChange, maxItems, hint }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress } = useMediaUpload();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const uploaded = await upload(files);
    if (!uploaded.length) return;
    const merged = [...items, ...uploaded];
    onChange(maxItems ? merged.slice(0, maxItems) : merged);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((m, i) => `${m.url}-${i}` === active.id);
    const newIndex = items.findIndex((m, i) => `${m.url}-${i}` === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  };

  const canAdd = !maxItems || items.length < maxItems;

  return (
    <div className="space-y-3">
      {canAdd && (
        <div
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
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
              <Upload className="w-6 h-6" />
              <span className="text-sm">Clique ou arraste mídia</span>
              {hint && <span className="text-xs">{hint}</span>}
              {maxItems && (
                <span className="text-xs">
                  {items.length}/{maxItems} itens
                </span>
              )}
            </div>
          )}
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
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}