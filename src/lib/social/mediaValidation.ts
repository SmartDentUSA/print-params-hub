const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];

export type MediaValidationError = { file: File; reason: string };

export function validateMediaFile(file: File): string | null {
  if (file.type.startsWith('image/')) {
    if (!IMAGE_MIMES.includes(file.type)) return 'Formato de imagem não suportado (use JPG, PNG ou WEBP)';
    return null;
  }
  if (file.type.startsWith('video/')) {
    if (!VIDEO_MIMES.includes(file.type)) return 'Formato de vídeo não suportado (use MP4 ou MOV)';
    return null;
  }
  return 'Tipo de arquivo não suportado';
}

export function partitionFiles(files: File[]): { valid: File[]; invalid: MediaValidationError[] } {
  const valid: File[] = [];
  const invalid: MediaValidationError[] = [];
  for (const f of files) {
    const err = validateMediaFile(f);
    if (err) invalid.push({ file: f, reason: err });
    else valid.push(f);
  }
  return { valid, invalid };
}

export const CAROUSEL_PLATFORMS = ['instagram', 'facebook'] as const;
export const CAROUSEL_LIMITS: Record<string, number> = {
  instagram: 10,
  facebook: 10,
  linkedin: 9,
};