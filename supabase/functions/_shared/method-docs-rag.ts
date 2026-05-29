/**
 * Method-docs RAG helpers — chunking, embedding e similarity matching
 * para a tabela `smartdent_method_docs`.
 *
 * Reaproveita `generate-embedding.ts` (gemini-embedding-001, 768d, cache SHA256).
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateTextEmbedding } from "./generate-embedding.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let _admin: SupabaseClient | null = null;
export function getAdminClient(): SupabaseClient {
  if (!_admin) _admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export const ALLOWED_DOC_TYPES = [
  "icp_positive",
  "icp_negative",
  "workflow_stage",
  "product_positioning",
  "competitor_play",
  "methodology",
  "script",
  "outro",
] as const;
export type DocType = (typeof ALLOWED_DOC_TYPES)[number];

export function normalizeDocType(input?: string | null): DocType {
  const v = String(input || "").toLowerCase().trim();
  return (ALLOWED_DOC_TYPES as readonly string[]).includes(v) ? (v as DocType) : "outro";
}

export function slugify(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

/**
 * Quebra texto em chunks ~chunkSize chars com overlap. Quebra em parágrafos / sentenças
 * para não cortar no meio de uma frase.
 */
export function chunkText(text: string, chunkSize = 1000, overlap = 150): string[] {
  const clean = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + chunkSize, clean.length);
    // Tenta quebrar em \n\n, depois \n, depois ". "
    if (end < clean.length) {
      const window = clean.slice(i, end);
      const breaks = [
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("! "),
        window.lastIndexOf("? "),
      ].filter((x) => x > chunkSize * 0.5);
      if (breaks.length > 0) end = i + Math.max(...breaks) + 1;
    }
    const piece = clean.slice(i, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return chunks;
}

/** Aproxima contagem de tokens (4 chars/token). */
export function approxTokens(s: string): number {
  return Math.ceil(String(s || "").length / 4);
}

/**
 * Gera embedding de uma query e busca chunks similares.
 * Retorna [] se embedding falhar (não lança).
 */
export async function matchMethodDocs(opts: {
  query: string;
  matchCount?: number;
  threshold?: number;
  audience?: string[];
  products?: string[];
  docType?: DocType | string;
}): Promise<Array<{
  id: string;
  source_doc_id: string;
  title: string;
  doc_type: string;
  target_audience: string[];
  target_products: string[];
  body_md: string;
  similarity: number;
}>> {
  const { query, matchCount = 8, threshold = 0.55, audience, products, docType } = opts;
  if (!query?.trim()) return [];

  let embedding: number[];
  try {
    embedding = await generateTextEmbedding(query, "RETRIEVAL_QUERY");
  } catch (e) {
    console.warn("[method-docs-rag] embedding fail:", (e as Error).message);
    return [];
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc("match_method_docs", {
    query_embedding: embedding,
    match_count: matchCount,
    match_threshold: threshold,
    filter_audience: audience?.length ? audience : null,
    filter_products: products?.length ? products : null,
    filter_doc_type: docType || null,
  });
  if (error) {
    console.error("[method-docs-rag] RPC error:", error.message);
    return [];
  }
  return (data || []) as any;
}

/**
 * Inserção em lote de chunks já-embedados.
 */
export async function insertMethodDocChunks(rows: Array<{
  source_doc_id: string;
  chunk_index: number;
  title: string;
  slug?: string | null;
  doc_type: string;
  target_audience: string[];
  target_products: string[];
  body_md: string;
  embedding: number[] | null;
  tokens: number;
  uploaded_by?: string | null;
  source_storage_path?: string | null;
  source_metadata?: Record<string, unknown>;
}>): Promise<{ inserted: number; error?: string }> {
  if (rows.length === 0) return { inserted: 0 };
  const supabase = getAdminClient();
  const { error } = await supabase.from("smartdent_method_docs").insert(rows);
  if (error) return { inserted: 0, error: error.message };
  return { inserted: rows.length };
}

/** Soft-delete (active=false) de todos os chunks de um source_doc_id. */
export async function deactivateSourceDoc(sourceDocId: string): Promise<void> {
  const supabase = getAdminClient();
  await supabase.from("smartdent_method_docs")
    .update({ active: false })
    .eq("source_doc_id", sourceDocId);
}