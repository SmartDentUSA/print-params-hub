import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const tools = [
  {
    type: "function",
    function: {
      name: "query_leads",
      description: "Busca leads na tabela lia_attendances por qualquer filtro: email, nome, telefone, cidade, tags, equipamento, score, etapa CRM, etc. Retorna até 50 resultados.",
      parameters: {
        type: "object",
        properties: {
          filters: { type: "object", description: "Filtros como {email: '...', cidade: '...', etapa_crm: '...'}" },
          select: { type: "string", description: "Colunas a retornar (padrão: id,nome,email,telefone,etapa_crm,cidade,intelligence_score_total)" },
          limit: { type: "number", description: "Máximo de resultados (padrão 20, máx 50)" },
          search_text: { type: "string", description: "Busca textual no nome ou email" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_lead",
      description: "Atualiza campos de um lead pelo ID. Pode alterar tags, status, campos SDR, notas, etc.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "UUID do lead" },
          updates: { type: "object", description: "Campos a atualizar ex: {etapa_crm: 'negociacao', notas_sdr: '...'}" }
        },
        required: ["lead_id", "updates"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_tags",
      description: "Adiciona tags ao campo tags_crm de um lead (array de strings). Não remove tags existentes.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "UUID do lead" },
          tags: { type: "array", items: { type: "string" }, description: "Tags a adicionar" }
        },
        required: ["lead_id", "tags"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_audience",
      description: "Cria um público/segmento filtrando leads por critérios complexos. Retorna lista de leads que atendem aos critérios.",
      parameters: {
        type: "object",
        properties: {
          filters: { type: "object", description: "Filtros complexos: {cidade: '...', tem_impressora: 'sim', etapa_crm: '...', min_score: 50}" },
          description: { type: "string", description: "Descrição do público criado" }
        },
        required: ["filters"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_whatsapp",
      description: "Envia mensagem WhatsApp para um lead via WaLeads. Precisa do telefone do lead.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "UUID do lead" },
          phone: { type: "string", description: "Telefone do lead com DDD" },
          message: { type: "string", description: "Mensagem a enviar" }
        },
        required: ["phone", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "notify_seller",
      description: "Notifica um vendedor/membro da equipe sobre um lead. Busca o vendedor pelo nome na tabela team_members.",
      parameters: {
        type: "object",
        properties: {
          seller_name: { type: "string", description: "Nome do vendedor" },
          lead_id: { type: "string", description: "UUID do lead" },
          message: { type: "string", description: "Mensagem de notificação" }
        },
        required: ["seller_name", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_videos",
      description: "Busca vídeos na base de conhecimento por título, tags ou transcrição.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca" },
          limit: { type: "number", description: "Máximo de resultados (padrão 10)" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_content",
      description: "Busca artigos publicados na base de conhecimento por título, excerpt ou conteúdo.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca" },
          limit: { type: "number", description: "Máximo de resultados (padrão 10)" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_table",
      description: "Consulta genérica em qualquer tabela do sistema. Retorna até 50 registros.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Nome da tabela" },
          select: { type: "string", description: "Colunas (padrão *)" },
          filters: { type: "object", description: "Filtros como {campo: valor}" },
          limit: { type: "number", description: "Máximo de resultados" },
          order_by: { type: "string", description: "Coluna para ordenar" },
          ascending: { type: "boolean", description: "Ordem ascendente (padrão false)" }
        },
        required: ["table"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "describe_table",
      description: "Lista as colunas e tipos de uma tabela do banco de dados.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Nome da tabela" }
        },
        required: ["table"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_stats",
      description: "Retorna métricas agregadas: contagem de leads por etapa, score médio, vendas, etc.",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string", description: "Tipo de métrica: leads_por_etapa, score_medio, leads_por_cidade, leads_por_origem, total_leads, leads_recentes" }
        },
        required: ["metric"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_missing_fields",
      description: "Verifica campos nulos/vazios em leads. Útil para auditoria de dados.",
      parameters: {
        type: "object",
        properties: {
          fields: { type: "array", items: { type: "string" }, description: "Campos a verificar ex: ['telefone','email','cidade']" },
          lead_ids: { type: "array", items: { type: "string" }, description: "IDs específicos (opcional, senão verifica todos)" },
          limit: { type: "number", description: "Máximo de resultados" }
        },
        required: ["fields"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_to_sellflux",
      description: "Envia lead para campanha SellFlux via webhook.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "UUID do lead" },
          webhook_type: { type: "string", enum: ["leads", "campanhas"], description: "Tipo de webhook" }
        },
        required: ["lead_id", "webhook_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "call_loja_integrada",
      description: "Consulta a API da Loja Integrada para buscar pedidos, clientes ou produtos.",
      parameters: {
        type: "object",
        properties: {
          endpoint: { type: "string", description: "Endpoint: pedido, cliente, produto" },
          params: { type: "object", description: "Parâmetros da consulta" }
        },
        required: ["endpoint"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "unify_leads",
      description: "Encontra e mescla leads duplicados pelo email ou telefone. Mantém o mais completo.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Email para buscar duplicatas" },
          phone: { type: "string", description: "Telefone para buscar duplicatas" },
          dry_run: { type: "boolean", description: "Se true, apenas lista duplicatas sem mesclar" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ingest_knowledge",
      description: "Injeta texto na base de conhecimento do RAG da LIA.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título do conteúdo" },
          content: { type: "string", description: "Texto do conteúdo" },
          category: { type: "string", description: "Categoria" }
        },
        required: ["title", "content", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_article",
      description: "Cria um artigo na base de conhecimento usando o orquestrador de conteúdo IA.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título do artigo" },
          topic: { type: "string", description: "Tópico/tema do artigo" },
          keywords: { type: "array", items: { type: "string" }, description: "Palavras-chave" }
        },
        required: ["title", "topic"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "import_csv",
      description: "Importa dados de um CSV (enviado como texto) para a tabela de leads.",
      parameters: {
        type: "object",
        properties: {
          csv_data: { type: "string", description: "Conteúdo do CSV como texto" },
          mapping: { type: "object", description: "Mapeamento de colunas CSV para campos do lead" }
        },
        required: ["csv_data"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Realiza cálculos customizados: ROI, churn, LTV, conversão, etc.",
      parameters: {
        type: "object",
        properties: {
          calculation: { type: "string", description: "Tipo: roi, ltv, churn, conversion_rate, custom" },
          params: { type: "object", description: "Parâmetros do cálculo" }
        },
        required: ["calculation"]
      }
    }
  }
];

// --- TOOL EXECUTORS ---

async function executeQueryLeads(args: any) {
  const select = args.select || "id,nome,email,telefone,etapa_crm,cidade,intelligence_score_total,tags_crm";
  const limit = Math.min(args.limit || 20, 50);
  let query = supabase.from("lia_attendances").select(select).limit(limit);

  if (args.filters) {
    for (const [key, value] of Object.entries(args.filters)) {
      if (typeof value === "string") {
        query = query.ilike(key, `%${value}%`);
      } else {
        query = query.eq(key, value);
      }
    }
  }
  if (args.search_text) {
    query = query.or(`nome.ilike.%${args.search_text}%,email.ilike.%${args.search_text}%`);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length || 0, leads: data };
}

async function executeUpdateLead(args: any) {
  const safeFields = [
    "etapa_crm", "notas_sdr", "tags_crm", "urgency_level", "interest_timeline",
    "como_digitaliza", "especialidade", "cidade", "area_atuacao",
    "tem_impressora", "tem_scanner", "software_cad", "volume_mensal_pecas",
    "informacao_desejada", "comentario_perda", "cs_treinamento",
    "proprietario_lead_crm", "funil_entrada_crm"
  ];
  const updates: any = {};
  for (const [key, value] of Object.entries(args.updates)) {
    if (safeFields.includes(key)) updates[key] = value;
  }
  if (Object.keys(updates).length === 0) return { error: "Nenhum campo permitido para atualização" };

  const { data, error } = await supabase.from("lia_attendances").update(updates).eq("id", args.lead_id).select("id,nome,email").single();
  if (error) return { error: error.message };
  return { success: true, lead: data };
}

async function executeAddTags(args: any) {
  const { data: lead } = await supabase.from("lia_attendances").select("tags_crm").eq("id", args.lead_id).single();
  const existing = Array.isArray(lead?.tags_crm) ? lead.tags_crm : [];
  const merged = [...new Set([...existing, ...args.tags])];
  const { error } = await supabase.from("lia_attendances").update({ tags_crm: merged }).eq("id", args.lead_id);
  if (error) return { error: error.message };
  return { success: true, tags: merged };
}

async function executeCreateAudience(args: any) {
  let query = supabase.from("lia_attendances").select("id,nome,email,telefone,etapa_crm,cidade,intelligence_score_total").limit(50);
  const f = args.filters || {};
  for (const [key, value] of Object.entries(f)) {
    if (key === "min_score") {
      query = query.gte("intelligence_score_total", value);
    } else if (typeof value === "string") {
      query = query.ilike(key, `%${value}%`);
    } else {
      query = query.eq(key, value);
    }
  }
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { description: args.description || "Público criado", count: data?.length || 0, leads: data };
}

async function executeSendWhatsapp(args: any) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-send-waleads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ phone: args.phone, message: args.message, lead_id: args.lead_id })
    });
    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const text = await response.text();
      return { error: `Resposta não-JSON: ${text.slice(0, 200)}` };
    }
    const result = await response.json();
    return result;
  } catch (e) {
    return { error: e.message };
  }
}

async function executeNotifySeller(args: any) {
  const { data: sellers } = await supabase.from("team_members").select("id,nome,telefone,email").ilike("nome", `%${args.seller_name}%`).limit(3);
  if (!sellers || sellers.length === 0) return { error: `Vendedor "${args.seller_name}" não encontrado` };
  const seller = sellers[0];
  // Try to send WhatsApp notification to seller
  if (seller.telefone) {
    const msg = args.message + (args.lead_id ? ` (Lead ID: ${args.lead_id})` : "");
    await executeSendWhatsapp({ phone: seller.telefone, message: msg });
  }
  return { success: true, seller: { nome: seller.nome, email: seller.email }, notification_sent: !!seller.telefone };
}

async function executeSearchVideos(args: any) {
  const limit = Math.min(args.limit || 10, 30);
  const { data, error } = await supabase.from("knowledge_videos")
    .select("id,title,description,thumbnail_url,url,embed_url,video_type,panda_tags")
    .or(`title.ilike.%${args.query}%,description.ilike.%${args.query}%`)
    .limit(limit);
  if (error) return { error: error.message };
  return { count: data?.length || 0, videos: data };
}

async function executeSearchContent(args: any) {
  const limit = Math.min(args.limit || 10, 30);
  const { data, error } = await supabase.from("knowledge_contents")
    .select("id,title,excerpt,slug,keywords,meta_description")
    .eq("active", true)
    .or(`title.ilike.%${args.query}%,excerpt.ilike.%${args.query}%`)
    .limit(limit);
  if (error) return { error: error.message };
  return { count: data?.length || 0, articles: data };
}

async function executeQueryTable(args: any) {
  const allowedTables = [
    "lia_attendances", "knowledge_contents", "knowledge_videos", "knowledge_categories",
    "system_a_catalog", "catalog_documents", "brands", "models", "resins",
    "agent_interactions", "agent_knowledge_gaps", "cs_automation_rules",
    "team_members", "ai_token_usage", "external_links", "leads", "content_requests",
    "lead_state_events", "company_kb_texts", "intelligence_score_config"
  ];
  if (!allowedTables.includes(args.table)) return { error: `Tabela "${args.table}" não permitida. Tabelas disponíveis: ${allowedTables.join(", ")}` };

  const select = args.select || "*";
  const limit = Math.min(args.limit || 20, 50);
  let query = supabase.from(args.table).select(select).limit(limit);
  if (args.filters) {
    for (const [key, value] of Object.entries(args.filters)) {
      if (typeof value === "string") query = query.ilike(key, `%${value}%`);
      else query = query.eq(key, value);
    }
  }
  if (args.order_by) query = query.order(args.order_by, { ascending: args.ascending ?? false });
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { table: args.table, count: data?.length || 0, rows: data };
}

async function executeDescribeTable(args: any) {
  // Return known schema info
  const schemas: Record<string, string[]> = {
    lia_attendances: ["id","nome","email","telefone","cidade","etapa_crm","tags_crm","intelligence_score_total","urgency_level","interest_timeline","tem_impressora","tem_scanner","especialidade","created_at","proprietario_lead_crm","total_messages","total_sessions"],
    knowledge_contents: ["id","title","excerpt","slug","content_html","category_id","keywords","active","author_id","created_at"],
    knowledge_videos: ["id","title","description","url","embed_url","thumbnail_url","video_type","panda_tags","content_id"],
    team_members: ["id","nome","email","telefone","papel","ativo"],
    system_a_catalog: ["id","product_name","slug","brand","category","subcategory","active"]
  };
  return { table: args.table, columns: schemas[args.table] || ["Use query_table para explorar"] };
}

async function executeQueryStats(args: any) {
  switch (args.metric) {
    case "total_leads": {
      const { count } = await supabase.from("lia_attendances").select("id", { count: "exact", head: true });
      return { metric: "total_leads", value: count };
    }
    case "leads_por_etapa": {
      const { data } = await supabase.from("lia_attendances").select("etapa_crm").not("etapa_crm", "is", null);
      const grouped: Record<string, number> = {};
      data?.forEach((l: any) => { grouped[l.etapa_crm] = (grouped[l.etapa_crm] || 0) + 1; });
      return { metric: "leads_por_etapa", data: grouped };
    }
    case "leads_por_cidade": {
      const { data } = await supabase.from("lia_attendances").select("cidade").not("cidade", "is", null).limit(500);
      const grouped: Record<string, number> = {};
      data?.forEach((l: any) => { grouped[l.cidade] = (grouped[l.cidade] || 0) + 1; });
      const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 20);
      return { metric: "leads_por_cidade", data: Object.fromEntries(sorted) };
    }
    case "score_medio": {
      const { data } = await supabase.from("lia_attendances").select("intelligence_score_total").not("intelligence_score_total", "is", null).limit(500);
      const scores = data?.map((l: any) => l.intelligence_score_total).filter(Boolean) || [];
      const avg = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
      return { metric: "score_medio", value: avg, total_com_score: scores.length };
    }
    case "leads_recentes": {
      const { data } = await supabase.from("lia_attendances").select("id,nome,email,created_at,etapa_crm").order("created_at", { ascending: false }).limit(10);
      return { metric: "leads_recentes", leads: data };
    }
    default:
      return { error: `Métrica "${args.metric}" não reconhecida. Use: total_leads, leads_por_etapa, leads_por_cidade, score_medio, leads_recentes` };
  }
}

async function executeCheckMissingFields(args: any) {
  const fields = args.fields || [];
  let query = supabase.from("lia_attendances").select(`id,nome,email,${fields.join(",")}`).limit(args.limit || 20);
  if (args.lead_ids?.length) query = query.in("id", args.lead_ids);
  // Filter where any field is null
  for (const f of fields) {
    query = query.is(f, null);
  }
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { missing_fields: fields, count: data?.length || 0, leads: data };
}

async function executeSendToSellflux(args: any) {
  const { data: lead } = await supabase.from("lia_attendances").select("nome,email,telefone").eq("id", args.lead_id).single();
  if (!lead) return { error: "Lead não encontrado" };
  const webhookKey = args.webhook_type === "campanhas" ? "SELLFLUX_WEBHOOK_CAMPANHAS" : "SELLFLUX_WEBHOOK_LEADS";
  const webhookUrl = Deno.env.get(webhookKey);
  if (!webhookUrl) return { error: `Webhook ${webhookKey} não configurado` };
  const resp = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
  return { success: resp.ok, status: resp.status };
}

async function executeCallLojaIntegrada(args: any) {
  const apiKey = Deno.env.get("LOJA_INTEGRADA_API_KEY");
  const appKey = Deno.env.get("LOJA_INTEGRADA_APP_KEY");
  if (!apiKey || !appKey) return { error: "API keys Loja Integrada não configuradas" };
  const baseUrl = "https://api.awsli.com.br/v1";
  const endpoint = args.endpoint || "pedido";
  const params = new URLSearchParams({ chave_api: apiKey, chave_aplicacao: appKey, ...args.params });
  try {
    const resp = await fetch(`${baseUrl}/${endpoint}/?${params}`, { headers: { "Content-Type": "application/json" } });
    const data = await resp.json();
    return { endpoint, data };
  } catch (e) {
    return { error: e.message };
  }
}

async function executeUnifyLeads(args: any) {
  const filters: any[] = [];
  if (args.email) filters.push(`email.ilike.%${args.email}%`);
  if (args.phone) filters.push(`telefone.ilike.%${args.phone}%`);
  if (filters.length === 0) return { error: "Forneça email ou telefone para buscar duplicatas" };

  const { data } = await supabase.from("lia_attendances")
    .select("id,nome,email,telefone,created_at,etapa_crm")
    .or(filters.join(","))
    .limit(20);

  if (!data || data.length <= 1) return { message: "Nenhuma duplicata encontrada", leads: data };
  if (args.dry_run !== false) return { duplicates_found: data.length, leads: data, message: "Use dry_run: false para mesclar" };
  return { duplicates_found: data.length, leads: data, message: "Mesclagem automática desabilitada por segurança. Revise manualmente." };
}

async function executeIngestKnowledge(args: any) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ingest-knowledge-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ title: args.title, content: args.content, category: args.category })
    });
    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return { success: resp.ok };
    return await resp.json();
  } catch (e) { return { error: e.message }; }
}

