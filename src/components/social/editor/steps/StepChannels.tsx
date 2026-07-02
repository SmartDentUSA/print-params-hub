import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SOCIAL_CHANNELS, SOCIAL_BRAND_HEX, type SocialPlatform } from '@/lib/socialChannels';
import type { ChannelInput, PostInput } from '@/lib/social/postSchema';
import { CHANNEL_FORMAT_OPTIONS, ChannelFormatIcon, type ChannelFormatOption } from '../ChannelFormatIcon';

interface Props {
  value: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
}

function isActive(channels: ChannelInput[], opt: ChannelFormatOption): boolean {
  return channels.some((c) => c.platform === opt.platform && c.format === opt.format);
}

function buildChannel(opt: ChannelFormatOption): ChannelInput {
  return {
    platform: opt.platform,
    format: opt.format,
    ...(opt.platform === 'tiktok' ? { tiktok_privacy: 'public' as const } : {}),
    ...(opt.platform === 'reddit' ? { reddit_kind: 'self' as const } : {}),
  };
}

export function StepChannels({ value, onChange }: Props) {
  const toggle = (opt: ChannelFormatOption) => {
    const exists = isActive(value.channels, opt);
    if (exists) {
      onChange({
        channels: value.channels.filter((c) => !(c.platform === opt.platform && c.format === opt.format)),
      });
    } else {
      onChange({ channels: [...value.channels, buildChannel(opt)] });
    }
  };

  const update = (platform: SocialPlatform, format: string, patch: Partial<ChannelInput>) => {
    onChange({
      channels: value.channels.map((c) =>
        c.platform === platform && c.format === format ? { ...c, ...patch } : c,
      ),
    });
  };

  const needsExtras = (c: ChannelInput) =>
    c.platform === 'youtube' || c.platform === 'pinterest' || c.platform === 'reddit' || c.platform === 'tiktok';

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold mb-2 block">Selecione canais</Label>
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-md border border-border bg-card">
          {CHANNEL_FORMAT_OPTIONS.map((opt) => (
            <ChannelFormatIcon
              key={opt.key}
              option={opt}
              active={isActive(value.channels, opt)}
              onClick={() => toggle(opt)}
            />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Clique nos ícones para ativar/desativar canais e formatos. Cinza = inativo · Cor = ativo.
          <br />
          Cada formato marcado gera <strong>1 publicação separada</strong> — Feed, Reels e Stories do mesmo perfil viram 3 posts distintos.
        </p>
      </div>

      {value.channels.some(needsExtras) && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Configuração por canal</h3>
          {value.channels.filter(needsExtras).map((c) => {
            const meta = SOCIAL_CHANNELS[c.platform];
            const brand = SOCIAL_BRAND_HEX[c.platform];
            return (
              <div
                key={`${c.platform}-${c.format}`}
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
                  <span className="font-medium text-sm">{meta.label} · {c.format}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(c.platform === 'youtube' || c.platform === 'pinterest' || c.platform === 'reddit') && (
                    <div>
                      <Label className="text-xs">Título</Label>
                      <Input
                        placeholder="Título do post"
                        value={c.title ?? ''}
                        onChange={(e) => update(c.platform, c.format, { title: e.target.value })}
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
                          onChange={(e) => update(c.platform, c.format, { pinterest_board: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">URL de destino</Label>
                        <Input
                          placeholder="https://..."
                          value={c.destination_url ?? ''}
                          onChange={(e) => update(c.platform, c.format, { destination_url: e.target.value })}
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
                          onChange={(e) => update(c.platform, c.format, { subreddit: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select value={c.reddit_kind ?? 'self'} onValueChange={(v: any) => update(c.platform, c.format, { reddit_kind: v })}>
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
                            onChange={(e) => update(c.platform, c.format, { destination_url: e.target.value })}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {c.platform === 'tiktok' && (
                    <div>
                      <Label className="text-xs">Privacidade</Label>
                      <Select value={c.tiktok_privacy ?? 'public'} onValueChange={(v: any) => update(c.platform, c.format, { tiktok_privacy: v })}>
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