import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Loader2, Mic, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TESTIMONIAL_STATUS_LABEL, useTrainingTestimonials, type TrainingTestimonial } from "@/hooks/useTrainingTestimonials";

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (["published", "indexed", "rag_available"].includes(status)) return "default";
  if (["validation_failed", "failed"].includes(status)) return "destructive";
  if (["pending_review", "awaiting_identification"].includes(status)) return "outline";
  return "secondary";
}

export function TestimonialPipelinePanel({ turmaId, open }: { turmaId: string; open: boolean }) {
  const { items, loading, busyId, reload, transcribe, generate, uploadToPanda, summary } =
    useTrainingTestimonials(turmaId, open);

  const card = (t: TrainingTestimonial) => {
    const busy = busyId === t.id;
    const transcript = t.transcript_revised || t.transcript_raw;
    const canTranscribe = !transcript || ["failed", "uploaded"].includes(t.status);
    const canGenerate = Boolean(transcript) && (t.enrollment_id || t.companion_id);
    const errs = t.validation_errors || [];
    return (
      <div key={t.id} className="rounded-lg border p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{t.participant_name || "Participante não identificado"}</div>
            <div className="truncate text-[11px] text-muted-foreground">{t.generated_filename || t.drive_file_id}</div>
          </div>
          <Badge variant={statusVariant(t.status)} className="shrink-0 text-[10px]">
            {TESTIMONIAL_STATUS_LABEL[t.status] || t.status}
          </Badge>
        </div>

        {transcript && (
          <p className="line-clamp-3 rounded bg-muted/50 p-2 text-[11px] text-muted-foreground">{transcript}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          {t.transcription_confidence != null && (
            <Badge variant="outline" className="font-mono text-[10px]">
              conf. {Number(t.transcription_confidence).toFixed(2)}
            </Badge>
          )}
          {t.analysis?.sentiment && <Badge variant="outline" className="text-[10px]">{t.analysis.sentiment}</Badge>}
          {typeof t.rag_chunks === "number" && t.rag_chunks > 0 && (
            <Badge variant="outline" className="text-[10px]">RAG {t.rag_chunks} trechos</Badge>
          )}
          {t.pandavideo_id && (
            <Badge variant="outline" className="text-[10px]">
              Panda {String(t.video_conversion_status || "").toLowerCase() || "enviado"}
            </Badge>
          )}
        </div>

        {errs.length > 0 && (
          <div className="flex items-start gap-1.5 rounded border border-amber-500/50 bg-amber-500/5 p-2 text-[11px] text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{errs.join(" · ")}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy || !canTranscribe} onClick={() => transcribe(t)}>
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Mic className="mr-1 h-3 w-3" />}
            Transcrever
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy || !canGenerate} onClick={() => generate(t, false)}>
            <FileText className="mr-1 h-3 w-3" /> Rascunho
          </Button>
          <Button size="sm" className="h-7 text-[11px]" disabled={busy || !canGenerate} onClick={() => generate(t, true)}>
            <Sparkles className="mr-1 h-3 w-3" /> Publicar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={busy || !t.drive_file_id || Boolean(t.pandavideo_id)}
            onClick={() => uploadToPanda(t)}
          >
            <Video className="mr-1 h-3 w-3" /> {t.pandavideo_id ? "No Panda" : "Enviar ao Panda"}
          </Button>
          {t.public_url && (
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" asChild>
              <a href={t.public_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" /> Artigo
              </a>
            </Button>
          )}
          {t.drive_web_view_link && (
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" asChild>
              <a href={t.drive_web_view_link} target="_blank" rel="noopener noreferrer">Drive</a>
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Pipeline de depoimentos</div>
          <div className="text-[11px] text-muted-foreground">
            Transcrição → artigo da Categoria E → RAG. Nada vai para redes sociais sem aprovação.
          </div>
        </div>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => void reload()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <Badge variant="outline">{summary.total} vídeos</Badge>
        <Badge variant="secondary">{summary.aTranscrever} a transcrever</Badge>
        <Badge variant="secondary">{summary.aGerar} a gerar</Badge>
        {summary.emRevisao > 0 && <Badge variant="destructive">{summary.emRevisao} em revisão</Badge>}
        {summary.publicados > 0 && (
          <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />{summary.publicados} publicados</Badge>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-[11px] text-muted-foreground">
          Nenhum depoimento registrado no pipeline desta turma ainda.
        </div>
      ) : (
        <ScrollArea className="max-h-[320px] pr-2">
          <div className="grid gap-2 sm:grid-cols-2">{items.map(card)}</div>
        </ScrollArea>
      )}
    </div>
  );
}