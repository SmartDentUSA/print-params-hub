import { useState } from "react";
import { FileText, ImageIcon, Music, Video } from "lucide-react";

interface WaLeadsMediaPreviewProps {
  tipo: string;
  url: string;
  compact?: boolean;
}

export function WaLeadsMediaPreview({ tipo, url, compact = false }: WaLeadsMediaPreviewProps) {
  const [imgError, setImgError] = useState(false);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded text-muted-foreground ${compact ? "w-12 h-12" : "w-full h-32"}`}>
        <MediaIcon tipo={tipo} className="w-5 h-5" />
      </div>
    );
  }

  if (tipo === "image") {
    if (imgError) {
      return (
        <div className={`flex items-center justify-center bg-muted rounded text-muted-foreground ${compact ? "w-12 h-12" : "w-full h-32"}`}>
          <ImageIcon className="w-5 h-5" />
        </div>
      );
    }
    return (
      <img
        src={url}
        alt="Preview"
        className={`rounded object-cover border ${compact ? "w-12 h-12" : "w-full max-h-48"}`}
        onError={() => setImgError(true)}
      />
    );
  }

  if (tipo === "video") {
    if (compact) {
      return (
        <div className="w-12 h-12 flex items-center justify-center bg-muted rounded text-muted-foreground">
          <Video className="w-5 h-5" />
        </div>
      );
    }
    return (
      <video src={url} controls className="w-full max-h-48 rounded border" />
    );
  }

  if (tipo === "audio") {
    if (compact) {
      return (
        <div className="w-12 h-12 flex items-center justify-center bg-muted rounded text-muted-foreground">
          <Music className="w-5 h-5" />
        </div>
      );
    }
    return <audio src={url} controls className="w-full" />;
  }

  // document
  const fileName = url.split("/").pop()?.split("?")[0] || "documento";
  return (
    <div className={`flex items-center gap-2 bg-muted rounded p-2 ${compact ? "w-fit" : "w-full"}`}>
      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
      <span className={`font-mono truncate ${compact ? "text-[9px] max-w-[60px]" : "text-[11px] max-w-[200px]"}`}>
        {fileName}
      </span>
    </div>
  );
}

function MediaIcon({ tipo, className }: { tipo: string; className?: string }) {
  switch (tipo) {
    case "image": return <ImageIcon className={className} />;
    case "video": return <Video className={className} />;
    case "audio": return <Music className={className} />;
    default: return <FileText className={className} />;
  }
}
