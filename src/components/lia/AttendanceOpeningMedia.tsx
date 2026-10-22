import { useState } from 'react';
import type { LandingAttendanceMedia } from '@/lib/landingAttendanceMedia';

export function AttendanceOpeningMedia({ media }: { media: LandingAttendanceMedia }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  if (media.kind === 'embed') return (
    <div className="mb-2 aspect-video w-full overflow-hidden rounded-md bg-background">
      <iframe src={media.url} title="Vídeo do produto" className="h-full w-full border-0" allow="fullscreen; encrypted-media; picture-in-picture" allowFullScreen />
    </div>
  );
  if (media.kind === 'video') return (
    <video src={media.url} aria-label="Vídeo do produto" controls playsInline preload="metadata" onError={() => setFailed(true)} className="mb-2 max-h-56 w-full rounded-md bg-background object-contain" />
  );
  return <img src={media.url} alt="Imagem do produto" onError={() => setFailed(true)} className="mb-2 max-h-56 w-full rounded-md object-contain" />;
}