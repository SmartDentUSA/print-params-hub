import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { PostInput } from '@/lib/social/postSchema';

interface Props {
  value: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
}

export function StepContent({ value, onChange }: Props) {
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (!t) return;
    if (value.hashtags.includes(t)) return;
    if (value.hashtags.length >= 30) return;
    onChange({ hashtags: [...value.hashtags, t] });
    setTagInput('');
  };

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !tagInput && value.hashtags.length) {
      onChange({ hashtags: value.hashtags.slice(0, -1) });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label>Legenda</Label>
          <span className="text-xs text-muted-foreground">{value.caption?.length ?? 0}/2200</span>
        </div>
        <Textarea
          rows={6}
          maxLength={2200}
          placeholder="Escreva a legenda..."
          value={value.caption ?? ''}
          onChange={(e) => onChange({ caption: e.target.value })}
        />
      </div>

      <div>
        <Label>Hashtags ({value.hashtags.length}/30)</Label>
        <div className="flex flex-wrap gap-1.5 mt-1.5 p-2 border rounded-md bg-background min-h-[44px]">
          {value.hashtags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">
              #{t}
              <button type="button" onClick={() => onChange({ hashtags: value.hashtags.filter((h) => h !== t) })}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <input
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
            placeholder="Digite e pressione Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={onTagKey}
            onBlur={addTag}
          />
        </div>
      </div>

      <div>
        <Label>Primeiro comentário (opcional)</Label>
        <Textarea
          rows={3}
          maxLength={2200}
          placeholder="Pode usar para mais hashtags ou CTA"
          value={value.first_comment ?? ''}
          onChange={(e) => onChange({ first_comment: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Produto (nome)</Label>
          <Input
            placeholder="Ex.: BLZ INO 200"
            value={value.product_name ?? ''}
            onChange={(e) => onChange({ product_name: e.target.value })}
          />
        </div>
        <div>
          <Label>Slug do produto</Label>
          <Input
            placeholder="blz-ino-200"
            value={value.product_slug ?? ''}
            onChange={(e) => onChange({ product_slug: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}