async function executeCreateArticle(args: any) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-orchestrate-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ title: args.title, topic: args.topic, keywords: args.keywords || [] })
    });
    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return { success: resp.ok };
    return await resp.json();
  } catch (e) { return { error: e.message }; }
}

async function executeImportCsv(args: any) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/import-leads-csv`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ csv_data: args.csv_data, mapping: args.mapping })
    });
    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return { success: resp.ok };
    return await resp.json();
  } catch (e) { return { error: e.message }; }
}

async function executeCalculate(args: any) {
  const p = args.params || {};
  switch (args.calculation) {
    case "roi":
      return { roi: p.revenue && p.cost ? ((p.revenue - p.cost) / p.cost * 100).toFixed(1) + "%" : "Forneça revenue e cost" };
    case "ltv":
      return { ltv: p.avg_revenue && p.months ? (p.avg_revenue * p.months).toFixed(2) : "Forneça avg_revenue e months" };
    case "churn":
      return { churn: p.lost && p.total ? ((p.lost / p.total) * 100).toFixed(1) + "%" : "Forneça lost e total" };
    case "conversion_rate":
      return { rate: p.converted && p.total ? ((p.converted / p.total) * 100).toFixed(1) + "%" : "Forneça converted e total" };
    default:
      return { error: "Cálculos disponíveis: roi, ltv, churn, conversion_rate" };
  }
}

const toolExecutors: Record<string, (args: any) => Promise<any>> = {
  query_leads: executeQueryLeads,
  update_lead: executeUpdateLead,
  add_tags: executeAddTags,
  create_audience: executeCreateAudience,
  send_whatsapp: executeSendWhatsapp,
  notify_seller: executeNotifySeller,
  search_videos: executeSearchVideos,
  search_content: executeSearchContent,
  query_table: executeQueryTable,
  describe_table: executeDescribeTable,
  query_stats: executeQueryStats,
  check_missing_fields: executeCheckMissingFields,
  send_to_sellflux: executeSendToSellflux,
  call_loja_integrada: executeCallLojaIntegrada,
  unify_leads: executeUnifyLeads,
  ingest_knowledge: executeIngestKnowledge,
  create_article: executeCreateArticle,
  import_csv: executeImportCsv,
  calculate: executeCalculate,
};

const SYSTEM_PROMPT = `Você é o Copilot IA do Smart Ops — o cérebro operacional da empresa. Responda em português brasileiro.

