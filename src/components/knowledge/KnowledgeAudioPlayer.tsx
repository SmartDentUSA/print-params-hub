import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";

function formatAudioTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface KnowledgeAudioPlayerProps {
  url: string;
  label?: string | null;
  className?: string;
}

/**
 * Player de áudio explicativo do artigo (resumo narrado).
 * Mesmo padrão visual usado no hero das landing pages dos formulários:
 * botão redondo com animate-pulse enquanto não iniciado + halo animate-ping,
 * barra de progresso e ícone de alto-falante.
 */
export function KnowledgeAudioPlayer({ url, label, className }: KnowledgeAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [started, setStarted] = useState(false);
  const [rate, setRate] = useState<1 | 1.5 | 2>(1);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  function cycleRate(e: React.MouseEvent) {
    e.stopPropagation();
    setRate((r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1));
  }

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [url]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play()
        .then(() => {
          setPlaying(true);
          setStarted(true);
        })
        .catch(() => setPlaying(false));
    }
  }

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const displayLabel = label || "Ouvir explicação";

  return (
    <div
      className={`flex items-center gap-3 rounded-full border border-primary/20 bg-card pl-2 pr-4 py-2 shadow-md ${className ?? ""}`}
      style={{ maxWidth: "min(360px, 100%)" }}
    >
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar explicação em áudio" : "Reproduzir explicação em áudio"}
        className={`relative flex-shrink-0 grid place-items-center h-9 w-9 rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 ${!started ? "animate-pulse" : ""}`}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4 ml-0.5" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
        {!started && (
          <span className="pointer-events-none absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground">
          <span className="truncate flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="truncate">
              {started ? `${formatAudioTime(current)} / ${formatAudioTime(duration)}` : displayLabel}
            </span>
          </span>
          <button
            type="button"
            onClick={cycleRate}
            aria-label={`Velocidade de reprodução: ${rate}x. Clique para alterar.`}
            className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors"
          >
            {rate === 1 ? "1x" : rate === 1.5 ? "1.5x" : "2x"}
          </button>
        </div>
        <div className="mt-1 h-1 w-full rounded-full bg-primary/15 overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default KnowledgeAudioPlayer;