import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ImagePlus, Link2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadSocialMediaFile } from '@/hooks/social/useMediaUpload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SOCIAL_CHANNELS, SOCIAL_BRAND_HEX, type SocialPlatform } from '@/lib/socialChannels';
import type { ChannelInput, PostInput } from '@/lib/social/postSchema';
import { CHANNEL_FORMAT_OPTIONS, ChannelFormatIcon, type ChannelFormatOption } from '../ChannelFormatIcon';
import { ChannelRequirementsPanel } from '../ChannelRequirementsPanel';

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

  const isIgReels = (c: ChannelInput) =>
    c.platform === 'instagram' && /reel/i.test(c.format ?? '');

  const isIgStory = (c: ChannelInput) =>
    c.platform === 'instagram' && /stor/i.test(c.format ?? '');

  const needsExtras = (c: ChannelInput) =>
    c.platform === 'youtube' || c.platform === 'pinterest' || c.platform === 'reddit' || c.platform === 'tiktok' || isIgReels(c) || isIgStory(c);

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

      {value.channels.length > 0 && <ChannelRequirementsPanel value={value} />}

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

                  {isIgReels(c) && (
                    <>
                      <div className="col-span-2 flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
                        <div>
                          <div className="text-sm font-medium">Liberar para a grade principal</div>
                          <div className="text-xs text-muted-foreground">
                            {c.ig_share_to_feed === false
                              ? 'O Reels aparece só na aba Reels do perfil.'
                              : 'O Reels aparece na grade do perfil e na aba Reels.'}
                          </div>
                        </div>
                        <Switch
                          aria-label="Liberar para a grade principal"
                          checked={c.ig_share_to_feed !== false}
                          onCheckedChange={(v) => update(c.platform, c.format, { ig_share_to_feed: v })}
                        />
                      </div>
                      <ReelCoverPicker
                        url={c.ig_reel_cover_url ?? ''}
                        onChange={(url) => update(c.platform, c.format, { ig_reel_cover_url: url })}
                      />
                    </>
                  )}

                  {isIgStory(c) && (
                    <div className="col-span-2 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                      <Link2 className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        O Instagram não aceita adesivo de link em story publicado automaticamente.
                        Depois de publicado, adicione o link pelo app do Instagram.
                      </span>
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
function ReelCoverPicker({ url, onChange }: { url: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      toast.error('Use uma imagem JPG ou PNG');
      return;
    }
    setBusy(true);
    try {
      const item = await uploadSocialMediaFile(file);
      onChange(item.url);
      toast.success('Capa do Reels enviada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="col-span-2 rounded-md border border-border p-2.5 space-y-2">
      <div>
        <div className="text-sm font-medium">Capa do Reels (opcional)</div>
        <div className="text-xs text-muted-foreground">
          JPG ou PNG, de preferência 1080 × 1920. Sem capa, o Instagram usa o primeiro quadro do vídeo. Não dá para trocar depois de publicado.
        </div>
      </div>
      <div className="flex items-center gap-3">
        {url ? (
          <div className="relative w-16 aspect-[9/16] rounded overflow-hidden border border-border bg-muted">
            <img src={url} alt="Capa do Reels" className="w-full h-full object-cover" />
            <button
              type="button"
              aria-label="Remover capa"
              onClick={() => onChange('')}
              className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-0.5 text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : null}
        <Button type="button" variant="outline" size="sm" disabled={busy} asChild>
          <label className="cursor-pointer">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            {url ? 'Trocar capa' : 'Enviar capa'}
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }}
            />
          </label>
        </Button>
      </div>
    </div>
  );
}
