import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, History, Instagram, Youtube, Facebook, Music2, Image as ImgIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SocialPostLinkPicker, type SocialPostPickResult } from '@/components/social/flows/SocialPostLinkPicker';
import { WaGroupBlastModal } from '@/components/smartops/wa-groups/WaGroupBlastModal';

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram, youtube: Youtube, facebook: Facebook, tiktok: Music2,
};

export function HistoricalPostBroadcast({ instanceFilter }: { instanceFilter?: string }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<SocialPostPickResult | null>(null);
  const [blastOpen, setBlastOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [initial, setInitial] = useState<
    { type: 'msg' | 'image'; text?: string; mediaUrl?: string; caption?: string } | undefined
  >(undefined);

  const handlePick = (p: SocialPostPickResult) => { setPicked(p); setInitial(undefined); };

  // Monta o envio como a publicação automática: imagem de capa + resumo isca
  // + link clicável. A legenda completa nunca vai para o grupo.
  const openBlast = async () => {
    if (!picked) return;
    setPreparing(true);
    try {
      const { data, error } = await supabase.functions.invoke('wa-post-teaser', {
        body: {
          post_id: picked.post_id ?? null,
          url: picked.url,
          caption: picked.caption ?? '',
          platform: picked.platform,
          thumbnail_url: picked.thumbnail_url ?? null,
        },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message ?? 'falha');
      if (!data.media_url) toast.warning('Não foi possível copiar a imagem da publicação. Envie a imagem manualmente se quiser.');
      if (!data.ai) toast.warning('Resumo automático indisponível; revise o texto antes de enviar.');
      setInitial(data.media_url
        ? { type: 'image', mediaUrl: data.media_url, caption: data.message }
        : { type: 'msg', text: data.message });
      setBlastOpen(true);
    } catch (e: any) {
      toast.error('Falha ao preparar a publicação: ' + (e?.message ?? String(e)));
    } finally {
      setPreparing(false);
    }
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
          Selecione um post já publicado nas suas contas (Instagram, YouTube, Facebook, TikTok).
          O envio vai com a imagem da publicação, um resumo curto e o link para abrir o post.
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
          <Button size="sm" disabled={!picked || preparing} onClick={openBlast}>
            {preparing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
            {preparing ? 'Preparando resumo e imagem…' : 'Configurar envio'}
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
        initial={initial}
      />
    </Card>
  );
}

export default HistoricalPostBroadcast;