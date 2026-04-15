import { Hono } from "https://deno.land/x/hono@v4.3.6/mod.ts";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_AUTH_TOKEN = Deno.env.get("MCP_AUTH_TOKEN");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ALLOWED_TABLES = [
  "lia_attendances", "deals", "deal_items", "companies", "people",
  "knowledge_base", "system_a_catalog", "catalog_documents",
  "agent_interactions", "agent_knowledge_gaps", "content_requests",
  "team_members", "campaign_send_log", "campaigns", "lead_activity",
  "lead_product_history", "deal_status_history", "videos",
];

const MAX_ROWS = 50;

function verifyAuth(req: Request): Response | null {
  if (!MCP_AUTH_TOKEN) return null;
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token !== MCP_AUTH_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

const mcpServer = new McpServer({ name: "SmartDent Revenue OS", version: "1.0.0" });

// Tool 1: query_leads
mcpServer.tool("query_leads", {
  description: "Busca leads no CDP (lia_attendances). Filtros: nome, email, telefone, cidade, uf, etapa_funil, responsavel, produto_interesse, score mínimo. Retorna até 50 resultados.",
  inputSchema: {
    type: "object" as const,
    properties: {
      nome: { type: "string", description: "Filtro parcial por nome" },
      email: { type: "string", description: "Filtro parcial por email" },
      telefone: { type: "string", description: "Filtro parcial por telefone" },
      cidade: { type: "string", description: "Cidade" },
      uf: { type: "string", description: "Estado (UF) 2 letras" },
      etapa_funil: { type: "string", description: "Etapa do funil CRM" },
      responsavel: { type: "string", description: "Nome do responsável" },
      produto_interesse: { type: "string", description: "Produto de interesse" },
      score_min: { type: "number", description: "Score mínimo (intelligence_score)" },
      limit: { type: "number", description: "Max resultados (padrão 20, max 50)" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    let q = supabase
      .from("lia_attendances")
      .select("id, nome, email, telefone, cidade, uf, etapa_funil, responsavel, produto_interesse, intelligence_score, temperatura, created_at, updated_at, piperun_deal_id, real_status, total_deals_won, ltv_total")
      .is("merged_into", null)
      .order("updated_at", { ascending: false })
      .limit(Math.min(Number(params.limit) || 20, MAX_ROWS));

    if (params.nome) q = q.ilike("nome", `%${params.nome}%`);
    if (params.email) q = q.ilike("email", `%${params.email}%`);
    if (params.telefone) q = q.ilike("telefone", `%${params.telefone}%`);
    if (params.cidade) q = q.ilike("cidade", `%${params.cidade}%`);
    if (params.uf) q = q.eq("uf", String(params.uf).toUpperCase());
    if (params.etapa_funil) q = q.eq("etapa_funil", params.etapa_funil);
    if (params.responsavel) q = q.ilike("responsavel", `%${params.responsavel}%`);
    if (params.produto_interesse) q = q.ilike("produto_interesse", `%${params.produto_interesse}%`);
    if (params.score_min) q = q.gte("intelligence_score", params.score_min);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Erro: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length || 0, leads: data }, null, 2) }] };
  },
});

// Tool 2: query_stats
mcpServer.tool("query_stats", {
  description: "Métricas agregadas do CDP: total de leads, leads por etapa, score médio, por UF, temperatura.",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async () => {
    const { data: leads } = await supabase
      .from("lia_attendances")
      .select("etapa_funil, uf, intelligence_score, temperatura")
      .is("merged_into", null);

    if (!leads) return { content: [{ type: "text" as const, text: "Sem dados" }] };

    const byStage: Record<string, number> = {};
    const byUf: Record<string, number> = {};
    const byTemp: Record<string, number> = {};
    let scoreSum = 0, scoreCount = 0;

    for (const l of leads) {
      byStage[l.etapa_funil || "sem_etapa"] = (byStage[l.etapa_funil || "sem_etapa"] || 0) + 1;
      if (l.uf) byUf[l.uf] = (byUf[l.uf] || 0) + 1;
      if (l.temperatura) byTemp[l.temperatura] = (byTemp[l.temperatura] || 0) + 1;
      if (l.intelligence_score != null) { scoreSum += l.intelligence_score; scoreCount++; }
    }

    return { content: [{ type: "text" as const, text: JSON.stringify({
      total_leads: leads.length,
      por_etapa: byStage,
      por_uf: Object.entries(byUf).sort((a, b) => b[1] - a[1]).slice(0, 15),
      por_temperatura: byTemp,
      score_medio: scoreCount ? Math.round(scoreSum / scoreCount) : null,
    }, null, 2) }] };
  },
});

// Tool 3: search_content
mcpServer.tool("search_content", {
  description: "Pesquisa artigos na base de conhecimento por título, categoria ou idioma.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Termo de busca no título" },
      category: { type: "string", description: "Categoria (A-G)" },
      language: { type: "string", description: "Idioma: pt, en, es" },
      limit: { type: "number" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    let q = supabase
      .from("knowledge_base")
      .select("id, title, slug, category, language, status, meta_description, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(Math.min(Number(params.limit) || 20, MAX_ROWS));

    if (params.query) q = q.ilike("title", `%${params.query}%`);
    if (params.category) q = q.eq("category", params.category);
    if (params.language) q = q.eq("language", params.language);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Erro: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length || 0, articles: data }, null, 2) }] };
  },
});

