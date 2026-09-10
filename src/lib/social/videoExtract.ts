// Extrai áudio (MP3 leve) e quadros do vídeo no navegador, para que a análise
// da IA não dependa de enviar o arquivo original (que pode ter centenas de MB).
import * as lamejs from '@breezystack/lamejs';

const TARGET_RATE = 24000;
const BITRATE = 48;

function floatTo16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Decodifica o áudio do vídeo e devolve um MP3 mono leve em base64. */
export async function extractAudioMp3Base64(file: File): Promise<{ base64: string; durationSec: number } | null> {
  const buf = await file.arrayBuffer();
  const Ctx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
  const decodeCtx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(buf.slice(0));
  } catch {
    await decodeCtx.close().catch(() => {});
    return null;
  }
  await decodeCtx.close().catch(() => {});
  if (!decoded.length) return null;

  // Mixdown mono + reamostragem para 24 kHz
  const frames = Math.max(1, Math.round((decoded.length * TARGET_RATE) / decoded.sampleRate));
  const off = new OfflineAudioContext(1, frames, TARGET_RATE);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const mono = await off.startRendering();
  const samples = floatTo16(mono.getChannelData(0));

  const encoder = new lamejs.Mp3Encoder(1, TARGET_RATE, BITRATE);
  const parts: Uint8Array[] = [];
  const block = 1152;
  for (let i = 0; i < samples.length; i += block) {
    const chunk = samples.subarray(i, i + block);
    const enc = encoder.encodeBuffer(chunk as any);
    if (enc.length) parts.push(new Uint8Array(enc));
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(new Uint8Array(tail));

  const total = parts.reduce((n, p) => n + p.length, 0);
  const mp3 = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    mp3.set(p, offset);
    offset += p.length;
  }
  return { base64: toBase64(mp3), durationSec: decoded.duration };
}

/** Captura quadros distribuídos ao longo do vídeo (para ler os textos na tela). */
export async function extractFrames(file: File, count = 8, maxWidth = 720): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.src = url;

  const ready = new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('Não foi possível ler o vídeo'));
  });

  try {
    await ready;
    const duration = video.duration || 0;
    const w = Math.min(maxWidth, video.videoWidth || maxWidth);
    const h = Math.round((w * (video.videoHeight || 720)) / (video.videoWidth || 1280));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = duration ? (duration * (i + 0.5)) / count : 0;
      await new Promise<void>((resolve) => {
        const onSeek = () => {
          video.removeEventListener('seeked', onSeek);
          resolve();
        };
        video.addEventListener('seeked', onSeek);
        try {
          video.currentTime = t;
        } catch {
          resolve();
        }
      });
      ctx.drawImage(video, 0, 0, w, h);
      out.push(canvas.toDataURL('image/jpeg', 0.72));
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
