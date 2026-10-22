import { useState } from 'react';
import type { LandingAttendanceMedia } from '@/lib/landingAttendanceMedia';
import { usePandaVideoTracking } from '@/hooks/usePandaVideoTracking';

export function AttendanceOpeningMedia({ media, formId }: { media: LandingAttendanceMedia; formId?: string | null }) {
  const [failed, setFailed] = useState(false);
  const { frameRef } = usePandaVideoTracking(media.url, formId);
  if (failed) return null;
  if (media.kind === 'embed') return (
    <div className="mb-2 w-full">
      <div className="aspect-video w-full overflow-hidden rounded-md bg-background">
        <iframe ref={frameRef} src={media.url} title="Vídeo do produto" className="h-full w-full border-0" allow="fullscreen; encrypted-media; picture-in-picture" allowFullScreen />
      </div>
    </div>
  );
  if (media.kind === 'video') return (
    <video src={media.url} aria-label="Vídeo do produto" controls playsInline preload="metadata" onError={() => setFailed(true)} className="mb-2 max-h-56 w-full rounded-md bg-background object-contain" />
  );
  return <img src={media.url} alt="Imagem do produto" onError={() => setFailed(true)} className="mb-2 max-h-56 w-full rounded-md object-contain" />;
}