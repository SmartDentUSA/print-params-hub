import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { MediaItem } from '@/lib/social/postSchema';

const BUCKET = 'wa-media';
const MAX_BYTES = 500 * 1024 * 1024;

function getMediaDimensions(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({});
      img.src = URL.createObjectURL(file);
    } else if (file.type.startsWith('video/')) {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight });
      v.onerror = () => resolve({});
      v.src = URL.createObjectURL(file);
    } else resolve({});
  });
}

export function useMediaUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File): Promise<MediaItem | null> => {
    if (file.size > MAX_BYTES) {
      toast.error(`Arquivo muito grande (max ${MAX_BYTES / 1024 / 1024}MB)`);
      return null;
    }
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      toast.error('Apenas imagens ou vídeos');
      return null;
    }
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
    const path = `social/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      toast.error(`Upload falhou: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const dims = await getMediaDimensions(file);
    return { url: data.publicUrl, path, type: isVideo ? 'video' : 'image', ...dims };
  };

  const upload = async (files: FileList | File[]): Promise<MediaItem[]> => {
    const arr = Array.from(files);
    if (!arr.length) return [];
    setUploading(true);
    setProgress(0);
    const out: MediaItem[] = [];
    for (let i = 0; i < arr.length; i++) {
      const item = await uploadFile(arr[i]);
      if (item) out.push(item);
      setProgress(Math.round(((i + 1) / arr.length) * 100));
    }
    setUploading(false);
    if (out.length) toast.success(`${out.length} arquivo(s) enviado(s)`);
    return out;
  };

  return { upload, uploading, progress };
}