Você tem acesso a 19 ferramentas para operar o sistema. Use-as para executar qualquer pedido do usuário.

COMPORTAMENTO:
- Sempre que o usuário pedir para fazer algo com leads, use as ferramentas disponíveis
- Para buscar leads, use query_leads com filtros apropriados
- Para enviar mensagens, use send_whatsapp
- Para notificar vendedores, use notify_seller
- Para consultar dados, use query_table ou query_stats
- Quando o resultado for uma lista, formate como tabela markdown
- Seja conciso e objetivo nas respostas
- Confirme ações de escrita antes de executar (update, send, etc.)
- Quando encontrar um lead, mostre nome, email, telefone e etapa CRM

TABELAS PRINCIPAIS:
- lia_attendances: Hub central de leads (~200 colunas)
- knowledge_contents: Artigos da base de conhecimento
- knowledge_videos: Vídeos educacionais
- team_members: Equipe de vendas
- system_a_catalog: Catálogo de produtos
- cs_automation_rules: Regras de automação

CAMPOS IMPORTANTES de lia_attendances:
- id, nome, email, telefone, cidade, etapa_crm, tags_crm
- intelligence_score_total, urgency_level, interest_timeline
- tem_impressora, tem_scanner, software_cad, especialidade
- proprietario_lead_crm, total_messages, total_sessions
- created_at, ultima_sessao_at`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, csv_data } = await req.json();
    
    const allMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages
    ];

    // If CSV data is provided, append it to the last user message
    if (csv_data) {
      const lastMsg = allMessages[allMessages.length - 1];
      if (lastMsg.role === "user") {
        lastMsg.content += `\n\n[CSV anexado pelo usuário]:\n${csv_data.slice(0, 5000)}`;
      }
    }

    // DeepSeek with tool calling (non-streaming for tool calls, then stream final answer)
    let currentMessages = [...allMessages];
    let maxIterations = 5;

    while (maxIterations-- > 0) {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: currentMessages,
          tools,
          tool_choice: "auto",
          stream: false
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("DeepSeek error:", response.status, errText);
        return new Response(JSON.stringify({ error: "Erro ao chamar DeepSeek" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const result = await response.json();
      const choice = result.choices?.[0];

      if (!choice) {
        return new Response(JSON.stringify({ error: "Sem resposta do modelo" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // If no tool calls, stream the final answer
      if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
        // Stream the final response
        const streamResp = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: currentMessages,
            stream: true
          })
        });

        if (!streamResp.ok || !streamResp.body) {
          const content = choice.message.content || "Operação concluída.";
          return new Response(JSON.stringify({ content }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(streamResp.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" }
        });
      }

      // Execute tool calls
      currentMessages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const fn = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments || "{}");
        console.log(`Executing tool: ${fn}`, JSON.stringify(args).slice(0, 200));

        const executor = toolExecutors[fn];
        let toolResult: any;
        if (executor) {
          try {
            toolResult = await executor(args);
          } catch (e) {
            toolResult = { error: `Erro na execução: ${e.message}` };
          }
        } else {
          toolResult = { error: `Ferramenta "${fn}" não implementada` };
        }

        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult).slice(0, 8000)
        });
      }
    }

    // Fallback if max iterations reached
    return new Response(JSON.stringify({ content: "Operação concluída após múltiplas etapas." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("Copilot error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
