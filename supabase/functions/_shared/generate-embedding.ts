/**
 * Centralized embedding generation utility.
 * Supports text-only (embedding-001) and multimodal (embedding-2-preview) via Matryoshka 768 dims.
 * 
 * Usage:
 *   import { generateEmbedding, generateTextEmbedding } from "../_shared/generate-embedding.ts";
 */

const GOOGLE_AI_KEY = () => Deno.env.get("GOOGLE_AI_KEY") || "";

// ── Model configuration ─────────────────────────────────────────────────────
// Phase 1: text-only with embedding-001
// Phase 2+: switch to gemini-embedding-2-preview for unified multimodal space
const EMBEDDING_MODEL = Deno.env.get("EMBEDDING_MODEL") || "gemini-embedding-001";
const EMBEDDING_DIMS = 768;

export interface EmbedInput {
  /** Text content to embed */
  text?: string;
  /** Image content for multimodal embedding (requires embedding-2-preview) */
  image?: { mimeType: string; base64Data: string };
  /** Task type: RETRIEVAL_DOCUMENT for indexing, RETRIEVAL_QUERY for search */
  taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
}

/**
 * Generate an embedding vector (768 dims) from text and/or image input.
 * Returns null on failure instead of throwing — caller decides how to handle.
 */
export async function generateEmbedding(input: EmbedInput): Promise<number[] | null> {
  const apiKey = GOOGLE_AI_KEY();
  if (!apiKey) {
    console.warn("[generate-embedding] GOOGLE_AI_KEY not set");
    return null;
  }

  const parts: Array<Record<string, unknown>> = [];

  if (input.text) {
    parts.push({ text: input.text });
  }

  if (input.image) {
    // Multimodal: requires embedding-2-preview model
    if (!EMBEDDING_MODEL.includes("embedding-2")) {
      console.warn("[generate-embedding] Image input requires gemini-embedding-2-preview model. Falling back to text-only.");
      if (!input.text) return null;
      // Strip image, continue with text only
    } else {
      parts.push({
        inline_data: {
          mime_type: input.image.mimeType,
          data: input.image.base64Data,
        },
      });
    }
  }

  if (parts.length === 0) {
    console.warn("[generate-embedding] No input provided");
    return null;
  }

  const taskType = input.taskType || "RETRIEVAL_DOCUMENT";
  const modelId = EMBEDDING_MODEL.startsWith("models/")
    ? EMBEDDING_MODEL.replace("models/", "")
    : EMBEDDING_MODEL;
  const modelFull = EMBEDDING_MODEL.startsWith("models/")
    ? EMBEDDING_MODEL
    : `models/${EMBEDDING_MODEL}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelFull,
          content: { parts },
          taskType,
          outputDimensionality: EMBEDDING_DIMS,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`[generate-embedding] API error ${response.status}: ${err.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const values = data.embedding?.values || [];
    if (values.length === 0) {
      console.warn("[generate-embedding] Empty embedding returned");
      return null;
    }
    return values;
  } catch (err) {
    console.error("[generate-embedding] Fetch error:", err);
    return null;
  }
}

/**
 * Convenience: generate a text-only embedding for indexing documents.
 * Throws on failure (for batch indexing where failures should halt).
 */
export async function generateTextEmbedding(text: string, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"): Promise<number[]> {
  const result = await generateEmbedding({ text, taskType });
  if (!result || result.length === 0) {
    throw new Error("Failed to generate text embedding");
  }
  return result;
}

/**
 * Generate a multimodal embedding from an image (optionally with text context).
 * Returns null if the current model doesn't support multimodal.
 */
export async function generateImageEmbedding(
  base64Data: string,
  mimeType: string,
  contextText?: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_QUERY"
): Promise<number[] | null> {
  return generateEmbedding({
    text: contextText,
    image: { mimeType, base64Data },
    taskType,
  });
}

/**
 * Check if the current model supports multimodal (image) embedding.
 */
export function isMultimodalEnabled(): boolean {
  return EMBEDDING_MODEL.includes("embedding-2");
}
