import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarClock, Loader2, Upload, X, Film, Image as ImageIcon, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useMediaUpload } from '@/hooks/social/useMediaUpload';
import type { MediaItem } from '@/lib/social/postSchema';
import { localInputToIso } from '@/lib/social/scheduleTime';
import { SOCIAL_CHANNELS, type SocialPlatform } from '@/lib/socialChannels';
import { BULK_MAX_T, BULK_MIN_T, BULK_TZ, VIDEO_ONLY, addDays, bulkChannels, bulkPlan, bulkPostType, fmtTime, handles } from '@/lib/social/bulkPlan';
import { generateBulkCopy } from '@/lib/social/bulkCaption';

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

const TZ = BULK_TZ;
const MIN_T = BULK_MIN_T;
const MAX_T = BULK_MAX_T;

type ChannelKey = SocialPlatform;
const CHANNELS: { key: ChannelKey; label: string }[] = (Object.keys(SOCIAL_CHANNELS) as ChannelKey[]).map((k) => ({
  key: k,
  label: `${SOCIAL_CHANNELS[k].emoji} ${SOCIAL_CHANNELS[k].label}${VIDEO_ONLY.includes(k) ? ' (só vídeos)' : ''}`,
}));

export function SocialBulkScheduler() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress: upProgress } = useMediaUpload();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const fileMap = useRef(new Map<string, File>());
  const [channels, setChannels] = useState<ChannelKey[]>(['instagram']);
  const [igFeed, setIgFeed] = useState(true);
  const [igReels, setIgReels] = useState(true);
  const [igStories, setIgStories] = useState(false);
  const [igHideFromGrid, setIgHideFromGrid] = useState(false);
  const [ytFormat, setYtFormat] = useState<'Vídeo' | 'Shorts'>('Vídeo');
  const [startDate, setStartDate] = useState(() => addDays(new Date().toISOString().slice(0, 10), 1));
  const [interval, setIntervalDays] = useState(1);
  const [time, setTime] = useState(10 * 60);
  const [companies, setCompanies] = useState('');
  const [people, setPeople] = useState('');
  const [collabs, setCollabs] = useState('');
  const [subreddit, setSubreddit] = useState('');
  const [pinBoard, setPinBoard] = useState('');
  const [instructions, setInstructions] = useState('');
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState({ done: 0, total: 0, label: '' });

  const collabList = handles(collabs);
  const tagList = [...handles(companies), ...handles(people)];

  const plan = useMemo(() => bulkPlan(media, startDate, interval, time), [media, startDate, interval, time]);

  const toggleChannel = (k: ChannelKey) =>
    setChannels((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    const all = Array.from(files);
    const tooBig = all.filter((f) => f.type.startsWith('video/') && f.size > MAX_VIDEO_BYTES);
    if (tooBig.length) toast.error(`Vídeo acima de 500 MB ignorado: ${tooBig.map((f) => f.name).join(', ')}`);
    const ok = all.filter((f) => !tooBig.includes(f));
    for (const f of ok) {
      const [item] = await upload([f]);
      if (item) {
        fileMap.current.set(item.url, f);
        setMedia((m) => [...m, item]);
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSchedule = async () => {
    if (!media.length) return toast.error('Escolha pelo menos uma mídia');
    if (!channels.length) return toast.error('Escolha pelo menos um canal');
    if (channels.includes('reddit') && !subreddit.trim()) return toast.error('Informe o subreddit para o Reddit');
    if (collabList.length > 3) return toast.error('O Instagram aceita no máximo 3 colaboradores');
    const firstIso = localInputToIso(`${plan[0].date}T${plan[0].time}`, TZ);
    if (!firstIso || new Date(firstIso).getTime() < Date.now()) return toast.error('A primeira data precisa ser no futuro');

    setRunning(true);
    const { data: auth } = await supabase.auth.getUser();
    const mentions = [...tagList, ...collabList].map((h) => `@${h}`);
    let ok = 0;
    const failed: string[] = [];
    setStep({ done: 0, total: plan.length, label: '' });

    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      const isVideo = p.media.type === 'video';
      setStep({ done: i, total: plan.length, label: isVideo ? `Transcrevendo vídeo ${i + 1}...` : `Lendo imagem ${i + 1}...` });
      try {
        const copy = await generateBulkCopy({
          media: p.media, file: fileMap.current.get(p.media.url), instructions, mentions, platform: channels[0],
        });
        const chs = bulkChannels(
          { channels, igFeed, igReels, igStories, igHideFromGrid, ytFormat, subreddit, pinBoard, tags: tagList, collabs: collabList },
          isVideo, copy.caption,
        );
        if (!chs.length) throw new Error('Nenhum canal aceita esta mídia');

        const { error: insErr } = await supabase.from('social_scheduled_posts').insert({
          caption: copy.caption || null,
          hashtags: copy.hashtags || [],
          first_comment: copy.first_comment || null,
          media_items: [p.media] as any,
          per_channel_media: {} as any,
          channels: chs as any,
          scheduled_at: localInputToIso(`${p.date}T${p.time}`, TZ),
          timezone: TZ,
          publish_now: false,
          status: 'scheduled',
          post_type: bulkPostType({ igFeed, igReels, igStories }, isVideo),
          created_by: auth.user?.email ?? auth.user?.id ?? null,
        } as any);
        if (insErr) throw insErr;
        ok++;
      } catch (e: any) {
        failed.push(`Mídia ${i + 1}: ${e?.message ?? e}`);
      }
      setStep({ done: i + 1, total: plan.length, label: '' });
    }

    setRunning(false);
    if (ok) toast.success(`${ok} publicação(ões) agendada(s)`);
    if (failed.length) toast.error(failed.join('\n'), { duration: 12000 });
    if (ok && !failed.length) navigate('/social/calendario');
  };

  return (
    <div className="space-y-4 p-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarClock className="w-6 h-6 text-primary" /> Agendamento em massa</h1>
        <p className="text-sm text-muted-foreground">
          Escolha as mídias, a frequência e o horário. Ao agendar, o sistema transcreve cada vídeo, escreve a legenda sobre o assunto e cria todos os agendamentos.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Mídias ({media.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input ref={inputRef} type="file" multiple accept="video/*,image/*" className="hidden" onChange={(e) => onPick(e.target.files)} />
          <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading || running}>
            {uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando {upProgress}%</> : <><Upload className="w-4 h-4 mr-1" /> Escolher vídeos e imagens</>}
          </Button>
          {media.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {plan.map((p, i) => (
                <div key={p.media.url} className="relative rounded-md border overflow-hidden bg-muted">
                  {p.media.type === 'video'
                    ? <video src={p.media.url} className="w-full h-32 object-cover" muted />
                    : <img src={p.media.url} className="w-full h-32 object-cover" alt="" />}
                  <div className="p-1.5 text-xs flex items-center gap-1">
                    {p.media.type === 'video' ? <Film className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                    {p.date.split('-').reverse().join('/')} · {p.time}
                  </div>
                  <button
                    type="button"
                    className="absolute top-1 right-1 rounded-full bg-background/90 p-1"
                    onClick={() => setMedia((m) => m.filter((_, j) => j !== i))}
                    disabled={running}
                    aria-label="Remover mídia"
                  ><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">2. Canais</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4">
            {CHANNELS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={channels.includes(c.key)} onCheckedChange={() => toggleChannel(c.key)} /> {c.label}
              </label>
            ))}
          </div>
          {channels.includes('instagram') && (
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">📸 Instagram — formatos</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={igFeed} onCheckedChange={(v) => setIgFeed(!!v)} /> Feed
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={igReels} onCheckedChange={(v) => setIgReels(!!v)} /> Reels (só vídeos)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={igStories} onCheckedChange={(v) => setIgStories(!!v)} /> Stories
                </label>
              </div>
              {igReels && (
                <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground">
                  <Checkbox checked={igHideFromGrid} onCheckedChange={(v) => setIgHideFromGrid(!!v)} />
                  Não mostrar Reels na grade do feed (aparece só na aba Reels)
                </label>
              )}
            </div>
          )}
          {channels.includes('youtube') && (
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">▶️ YouTube — formato</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="yt-format" checked={ytFormat === 'Vídeo'} onChange={() => setYtFormat('Vídeo')} /> Vídeo
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="yt-format" checked={ytFormat === 'Shorts'} onChange={() => setYtFormat('Shorts')} /> Shorts
                </label>
              </div>
            </div>
          )}
          {(channels.includes('reddit') || channels.includes('pinterest')) && (
            <div className="grid md:grid-cols-2 gap-3">
              {channels.includes('reddit') && (
                <div><Label>Subreddit (Reddit)</Label><Input value={subreddit} onChange={(e) => setSubreddit(e.target.value)} placeholder="ex: Dentistry" /></div>
              )}
              {channels.includes('pinterest') && (
                <div><Label>Pasta do Pinterest (opcional)</Label><Input value={pinBoard} onChange={(e) => setPinBoard(e.target.value)} placeholder="nome da pasta" /></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">3. Datas e horário</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="max-w-xs space-y-1">
            <Label>Primeira publicação</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Frequência: 1 publicação a cada <b>{interval} dia{interval > 1 ? 's' : ''}</b></Label>
            <Slider min={1} max={20} step={1} value={[interval]} onValueChange={([v]) => setIntervalDays(v)} />
            <div className="flex justify-between text-[11px] text-muted-foreground"><span>1 dia</span><span>20 dias</span></div>
          </div>
          <div className="space-y-2">
            <Label>Horário: <b>{fmtTime(time)}</b></Label>
            <Slider min={MIN_T} max={MAX_T} step={15} value={[time]} onValueChange={([v]) => setTime(v)} />
            <div className="flex justify-between text-[11px] text-muted-foreground"><span>07:00</span><span>21:00</span></div>
          </div>
          {plan.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Última publicação em {plan[plan.length - 1].date.split('-').reverse().join('/')} às {fmtTime(time)} (horário de Brasília).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">4. Marcações e colaboração (Instagram)</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Marcar empresas</Label>
            <Input placeholder="@empresa1 @empresa2" value={companies} onChange={(e) => setCompanies(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Marcar pessoas</Label>
            <Input placeholder="@pessoa1 @pessoa2" value={people} onChange={(e) => setPeople(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Convidar para colaborar (até 3)</Label>
            <Input placeholder="@perfil1 @perfil2" value={collabs} onChange={(e) => setCollabs(e.target.value)} />
            {collabList.length > 3 && <p className="text-[11px] text-destructive">Máximo de 3 colaboradores.</p>}
          </div>
          <div className="md:col-span-3 flex flex-wrap gap-1">
            {tagList.map((h) => <Badge key={`t-${h}`} variant="outline">@{h}</Badge>)}
            {collabList.map((h) => <Badge key={`c-${h}`}>colab @{h}</Badge>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">5. Orientação para as legendas (opcional)</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            placeholder="Ex.: tom educativo, chamar para o WhatsApp, citar o evento..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </CardContent>
      </Card>

      {running && (
        <Card><CardContent className="p-4 space-y-2">
          <p className="text-sm">{step.label || 'Processando...'} ({step.done}/{step.total})</p>
          <Progress value={step.total ? (step.done / step.total) * 100 : 0} />
          <p className="text-[11px] text-muted-foreground">Não feche esta página até terminar.</p>
        </CardContent></Card>
      )}

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSchedule} disabled={running || uploading || !media.length}>
          {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          Agendar {media.length || ''} publicação(ões)
        </Button>
      </div>
    </div>
  );
}
