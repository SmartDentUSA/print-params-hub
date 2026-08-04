// Busca RAG usada na produção de conteúdo de treinamentos.
// Regras: só retorna trechos com score acima do limiar, deduplica por título de
// documento, prioriza conteúdo estruturado sobre mídia e nunca inventa fonte.

export interface RagSource {
  source_type: string;
  title: string;
  chunk: string;
  score: number;
  url: string | null;
}

const MATCH_THRESHOLD = 0.56;

const PRIORITY: Record<string, number> = {
  knowledge_content: 0,
  knowledge_contents: 0,
  article: 0,
  smartdent_method: 1,
  product: 2,
  products_catalog: 2,
  course: 3,
  video: 5,
  knowledge_video: 5,
};

function priorityOf(sourceType: string): number {
  return PRIORITY[String(sourceType || "").toLowerCase()] ?? 4;
}

function titleOf(meta: any, fallback: string): string {
  return String(meta?.title || meta?.name || fallback || "").trim();
}

export async function searchTrainingRag(
  db: any,
  query: string,
  limit = 6,
): Promise<{ query: string; threshold: number; sources: RagSource[] }> {
  const clean = String(query || "").trim();
  if (!clean) return { query: "", threshold: MATCH_THRESHOLD, sources: [] };

  let sources: RagSource[] = [];
  try {
    const { generateEmbedding } = await import("./generate-embedding.ts");
    const embedding = await generateEmbedding({ text: clean, taskType: "RETRIEVAL_QUERY" });
    if (embedding) {
      const { data, error } = await db.rpc("match_agent_embeddings", {
        query_embedding: embedding,
        match_threshold: MATCH_THRESHOLD,
        match_count: Math.max(limit * 3, 12),
      });
      if (error) throw new Error(error.message);
      const seen = new Set<string>();
      sources = (data || [])
        .map((r: any) => ({
          source_type: String(r.source_type || "desconhecido"),
          title: titleOf(r.metadata, r.source_type),
          chunk: String(r.chunk_text || "").slice(0, 700),
          score: Number(r.similarity ?? r.score ?? 0),
          url: r.metadata?.url || r.metadata?.canonical_url || null,
        }))
        .filter((s: RagSource) => s.score >= MATCH_THRESHOLD && s.chunk)
        .sort((a: RagSource, b: RagSource) => priorityOf(a.source_type) - priorityOf(b.source_type) || b.score - a.score)
        .filter((s: RagSource) => {
          const key = `${s.source_type}|${s.title.toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, limit);
    }
  } catch (e) {
    console.warn("[training-rag]", String((e as any)?.message || e));
  }

  return { query: clean, threshold: MATCH_THRESHOLD, sources };
}

/** Monta a consulta RAG a partir do contexto real da turma. */
export function buildTrainingRagQuery(input: {
  course_title?: string | null;
  stage_topic?: string | null;
  equipment?: string[];
  products?: string[];
  extra?: string | null;
}): string {
  return [
    input.course_title || "",
    input.stage_topic || "",
    (input.products || []).slice(0, 4).join(" "),
    (input.equipment || []).slice(0, 4).join(" "),
    input.extra || "",
  ]
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 600);
}