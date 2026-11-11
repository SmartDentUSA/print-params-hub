// Legenda automática de cada mídia do agendamento em massa (mesma chamada da tela):
// imagem → quadro reduzido; vídeo → áudio + quadros extraídos no navegador, ou o
// link do vídeo quando a extração não é possível.
import { supabase } from "@/integrations/supabase/client";
import { extractAudioMp3Base64, extractFrames } from "@/lib/social/videoExtract";
import type { BulkMedia } from "@/lib/social/bulkPlan";

export type BulkCopy = { caption: string; hashtags: string[]; first_comment: string };

async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

export async function generateBulkCopy(args: {
  media: BulkMedia; file?: File; instructions: string; mentions: string[]; platform: string;
}): Promise<BulkCopy> {
  const { media, file } = args;
  const isVideo = media.type === "video";
  const frame = isVideo ? null : await imageToDataUrl(media.url);
  let audio: { base64: string } | null = null;
  let vFrames: string[] = [];
  if (isVideo && file) {
    [audio, vFrames] = await Promise.all([
      extractAudioMp3Base64(file).catch(() => null),
      extractFrames(file, 4).catch(() => [] as string[]),
    ]);
  }
  const extracted = !!audio || vFrames.length > 0;
  const { data, error } = await supabase.functions.invoke("social-video-copy", {
    body: {
      video_url: isVideo && !extracted ? media.url : undefined,
      audio_base64: audio?.base64,
      audio_format: "mp3",
      frames: frame ? [frame] : vFrames,
      instructions: args.instructions,
      mentions: args.mentions,
      platform: args.platform,
      language: "pt-BR",
      skip_required_mentions: true,
    },
  });
  // deno-lint-ignore no-explicit-any
  const serverMsg = (data as any)?.error || (error as any)?.context?.responseJson?.error;
  if (serverMsg || error) throw new Error(String(serverMsg || error?.message));
  const copy = data as BulkCopy;
  return { caption: copy.caption || "", hashtags: copy.hashtags || [], first_comment: copy.first_comment || "" };
}
