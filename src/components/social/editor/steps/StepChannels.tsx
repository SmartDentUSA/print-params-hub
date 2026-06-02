import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SOCIAL_CHANNELS, SOCIAL_BRAND_HEX, type SocialPlatform } from '@/lib/socialChannels';
import { defaultChannelFor, type ChannelInput, type PostInput } from '@/lib/social/postSchema';

interface Props {
  value: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
}

const PLATFORMS = Object.keys(SOCIAL_CHANNELS) as SocialPlatform[];

export function StepChannels({ value, onChange }: Props) {
  const toggle = (p: SocialPlatform) => {
    const exists = value.channels.find((c) => c.platform === p);
    if (exists) {
      onChange({ channels: value.channels.filter((c) => c.platform !== p) });
    } else {
      onChange({ channels: [...value.channels, defaultChannelFor(p)] });
    }
  };

  const update = (p: SocialPlatform, patch: Partial<ChannelInput>) => {
    onChange({
      channels: value.channels.map((c) => (c.platform === p ? { ...c, ...patch } : c)),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {PLATFORMS.map((p) => {
          const meta = SOCIAL_CHANNELS[p];
          const active = value.channels.some((c) => c.platform === p);
          const brand = SOCIAL_BRAND_HEX[p];
          return (
            <button
              key={p}
              type="button"
              onClick={() => toggle(p)}
              className={cn(
                'flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all duration-200',
                active ? 'shadow-soft scale-[1.02]' : 'border-border opacity-70 hover:opacity-100',
              )}
              style={active ? { borderColor: brand, backgroundColor: `${brand}0d` } : undefined}
            >
              <span
                className={cn(
                  'w-11 h-11 rounded-full flex items-center justify-center text-lg text-white transition-transform',
                  active ? 'scale-100' : 'scale-90',
                )}
                style={{ backgroundColor: brand }}
              >
                {meta.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{meta.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{meta.handle}</div>
              </div>
            </button>
          );
        })}
      </div>

      {value.channels.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Configuração por canal</h3>
          {value.channels.map((c) => {
            const meta = SOCIAL_CHANNELS[c.platform];
            const brand = SOCIAL_BRAND_HEX[c.platform];
            return (
              <div
                key={c.platform}
                className="border rounded-md p-3 space-y-3 bg-card border-l-4"
                style={{ borderLeftColor: brand }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                    style={{ backgroundColor: brand }}
                  >
                    {meta.emoji}
                  </span>
                  <span className="font-medium text-sm">{meta.label}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Formato</Label>
                    <Select value={c.format} onValueChange={(v) => update(c.platform, { format: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {meta.formats.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {(c.platform === 'youtube' || c.platform === 'pinterest' || c.platform === 'reddit') && (
                    <div>
                      <Label className="text-xs">Título</Label>
                      <Input
                        placeholder="Título do post"
                        value={c.title ?? ''}
                        onChange={(e) => update(c.platform, { title: e.target.value })}
                      />
                    </div>
                  )}

                  {c.platform === 'pinterest' && (
                    <>
                      <div>
                        <Label className="text-xs">Board</Label>
                        <Input
                          placeholder="Nome do board"
                          value={c.pinterest_board ?? ''}
                          onChange={(e) => update(c.platform, { pinterest_board: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">URL de destino</Label>
                        <Input
                          placeholder="https://..."
                          value={c.destination_url ?? ''}
                          onChange={(e) => update(c.platform, { destination_url: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  {c.platform === 'reddit' && (
                    <>
                      <div>
                        <Label className="text-xs">Subreddit</Label>
                        <Input
                          placeholder="r/odontologia"
                          value={c.subreddit ?? ''}
                          onChange={(e) => update(c.platform, { subreddit: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select value={c.reddit_kind ?? 'self'} onValueChange={(v: any) => update(c.platform, { reddit_kind: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="self">Texto</SelectItem>
                            <SelectItem value="link">Link</SelectItem>
                            <SelectItem value="image">Imagem</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {c.reddit_kind === 'link' && (
                        <div className="col-span-2">
                          <Label className="text-xs">URL</Label>
                          <Input
                            placeholder="https://..."
                            value={c.destination_url ?? ''}
                            onChange={(e) => update(c.platform, { destination_url: e.target.value })}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {c.platform === 'tiktok' && (
                    <div>
                      <Label className="text-xs">Privacidade</Label>
                      <Select value={c.tiktok_privacy ?? 'public'} onValueChange={(v: any) => update(c.platform, { tiktok_privacy: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Público</SelectItem>
                          <SelectItem value="friends">Amigos</SelectItem>
                          <SelectItem value="private">Privado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}