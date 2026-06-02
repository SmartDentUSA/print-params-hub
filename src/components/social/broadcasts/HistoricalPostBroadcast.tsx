import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, History, Instagram, Youtube, Facebook, Music2, Image as ImgIcon } from 'lucide-react';
import { SocialPostLinkPicker, type SocialPostPickResult } from '@/components/social/flows/SocialPostLinkPicker';
import { WaGroupBlastModal } from '@/components/smartops/wa-groups/WaGroupBlastModal';

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram, youtube: Youtube, facebook: Facebook, tiktok: Music2,
};

function detectMediaType(url?: string | null): 'image' | 'video' | undefined {
  if (!url) return undefined;
  const u = url.toLowerCase();
  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(u)) return 'video';
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(u)) return 'image';
  return undefined;
}

export function HistoricalPostBroadcast({ instanceFilter }: { instanceFilter?: string }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<SocialPostPickResult | null>(null);
  const [blastOpen, setBlastOpen] = useState(false);

  const handlePick = (p: SocialPostPickResult) => setPicked(p);

  const openBlast = () => {
    if (!picked) return;
    setBlastOpen(true);
  };

  // Monta texto + tipo de mensagem com base na publicação
  const buildInitial = () => {
    if (!picked) return undefined;
    const mediaKind = detectMediaType(picked.thumbnail_url);
    const captionBody = (picked.caption ?? '').trim();
    const textWithLink = [captionBody, picked.url].filter(Boolean).join('\n\n');
    if (mediaKind === 'image' && picked.thumbnail_url) {
      return { type: 'image' as const, mediaUrl: picked.thumbnail_url, caption: textWithLink };
    }
    return {
      type: 'link' as const,
      linkTitle: picked.titulo || 'Publicação',
      linkUrl: picked.url,
      linkDesc: captionBody.slice(0, 400),
    };
  };

  const I = picked ? (PLATFORM_ICONS[picked.platform] ?? ImgIcon) : ImgIcon;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          Enviar publicação histórica para grupos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Selecione um post já publicado nas suas contas (Instagram, YouTube, Facebook, TikTok)
          e envie como blast para grupos do WhatsApp.
        </p>

        {picked ? (
          <div className="rounded-md border border-border bg-muted/30 p-3 flex gap-3">
            {picked.thumbnail_url ? (
              <img src={picked.thumbnail_url} alt="" className="w-16 h-16 rounded object-cover bg-muted shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0">
                <I className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <Badge variant="secondary" className="text-[10px] capitalize">{picked.platform || 'post'}</Badge>
                <span className="text-[10px] text-muted-foreground truncate">{picked.url}</span>
              </div>
              <div className="text-sm line-clamp-2">{picked.caption || picked.titulo}</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic">Nenhuma publicação selecionada ainda.</div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            {picked ? 'Trocar publicação' : 'Selecionar publicação'}
          </Button>
          <Button size="sm" disabled={!picked} onClick={openBlast}>
            <Send className="w-3.5 h-3.5 mr-1" /> Configurar envio
          </Button>
        </div>
      </CardContent>

      <SocialPostLinkPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePick}
      />

      <WaGroupBlastModal
        open={blastOpen}
        onClose={() => setBlastOpen(false)}
        onSent={() => setBlastOpen(false)}
        pickerMode
        instanceFilter={instanceFilter}
        initial={buildInitial()}
      />
    </Card>
  );
}

export default HistoricalPostBroadcast;