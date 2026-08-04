import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TrainingTestimonial {
  id: string;
  turma_id: string;
  drive_file_id: string | null;
  drive_web_view_link: string | null;
  generated_filename: string | null;
  participant_name: string | null;
  participant_type: string | null;
  enrollment_id: string | null;
  companion_id: string | null;
  duration_seconds: number | null;
  transcript_raw: string | null;
  transcript_revised: string | null;
  transcription_confidence: number | null;
  analysis: any;
  status: string;
  validation_errors: string[] | null;
  review_notes: string | null;
  knowledge_content_id: string | null;
  knowledge_slug: string | null;
  public_url: string | null;
  rag_chunks: number | null;
  video_publish_status: string | null;
  pandavideo_id: string | null;
  pandavideo_external_id: string | null;
  panda_folder_id: string | null;
  video_conversion_status: string | null;
  video_player: string | null;
  video_hls: string | null;
  thumbnail_url: string | null;
  panda_last_error: string | null;
  created_at: string;
  updated_at: string;
}

export const TESTIMONIAL_STATUS_LABEL: Record<string, string> = {
  uploaded: "Enviado",
  awaiting_identification: "Sem participante",
  transcribing: "Transcrevendo",
  transcribed: "Transcrito",
  generating: "Gerando artigo",
  validation_failed: "Bloqueado na validação",
  pending_review: "Revisão humana",
  publishing: "Publicando",
  published: "Publicado",
  indexing: "Indexando",
  indexed: "Indexado",
  rag_available: "Publicado + RAG",
  failed: "Falhou",
};

export function useTrainingTestimonials(turmaId?: string | null, enabled = true) {
  const [items, setItems] = useState<TrainingTestimonial[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!turmaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("training_testimonials")
      .select("*")
      .eq("turma_id", turmaId)
      .order("created_at", { ascending: false });
    if (error) toast.error(`Falha ao carregar depoimentos: ${error.message}`);
    setItems((data || []) as unknown as TrainingTestimonial[]);
    setLoading(false);
  }, [turmaId]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const invoke = useCallback(
    async (
      fn:
        | "training-testimonial-transcribe"
        | "training-testimonial-publish"
        | "training-testimonial-panda-upload",
      body: Record<string, unknown>,
      id: string,
    ) => {
      setBusyId(id);
      try {
        const { data, error } = await supabase.functions.invoke(fn, { body });
        if (error) throw new Error(error.message);
        if ((data as any)?.error) throw new Error((data as any).error);
        return data as any;
      } finally {
        setBusyId(null);
        await load();
      }
    },
    [load],
  );

  const transcribe = useCallback(
    async (t: TrainingTestimonial) => {
      try {
        const data = await invoke("training-testimonial-transcribe", { testimonial_id: t.id }, t.id);
        toast.success(`Transcrição concluída (${TESTIMONIAL_STATUS_LABEL[data?.status] || data?.status})`);
      } catch (e: any) {
        toast.error(`Transcrição falhou: ${e.message}`);
      }
    },
    [invoke],
  );

  const generate = useCallback(
    async (t: TrainingTestimonial, publish: boolean) => {
      try {
        const data = await invoke("training-testimonial-publish", { testimonial_id: t.id, publish }, t.id);
        const errs: string[] = data?.validation_errors || [];
        if (errs.length) toast.warning(`Artigo em revisão: ${errs[0]}`);
        else toast.success(publish ? "Artigo publicado na Base de Conhecimento" : "Rascunho gerado para revisão");
      } catch (e: any) {
        toast.error(`Geração falhou: ${e.message}`);
      }
    },
    [invoke],
  );

  const uploadToPanda = useCallback(
    async (t: TrainingTestimonial) => {
      try {
        const data = await invoke("training-testimonial-panda-upload", { testimonial_id: t.id }, t.id);
        if (data?.status === "already_uploaded") toast.info("Vídeo já está na pasta Depoimentos do Panda");
        else if (data?.status === "conversion_failed") toast.warning("Upload feito, mas a conversão no Panda falhou");
        else toast.success("Vídeo enviado à pasta Depoimentos do Panda Video");
      } catch (e: any) {
        toast.error(`Envio ao Panda falhou: ${e.message}`);
      }
    },
    [invoke],
  );

  const summary = useMemo(() => {
    const by = (s: string[]) => items.filter((i) => s.includes(i.status)).length;
    return {
      total: items.length,
      aTranscrever: by(["uploaded", "awaiting_identification"]),
      aGerar: by(["transcribed"]),
      emRevisao: by(["pending_review", "validation_failed", "failed"]),
      publicados: by(["published", "indexed", "rag_available"]),
    };
  }, [items]);

  return { items, loading, busyId, reload: load, transcribe, generate, uploadToPanda, summary };
}