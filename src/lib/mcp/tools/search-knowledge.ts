import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "search_knowledge",
  title: "Buscar conteúdo",
  description:
    "Pesquisa artigos publicados na base de conhecimento (knowledge_base) por título, categoria e idioma.",
  inputSchema: {
    query: z.string().optional().describe("Termo de busca no título"),
    category: z.string().optional().describe("Categoria (A-G)"),
    language: z.enum(["pt", "en", "es"]).optional().describe("Idioma"),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, language, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase
      .from("knowledge_base")
      .select("id, title, slug, category, language, status, meta_description, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (query) q = q.ilike("title", `%${query}%`);
    if (category) q = q.eq("category", category);
    if (language) q = q.eq("language", language);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Erro: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ count: data?.length ?? 0, articles: data }, null, 2) }],
      structuredContent: { count: data?.length ?? 0, articles: data },
    };
  },
});