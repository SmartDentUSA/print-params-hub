/**
 * training-testimonial-auto-process
 *
 * Fila automática dos depoimentos de treinamento (chamada por pg_cron).
 * Para cada item reservado atomicamente:
 *   1. transcreve (identificando o participante pela fala quando necessário);
 *   2. gera e publica o artigo da Categoria E com a ficha real do participante.
 *
 * Guardas obrigatórias:
 *  - lote pequeno (máx. 3 por execução) e claim atômico via RPC (single-flight);
 *  - progresso idempotente: publicado nunca reprocessa;
 *  - máximo 3 tentativas com backoff; erro final grava auto_last_error;
 *  - circuit breaker: 402/403 do gateway de IA pausa a fila (auto_process=false)
 *    e interrompe o lote inteiro.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authorizeTestimonialCall, corsHeadersTestimonial, jsonResponse, logEvent, serviceClient,
} from "../_shared/testimonial-pipeline.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BACKOFF_MINUTES = [5, 20, 60];

async function callStep(fn: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* resposta não-JSON */ }
  return { status: res.status, ok: res.ok, json, text: text.slice(0, 800) };
}

/** 402/403 relayed pelo gateway de IA => pausa geral da fila. */
function isCreditBlock(text: string): boolean {
  return /IA 40[23]:/.test(text) || /Transcrição 40[23]:/.test(text);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersTestimonial });

  const auth = await authorizeTestimonialCall(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

  const db = serviceClient();
  const results: Array<Record<string, unknown>> = [];

  try {
    const { limit = 3 } = await req.json().catch(() => ({}));
    const { data: claimed, error } = await db.rpc("fn_claim_testimonial_auto_jobs", {
      _limit: Math.max(1, Math.min(Number(limit) || 3, 5)),
    });
    if (error) throw new Error(`Falha ao reservar depoimentos: ${error.message}`);
    if (!claimed?.length) return jsonResponse({ processed: 0, items: [] });

    for (const t of claimed) {
      const attempt = Number(t.auto_attempts || 1);
      const backoff = BACKOFF_MINUTES[Math.min(attempt - 1, BACKOFF_MINUTES.length - 1)];
      const item: Record<string, unknown> = { testimonial_id: t.id, attempt };

      try {
        // 1) Transcrição (pula se já transcrito)
        const needsTranscript = !t.transcript_raw && !t.transcript_revised;
        if (needsTranscript) {
          const step = await callStep("training-testimonial-transcribe", { testimonial_id: t.id });
          item.transcribe_status = step.status;
          if (step.status === 409 && step.json?.status === "awaiting_identification") {
            // Fica para revisão humana: a própria função já pausou auto_process.
            item.result = "awaiting_identification";
            results.push(item);
            continue;
          }
          if (!step.ok) throw new Error(step.json?.error || step.text);
        }

        // 2) Geração + publicação direta
        const pub = await callStep("training-testimonial-publish", { testimonial_id: t.id, publish: true });
        item.publish_status = pub.status;
        if (!pub.ok) throw new Error(pub.json?.error || pub.text);

        const finalStatus = String(pub.json?.status || "");
        const done = ["published", "rag_available"].includes(finalStatus);
        await db.from("training_testimonials").update({
          auto_process: !done && finalStatus !== "pending_review" && finalStatus !== "validation_failed",
          auto_last_error: null,
          auto_locked_at: null,
          auto_next_attempt_at: done ? null : new Date(Date.now() + backoff * 60_000).toISOString(),
        }).eq("id", t.id);
        item.result = finalStatus || "ok";
      } catch (e) {
        const msg = String((e as Error).message || e);
        item.result = "error";
        item.error = msg.slice(0, 300);

        if (isCreditBlock(msg)) {
          // Circuit breaker: pausa a fila inteira e sai do lote.
          await db.from("training_testimonials")
            .update({ auto_process: false, auto_locked_at: null, auto_last_error: msg.slice(0, 1000) })
            .in("status", ["uploaded", "transcribed", "awaiting_identification"]);
          await logEvent(db, t.id, "auto_process", "blocked", "Fila pausada: créditos de IA indisponíveis", { error: msg.slice(0, 500) });
          results.push(item);
          break;
        }

        const exhausted = attempt >= 3;
        await db.from("training_testimonials").update({
          auto_last_error: msg.slice(0, 1000),
          auto_locked_at: null,
          auto_process: !exhausted,
          auto_next_attempt_at: exhausted ? null : new Date(Date.now() + backoff * 60_000).toISOString(),
          ...(exhausted ? { status: "failed", review_notes: msg.slice(0, 2000) } : {}),
        }).eq("id", t.id);
        await logEvent(db, t.id, "auto_process", "error", msg.slice(0, 500), { attempt, exhausted });
      }

      results.push(item);
    }

    return jsonResponse({ processed: results.length, items: results });
  } catch (e) {
    const msg = String((e as Error).message || e);
    console.error("[training-testimonial-auto-process]", msg);
    return jsonResponse({ error: msg, items: results }, 500);
  }
});