// Tool 4: search_videos
mcpServer.tool("search_videos", {
  description: "Busca vídeos por título na tabela videos.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Termo de busca no título" },
      limit: { type: "number" },
    },
  },
  handler: async (params: Record<string, unknown>) => {
    let q = supabase
      .from("videos")
      .select("id, title, slug, duration_seconds, views_count, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(params.limit) || 20, MAX_ROWS));

    if (params.query) q = q.ilike("title", `%${params.query}%`);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Erro: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length || 0, videos: data }, null, 2) }] };
  },
});

// Tool 5: describe_table
mcpServer.tool("describe_table", {
  description: `Lista colunas de uma tabela permitida. Tabelas: ${ALLOWED_TABLES.join(", ")}`,
  inputSchema: {
    type: "object" as const,
    properties: {
      table_name: { type: "string", description: "Nome da tabela" },
    },
    required: ["table_name"],
  },
  handler: async (params: Record<string, unknown>) => {
    const table = String(params.table_name);
    if (!ALLOWED_TABLES.includes(table)) {
      return { content: [{ type: "text" as const, text: `Tabela não permitida. Permitidas: ${ALLOWED_TABLES.join(", ")}` }] };
    }
    const { data: sample } = await supabase.from(table as any).select("*").limit(1);
    if (sample && sample[0]) {
      const cols = Object.keys(sample[0]);
      return { content: [{ type: "text" as const, text: JSON.stringify({ table, columns: cols }, null, 2) }] };
    }
    return { content: [{ type: "text" as const, text: `Tabela ${table} está vazia ou inacessível.` }] };
  },
});

// Tool 6: query_table
mcpServer.tool("query_table", {
  description: "Consulta genérica (somente leitura) em tabelas permitidas. Max 50 linhas.",
  inputSchema: {
    type: "object" as const,
    properties: {
      table_name: { type: "string", description: "Nome da tabela" },
      select: { type: "string", description: "Colunas (padrão: *)" },
      filters: {
        type: "array",
        description: "Filtros: [{column, operator, value}]. Ops: eq, neq, gt, gte, lt, lte, like, ilike, is",
        items: {
          type: "object",
          properties: {
            column: { type: "string" },
            operator: { type: "string" },
            value: { type: "string" },
          },
          required: ["column", "operator", "value"],
        },
      },
      order_by: { type: "string" },
      ascending: { type: "boolean" },
      limit: { type: "number" },
    },
    required: ["table_name"],
  },
  handler: async (params: Record<string, unknown>) => {
    const table = String(params.table_name);
    if (!ALLOWED_TABLES.includes(table)) {
      return { content: [{ type: "text" as const, text: `Tabela não permitida. Permitidas: ${ALLOWED_TABLES.join(", ")}` }] };
    }

    let q = supabase.from(table as any).select(String(params.select || "*")).limit(Math.min(Number(params.limit) || 20, MAX_ROWS));
    if (table === "lia_attendances") q = q.is("merged_into", null);

    const filters = params.filters as Array<{ column: string; operator: string; value: string }> | undefined;
    if (filters) {
      for (const f of filters) {
        if (f.operator === "eq") q = q.eq(f.column, f.value);
        else if (f.operator === "neq") q = q.neq(f.column, f.value);
        else if (f.operator === "gt") q = q.gt(f.column, f.value);
        else if (f.operator === "gte") q = q.gte(f.column, f.value);
        else if (f.operator === "lt") q = q.lt(f.column, f.value);
        else if (f.operator === "lte") q = q.lte(f.column, f.value);
        else if (f.operator === "like") q = q.like(f.column, f.value);
        else if (f.operator === "ilike") q = q.ilike(f.column, f.value);
        else if (f.operator === "is") q = q.is(f.column, f.value === "null" ? null : f.value);
      }
    }

    if (params.order_by) q = q.order(String(params.order_by), { ascending: Boolean(params.ascending) });

    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Erro: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length || 0, rows: data }, null, 2) }] };
  },
});

// Tool 7: check_missing_fields
mcpServer.tool("check_missing_fields", {
  description: "Auditoria de campos faltantes em leads ativos. Verifica quais leads não possuem determinado campo preenchido.",
  inputSchema: {
    type: "object" as const,
    properties: {
      field: { type: "string", description: "Campo: email, telefone, cidade, uf, produto_interesse" },
      etapa_funil: { type: "string", description: "Filtrar por etapa (opcional)" },
      limit: { type: "number" },
    },
    required: ["field"],
  },
  handler: async (params: Record<string, unknown>) => {
    const field = String(params.field);
    const allowed = ["email", "telefone", "cidade", "uf", "produto_interesse"];
    if (!allowed.includes(field)) {
      return { content: [{ type: "text" as const, text: `Campo não permitido. Permitidos: ${allowed.join(", ")}` }] };
    }

    let q = supabase
      .from("lia_attendances")
      .select("id, nome, email, telefone, etapa_funil, responsavel")
      .is("merged_into", null)
      .is(field, null)
      .order("updated_at", { ascending: false })
      .limit(Math.min(Number(params.limit) || 30, MAX_ROWS));

    if (params.etapa_funil) q = q.eq("etapa_funil", params.etapa_funil);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `Erro: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ field_missing: field, count: data?.length || 0, leads: data }, null, 2) }] };
  },
});

// ── HTTP ──
const transport = new StreamableHttpTransport();
const app = new Hono();

app.all("/*", async (c) => {
  const authError = verifyAuth(c.req.raw);
  if (authError) return authError;
  return await transport.handleRequest(c.req.raw, mcpServer);
});

Deno.serve(app.fetch);
