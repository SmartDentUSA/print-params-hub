/**
 * copilot-ingest-method-doc
 *
 * Recebe um documento (URL, storage path, ou texto inline), extrai → chunka →
 * embeda → insere em `smartdent_method_docs`. Usado pela tool `ingest_method_doc`
 * do Copilot para alimentar a RAG da Smart Dent.
 *
 * Body: {
 *   source_url?: string,            // URL externa para baixar
 *   storage_path?: string,          // path no bucket smartdent-method-docs
 *   text_inline?: string,           // texto cru (sem extração)
 *   filename?: string,              // usado p/ inferir mime
 *   title?: string,
 *   doc_type?: string,
 *   target_audience?: string[],
 *   target_products?: string[],
 *   replace_existing?: string,      // source_doc_id antigo a desativar
 *   uploaded_by?: string,
 * }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  approxTokens,
  chunkText,
  deactivateSourceDoc,
  getAdminClient,
  insertMethodDocChunks,
  normalizeDocType,
  slugify,
} from "../_shared/method-docs-rag.ts";
import { generateTextEmbedding } from "../_shared/generate-embedding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const CLASSIFIER_MODEL = "google/gemini-3-flash-preview";

// ─── Extractors ─────────────────────────────────────────────────────────────
async function extractText(bytes: Uint8Array, mime: string, filename: string): Promise<string> {
  const lower = (filename || "").toLowerCase();
  const isPdf = mime.includes("pdf") || lower.endsWith(".pdf");
  const isDocx = mime.includes("officedocument") || lower.endsWith(".docx");
  const isTextual =
    mime.startsWith("text/") || lower.endsWith(".md") || lower.endsWith(".txt") || lower.endsWith(".markdown");

  if (isTextual) {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  if (isPdf) {
    // pdf-parse via npm + Node Buffer shim
    const pdfParse = (await import("npm:pdf-parse@1.1.1")).default;
    const buf = (globalThis as any).Buffer
      ? (globalThis as any).Buffer.from(bytes)
      : bytes;
    const data = await pdfParse(buf as any);
    return String(data?.text || "");
  }
  if (isDocx) {
    const mammoth = await import("npm:mammoth@1.6.0");
    const buffer = (globalThis as any).Buffer
      ? (globalThis as any).Buffer.from(bytes)
      : bytes;
    const result = await (mammoth as any).extractRawText({ buffer });
    return String(result?.value || "");
  }
  // fallback: tenta decodificar como texto
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; mime: string; filename: string }> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download falhou (${resp.status}) — ${url}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  const mime = resp.headers.get("content-type") || "application/octet-stream";
  const filename = url.split("?")[0].split("/").pop() || "documento";
  return { bytes: buf, mime, filename };
}

async function downloadFromStorage(path: string): Promise<{ bytes: Uint8Array; mime: string; filename: string }> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.storage.from("smartdent-method-docs").download(path);
  if (error || !data) throw new Error(`storage download falhou: ${error?.message || "vazio"}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  const filename = path.split("/").pop() || "documento";
  return { bytes, mime: data.type || "application/octet-stream", filename };
}

// ─── Classificador (LLM) — preenche doc_type/audience/products quando faltam ─
async function classifyDocument(
  preview: string,
  hint: { title: string; doc_type?: string; audience?: string[]; products?: string[] },
): Promise<{ doc_type: string; target_audience: string[]; target_products: string[] }> {
  // Se já veio tudo, não chama LLM
  if (hint.doc_type && hint.audience?.length && hint.products) {
    return {
      doc_type: normalizeDocType(hint.doc_type),
      target_audience: hint.audience,
      target_products: hint.products,
    };
  }
  if (!LOVABLE_API_KEY) {
    return {
      doc_type: normalizeDocType(hint.doc_type),
      target_audience: hint.audience || [],
      target_products: hint.products || [],
    };
  }

  const sys = `Você classifica documentos da Smart Dent (odontologia digital, scanners, impressão 3D, resinas, workflow protético).
Retorne APENAS JSON válido no schema:
{"doc_type":"icp_positive|icp_negative|workflow_stage|product_positioning|competitor_play|methodology|script|outro",
 "target_audience":["protodontista","dentista_clinico","radiologista","cd_implantodontista","clinica","laboratorio","distribuidor","outro"],
 "target_products":["nome-produto-slug",...]}
Use slugs minúsculos com hífen. Não invente produtos — extraia só os mencionados.`;
  const user = `TÍTULO: ${hint.title}\n\nTRECHO INICIAL DO DOCUMENTO:\n${preview.slice(0, 3000)}`;
  try {
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: CLASSIFIER_MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) throw new Error(`classifier http ${resp.status}`);
    const j = await resp.json();
    const content = j?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return {
      doc_type: normalizeDocType(hint.doc_type || parsed.doc_type),
      target_audience: hint.audience?.length ? hint.audience : (parsed.target_audience || []),
      target_products: hint.products?.length ? hint.products : (parsed.target_products || []),
    };
  } catch (e) {
    console.warn("[ingest] classifier fail:", (e as Error).message);
    return {
      doc_type: normalizeDocType(hint.doc_type),
      target_audience: hint.audience || [],
      target_products: hint.products || [],
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      source_url,
      storage_path,
      text_inline,
      filename,
      title,
      doc_type,
      target_audience,
      target_products,
      replace_existing,
      uploaded_by,
    } = body || {};

    if (!source_url && !storage_path && !text_inline) {
      return new Response(
        JSON.stringify({ error: "Forneça source_url, storage_path ou text_inline." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── 1. Obter texto ───
    let rawText = "";
    let resolvedFilename = filename || "documento";
    let storagePath: string | null = storage_path || null;
    if (text_inline) {
      rawText = String(text_inline);
    } else if (storage_path) {
      const { bytes, mime, filename: fn } = await downloadFromStorage(storage_path);
      resolvedFilename = filename || fn;
      rawText = await extractText(bytes, mime, resolvedFilename);
    } else if (source_url) {
      const { bytes, mime, filename: fn } = await fetchBytes(source_url);
      resolvedFilename = filename || fn;
      rawText = await extractText(bytes, mime, resolvedFilename);
    }

    rawText = rawText.trim();
    if (!rawText) {
      return new Response(
        JSON.stringify({ error: "Documento vazio ou texto não extraível." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resolvedTitle = (title || resolvedFilename || "Documento Smart Dent").slice(0, 200);

    // ─── 2. Classificação (se faltam metadados) ───
    const meta = await classifyDocument(rawText.slice(0, 4000), {
      title: resolvedTitle,
      doc_type,
      audience: target_audience,
      products: target_products,
    });

    // ─── 3. Replace existing ───
    if (replace_existing) {
      await deactivateSourceDoc(String(replace_existing));
    }
    const sourceDocId = crypto.randomUUID();

    // ─── 4. Chunk + embed ───
    const chunks = chunkText(rawText, 1000, 150);
    const rows: any[] = [];
    let embedFails = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let embedding: number[] | null = null;
      try {
        embedding = await generateTextEmbedding(chunk, "RETRIEVAL_DOCUMENT");
      } catch {
        embedFails++;
      }
      rows.push({
        source_doc_id: sourceDocId,
        chunk_index: i,
        title: resolvedTitle,
        slug: slugify(resolvedTitle),
        doc_type: meta.doc_type,
        target_audience: meta.target_audience,
        target_products: meta.target_products,
        body_md: chunk,
        embedding,
        tokens: approxTokens(chunk),
        uploaded_by: uploaded_by || null,
        source_storage_path: storagePath,
        source_metadata: { filename: resolvedFilename, source_url: source_url || null },
      });
    }

    // ─── 5. Inserir em lote (50/batch para não estourar payload) ───
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const slice = rows.slice(i, i + 50);
      const res = await insertMethodDocChunks(slice);
      if (res.error) {
        return new Response(
          JSON.stringify({ error: `insert falhou: ${res.error}`, partial_inserted: inserted }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      inserted += res.inserted;
    }

    const preview = rawText.slice(0, 300).replace(/\s+/g, " ");
    return new Response(
      JSON.stringify({
        success: true,
        source_doc_id: sourceDocId,
        chunks: inserted,
        doc_type: meta.doc_type,
        target_audience: meta.target_audience,
        target_products: meta.target_products,
        title: resolvedTitle,
        embed_failures: embedFails,
        preview,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[copilot-ingest-method-doc] error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message || "erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});