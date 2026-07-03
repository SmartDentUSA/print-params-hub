import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "query_leads",
  title: "Consultar leads",
  description:
    "Busca leads canônicos no CDP (lia_attendances, merged_into IS NULL). Filtros por nome, email, telefone, UF e etapa.",
  inputSchema: {
    nome: z.string().optional().describe("Filtro parcial por nome"),
    email: z.string().optional().describe("Filtro parcial por email"),
    telefone: z.string().optional().describe("Filtro parcial por telefone"),
    uf: z.string().length(2).optional().describe("UF de 2 letras"),
    etapa_funil: z.string().optional().describe("Etapa do funil CRM"),
    limit: z.number().int().min(1).max(50).optional().describe("Max resultados (padrão 20)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ nome, email, telefone, uf, etapa_funil, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase
      .from("lia_attendances")
      .select(
        "id, nome, email, telefone, cidade, uf, etapa_funil, responsavel, produto_interesse, intelligence_score, temperatura, real_status, total_deals_won, ltv_total, updated_at",
      )
      .is("merged_into", null)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (nome) q = q.ilike("nome", `%${nome}%`);
    if (email) q = q.ilike("email", `%${email}%`);
    if (telefone) q = q.ilike("telefone", `%${telefone}%`);
    if (uf) q = q.eq("uf", uf.toUpperCase());
    if (etapa_funil) q = q.eq("etapa_funil", etapa_funil);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Erro: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ count: data?.length ?? 0, leads: data }, null, 2) }],
      structuredContent: { count: data?.length ?? 0, leads: data },
    };
  },
});