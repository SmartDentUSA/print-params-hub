import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { WA_MEDIA_CAPTION_MAX, composePostText, postBodyText, postPreviewImage } from "@/lib/wa/postMessage";

interface Props {
  link: string;
  caption?: string;
  resumo?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  generating: boolean;
  onGenerate: () => void;
  onChange: (patch: { resumo?: string; caption?: string }) => void;
}

/** Resumo editável + prévia de como a mensagem chega no grupo (imagem, texto e link). */
export function SocialPostSummaryEditor({ link, caption, resumo, mediaUrl, thumbnailUrl, generating, onGenerate, onChange }: Props) {
  const image = postPreviewImage({ media_url: mediaUrl, thumbnail_url: thumbnailUrl });
  const body = postBodyText({ resumo, caption });
  const full = composePostText(body, link);
  const sent = composePostText(body, link, image ? WA_MEDIA_CAPTION_MAX : undefined);
  const truncated = sent.length < full.length;
  const hasResumo = !!resumo?.trim();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Resumo enviado no grupo</Label>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onGenerate} disabled={generating || !link}>
          {generating
            ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            : hasResumo ? <RefreshCw className="w-3 h-3 mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
          {hasResumo ? "Regerar" : "Gerar resumo"}
        </Button>
      </div>
      <Textarea
        value={resumo ?? ""}
        onChange={(e) => onChange({ resumo: e.target.value })}
        placeholder={generating ? "Gerando resumo…" : "Sem resumo: será enviada a legenda original."}
        rows={3}
      />
      {!hasResumo && !generating && (
        <p className="text-[11px] text-muted-foreground">Sem resumo, o grupo recebe a legenda original inteira.</p>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Como vai chegar</Label>
        <div className="rounded-lg border bg-muted/40 p-2">
          <div className="ml-auto max-w-[280px] rounded-lg bg-card shadow-sm overflow-hidden border">
            {image && <img src={image} alt="" loading="lazy" className="w-full max-h-56 object-cover bg-muted" />}
            <p className="px-2 py-1.5 text-xs whitespace-pre-wrap break-words">{sent || "—"}</p>
          </div>
        </div>
        <p className={cn("text-[11px]", truncated ? "text-destructive" : "text-muted-foreground")}>
          {image ? "Imagem com legenda" : "Só texto (publicação sem imagem)"} · {sent.length}
          {image ? ` / ${WA_MEDIA_CAPTION_MAX}` : ""} caracteres
          {truncated && " — o texto será cortado com reticências. Encurte o resumo."}
        </p>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <ChevronDown className="w-3 h-3" /> Legenda original
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-1">
          <Textarea
            value={caption ?? ""}
            onChange={(e) => onChange({ caption: e.target.value })}
            placeholder="Legenda original da publicação"
            rows={4}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
