import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logAIUsage, extractUsage } from "../_shared/log-ai-usage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- MODEL CONFIG ---
type ModelId = "deepseek" | "gemini";

function getModelConfig(modelId: ModelId) {
  if (modelId === "gemini") {
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      model: "google/gemini-3-flash-preview",
      apiKey: LOVABLE_API_KEY!,
      label: "gemini",
    };
  }
  return {
    url: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
    apiKey: DEEPSEEK_API_KEY,
    label: "deepseek",
  };
}

// --- TOOLS (same as before) ---
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
      description: "Envia mensagem WhatsApp para um lead via WaLeads usando o celular de um vendedor específico. Pode resolver vendedor e lead por nome automaticamente.",
      parameters: {
        type: "object",
        properties: {
          seller_name: { type: "string", description: "Nome do vendedor (busca em team_members para encontrar o team_member_id e waleads_api_key)" },
          lead_name: { type: "string", description: "Nome do lead (alternativa ao phone — busca em lia_attendances)" },
          lead_id: { type: "string", description: "UUID do lead" },
          phone: { type: "string", description: "Telefone do lead com DDD (se não informar, busca pelo lead_name ou lead_id)" },
          message: { type: "string", description: "Mensagem a enviar" },
          tipo: { type: "string", description: "Tipo de mensagem: text, image, audio, video, document (padrão: text)" },
          media_url: { type: "string", description: "URL da mídia (para tipos image/audio/video/document)" },
          caption: { type: "string", description: "Legenda da mídia" }
        },
        required: ["message"]
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
  },
  {
    type: "function",
    function: {
      name: "query_leads_advanced",
      description: "Busca avançada de leads com filtros complexos: JSONB (propostas, cognitive_analysis), datas (created_at, updated_at, entrada_sistema), ranges numéricos (score, valor), array contains (tags_crm contém tag X), texto em campos JSONB (itens_proposta_parsed contém 'charo side'). Retorna até 200 leads.",
      parameters: {
        type: "object",
        properties: {
          select: { type: "string", description: "Colunas a retornar" },
          where_ilike: { type: "object", description: "Filtros ILIKE: {campo: 'valor'}" },
          where_eq: { type: "object", description: "Filtros exatos: {campo: valor}" },
          where_gte: { type: "object", description: "Maior ou igual: {campo: valor}" },
          where_lte: { type: "object", description: "Menor ou igual: {campo: valor}" },
          where_in: { type: "object", description: "In array: {campo: ['val1','val2']}" },
          where_contains: { type: "object", description: "Array contém: {tags_crm: 'TAG_X'} — verifica se o array contém o valor" },
          where_text_search: { type: "object", description: "Busca textual em campos JSONB/text: {campo: 'texto'} — usa casting ::text ILIKE" },
          where_not: { type: "object", description: "Diferente de: {campo: valor}" },
          where_is_null: { type: "array", items: { type: "string" }, description: "Campos que devem ser NULL" },
          where_not_null: { type: "array", items: { type: "string" }, description: "Campos que NÃO devem ser NULL" },
          order_by: { type: "string", description: "Coluna para ordenar" },
          ascending: { type: "boolean", description: "Ordem ascendente" },
          limit: { type: "number", description: "Máximo de resultados (padrão 50, máx 200)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bulk_campaign",
      description: "Executa campanha em lote: filtra leads por critérios avançados, adiciona tag(s) a todos, e envia cada um para SellFlux via webhook de campanhas. Loga tudo em message_logs. Use para reativação, nurturing, ou qualquer ação em massa. Aceita os mesmos filtros de query_leads_advanced.",
      parameters: {
        type: "object",
        properties: {
          campaign_name: { type: "string", description: "Nome da campanha para log" },
          tags_to_add: { type: "array", items: { type: "string" }, description: "Tags a adicionar em todos os leads" },
          sellflux_template: { type: "string", description: "Template ID do SellFlux (opcional)" },
          send_to_sellflux: { type: "boolean", description: "Se true, envia cada lead para SellFlux (padrão true)" },
          where_ilike: { type: "object", description: "Filtros ILIKE" },
          where_eq: { type: "object", description: "Filtros exatos" },
          where_gte: { type: "object", description: "Maior ou igual" },
          where_lte: { type: "object", description: "Menor ou igual" },
          where_in: { type: "object", description: "In array" },
          where_contains: { type: "object", description: "Array contém" },
          where_text_search: { type: "object", description: "Busca textual em JSONB/text" },
          where_not: { type: "object", description: "Diferente de" },
          where_not_null: { type: "array", items: { type: "string" }, description: "Campos que NÃO devem ser NULL" },
          limit: { type: "number", description: "Máximo de leads a processar (padrão 100, máx 500)" }
        },
        required: ["campaign_name"]
      }
     }
  },
  {
    type: "function",
    function: {
      name: "move_crm_stage",
      description: "Move um lead para outra etapa do funil CRM (PipeRun + local). Atualiza o deal no PipeRun via smart-ops-kanban-move e o campo etapa_crm no lia_attendances.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "UUID do lead" },
          lead_name: { type: "string", description: "Nome do lead (alternativa ao lead_id)" },
          new_stage: { type: "string", description: "Nova etapa: novo_lead, em_atendimento, agendamento, negociacao, proposta, ganho, perdido, estagnado, etc." }
        },
        required: ["new_stage"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_ecommerce_orders",
      description: "Consulta pedidos e-commerce na tabela lia_attendances filtrando por status do último pedido, data, e outras condições. Ideal para carrinhos abandonados, pedidos pendentes, clientes recorrentes.",
      parameters: {
        type: "object",
        properties: {
          order_status: { type: "string", description: "Status do último pedido: checkout_iniciado, aguardando_pagamento, pedido_pago, pedido_entregue, pedido_cancelado" },
          since: { type: "string", description: "Data ISO mínima do último pedido (ex: 2026-03-11)" },
          until: { type: "string", description: "Data ISO máxima do último pedido" },
          min_value: { type: "number", description: "Valor mínimo do último pedido" },
          limit: { type: "number", description: "Máximo de resultados (padrão 50)" }
        },
        required: []
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
    // 1. Resolve seller (team_member_id) by name
    let teamMemberId: string | undefined;
    if (args.seller_name) {
      const { data: sellers } = await supabase.from("team_members")
        .select("id,nome_completo,whatsapp_number,waleads_api_key")
        .ilike("nome_completo", `%${args.seller_name}%`)
        .eq("ativo", true)
        .limit(3);
      if (!sellers || sellers.length === 0) {
        // Try nome field too
        const { data: sellers2 } = await supabase.from("team_members")
          .select("id,nome_completo,whatsapp_number,waleads_api_key")
          .ilike("nome_completo", `%${args.seller_name}%`)
          .limit(3);
        if (!sellers2 || sellers2.length === 0) return { error: `Vendedor "${args.seller_name}" não encontrado em team_members` };
        teamMemberId = sellers2[0].id;
        console.log(`[Copilot] Resolved seller: ${args.seller_name} → ${sellers2[0].nome_completo} (${sellers2[0].id})`);
      } else {
        teamMemberId = sellers[0].id;
        console.log(`[Copilot] Resolved seller: ${args.seller_name} → ${sellers[0].nome_completo} (${sellers[0].id})`);
      }
    }

    // 2. Resolve lead phone by name or lead_id
    let phone = args.phone;
    let leadId = args.lead_id;

    if (!phone && (args.lead_name || args.lead_id)) {
      let leadQuery = supabase.from("lia_attendances").select("id,nome,telefone_normalized,telefone").limit(1);
      if (args.lead_id) {
        leadQuery = leadQuery.eq("id", args.lead_id);
      } else if (args.lead_name) {
        leadQuery = leadQuery.ilike("nome", `%${args.lead_name}%`);
      }
      const { data: leads } = await leadQuery;
      if (!leads || leads.length === 0) return { error: `Lead "${args.lead_name || args.lead_id}" não encontrado` };
      phone = leads[0].telefone_normalized || leads[0].telefone;
      leadId = leads[0].id;
      if (!phone) return { error: `Lead "${leads[0].nome}" encontrado mas não tem telefone cadastrado` };
      console.log(`[Copilot] Resolved lead: ${args.lead_name || args.lead_id} → ${leads[0].nome} (${phone})`);
    }

    if (!phone) return { error: "Telefone não informado e não foi possível resolver pelo lead_name/lead_id" };

    // 3. If no seller specified, try to find first active team member with waleads_api_key
    if (!teamMemberId) {
      const { data: defaultSeller } = await supabase.from("team_members")
        .select("id,nome_completo")
        .not("waleads_api_key", "is", null)
        .eq("ativo", true)
        .limit(1);
      if (defaultSeller && defaultSeller.length > 0) {
        teamMemberId = defaultSeller[0].id;
        console.log(`[Copilot] No seller specified, using default: ${defaultSeller[0].nome_completo}`);
      } else {
        return { error: "Nenhum vendedor com WaLeads configurado encontrado. Informe seller_name." };
      }
    }

    // 4. Call send-waleads with team_member_id
    const payload: any = {
      team_member_id: teamMemberId,
      phone,
      message: args.message,
      lead_id: leadId,
      tipo: args.tipo || "text",
    };
    if (args.media_url) payload.media_url = args.media_url;
    if (args.caption) payload.caption = args.caption;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-send-waleads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify(payload)
    });
    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const text = await response.text();
      return { error: `Resposta não-JSON: ${text.slice(0, 200)}` };
    }
    return await response.json();
  } catch (e) {
    return { error: e.message };
  }
}

async function executeNotifySeller(args: any) {
  const { data: sellers } = await supabase.from("team_members").select("id,nome,telefone,email").ilike("nome", `%${args.seller_name}%`).limit(3);
  if (!sellers || sellers.length === 0) return { error: `Vendedor "${args.seller_name}" não encontrado` };
  const seller = sellers[0];
  if (seller.telefone) {
    const msg = args.message + (args.lead_id ? ` (Lead ID: ${args.lead_id})` : "");
    await executeSendWhatsapp({ phone: seller.telefone, message: msg });
  }
  return { success: true, seller: { nome: seller.nome, email: seller.email }, notification_sent: !!seller.telefone };
}

async function executeSearchVideos(args: any) {
  const limit = Math.min(args.limit || 10, 30);
  const { data, error } = await supabase.from("knowledge_videos")
    .select("id,title,description,thumbnail_url,url,embed_url,video_type,panda_tags,pandavideo_id")
    .or(`title.ilike.%${args.query}%,description.ilike.%${args.query}%`)
    .limit(limit);
  if (error) return { error: error.message };
  // Gravar lookup no cache compartilhado (fire-and-forget)
  if (data && data.length > 0) {
    const queryNorm = (args.query || "").toLowerCase().replace(/[áàâãéèêíìîóòôõúùûç]/g, c => "aaaaeeeiiiooooouuuc"["áàâãéèêíìîóòôõúùûç".indexOf(c)] || c);
    const resultsForCache = data.map((v: any) => ({
      source_type: "video", similarity: 0.80,
      chunk_text: `${v.title}${v.description ? ` — ${v.description.slice(0, 200)}` : ""}`,
      metadata: { title: v.title, thumbnail_url: v.thumbnail_url, url: v.url, embed_url: v.embed_url },
    }));
    supabase.from("agent_internal_lookups").insert({
      query_normalized: queryNorm, query_original: args.query, source_function: "copilot",
      results_json: resultsForCache, results_count: resultsForCache.length,
      result_types: ["video"],
    }).then(() => {});
  }
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
  // Gravar lookup no cache compartilhado (fire-and-forget)
  if (data && data.length > 0) {
    const queryNorm = (args.query || "").toLowerCase().replace(/[áàâãéèêíìîóòôõúùûç]/g, c => "aaaaeeeiiiooooouuuc"["áàâãéèêíìîóòôõúùûç".indexOf(c)] || c);
    const resultsForCache = data.map((a: any) => ({
      source_type: "article", similarity: 0.75,
      chunk_text: `${a.title} — ${a.excerpt?.slice(0, 200) || ""}`,
      metadata: { title: a.title, slug: a.slug },
    }));
    supabase.from("agent_internal_lookups").insert({
      query_normalized: queryNorm, query_original: args.query, source_function: "copilot",
      results_json: resultsForCache, results_count: resultsForCache.length,
      result_types: ["article"],
    }).then(() => {});
  }
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
  const schemas: Record<string, string[]> = {
    lia_attendances: ["id","nome","email","telefone","cidade","etapa_crm","tags_crm","intelligence_score_total","urgency_level","interest_timeline","tem_impressora","tem_scanner","especialidade","created_at","proprietario_lead_crm","total_messages","total_sessions","proposals_total_value","lojaintegrada_ultimo_pedido_valor"],
    knowledge_contents: ["id","title","excerpt","slug","content_html","category_id","keywords","active","author_id","created_at"],
    knowledge_videos: ["id","title","description","url","embed_url","thumbnail_url","video_type","panda_tags","content_id","pandavideo_id","analytics_views","analytics_plays"],
    team_members: ["id","nome","email","telefone","papel","ativo"],
    system_a_catalog: ["id","product_name","slug","brand","category","subcategory","active"],
    ai_token_usage: ["id","function_name","action_label","provider","model","prompt_tokens","completion_tokens","total_tokens","estimated_cost_usd","created_at"],
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

// --- Helper: apply advanced filters to a supabase query ---
function applyAdvancedFilters(query: any, args: any): any {
  if (args.where_eq) {
    for (const [k, v] of Object.entries(args.where_eq)) query = query.eq(k, v);
  }
  if (args.where_ilike) {
    for (const [k, v] of Object.entries(args.where_ilike)) query = query.ilike(k, `%${v}%`);
  }
  if (args.where_gte) {
    for (const [k, v] of Object.entries(args.where_gte)) query = query.gte(k, v);
  }
  if (args.where_lte) {
    for (const [k, v] of Object.entries(args.where_lte)) query = query.lte(k, v);
  }
  if (args.where_in) {
    for (const [k, v] of Object.entries(args.where_in)) {
      if (Array.isArray(v)) query = query.in(k, v);
    }
  }
  if (args.where_contains) {
    for (const [k, v] of Object.entries(args.where_contains)) {
      query = query.contains(k, [v]);
    }
  }
  if (args.where_not) {
    for (const [k, v] of Object.entries(args.where_not)) query = query.neq(k, v);
  }
  if (args.where_is_null) {
    for (const f of args.where_is_null) query = query.is(f, null);
  }
  if (args.where_not_null) {
    for (const f of args.where_not_null) query = query.not(f, "is", null);
  }
  // Text search in JSONB/text fields — for JSONB we use textRepresentation.cd operator
  // For regular text fields, just use ilike
  if (args.where_text_search) {
    for (const [k, v] of Object.entries(args.where_text_search)) {
      // Use ilike which works on text columns; for JSONB columns like itens_proposta_parsed,
      // itens_proposta_crm is actually text so ilike works directly
      query = query.ilike(k, `%${v}%`);
    }
  }
  if (args.order_by) query = query.order(args.order_by, { ascending: args.ascending ?? false });
  return query;
}

async function executeQueryLeadsAdvanced(args: any) {
  const select = args.select || "id,nome,email,telefone_normalized,lead_status,tags_crm,intelligence_score_total,itens_proposta_crm,proposals_total_value,entrada_sistema,updated_at,cognitive_analysis,produto_interesse,impressora_modelo";
  const limit = Math.min(args.limit || 50, 200);
  let query = supabase.from("lia_attendances").select(select).limit(limit);
  query = applyAdvancedFilters(query, args);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length || 0, leads: data };
}

async function executeBulkCampaign(args: any) {
  const limit = Math.min(args.limit || 100, 500);
  const selectCols = "id,nome,email,telefone_normalized,lead_status,tags_crm,produto_interesse,impressora_modelo,cidade,uf,area_atuacao,especialidade,resina_interesse,score,piperun_id,proprietario_lead_crm,intelligence_score_total,ultima_etapa_comercial,software_cad,volume_mensal_pecas,principal_aplicacao,tem_scanner";
  
  // 1. Query leads with advanced filters
  let query = supabase.from("lia_attendances").select(selectCols).limit(limit);
  query = applyAdvancedFilters(query, args);
  const { data: leads, error: fetchErr } = await query;
  if (fetchErr) return { error: fetchErr.message };
  if (!leads || leads.length === 0) return { campaign: args.campaign_name, found: 0, message: "Nenhum lead encontrou os critérios." };

  const tagsToAdd = args.tags_to_add || [];
  const shouldSendSellFlux = args.send_to_sellflux !== false;
  const SELLFLUX_WEBHOOK = Deno.env.get("SELLFLUX_WEBHOOK_CAMPANHAS");
  
  let tagged = 0, sent = 0, errors = 0;
  const processedLeads: Array<{ id: string; nome: string; status: string }> = [];

  for (const lead of leads) {
    try {
      // 2. Add tags
      if (tagsToAdd.length > 0) {
        const existing = Array.isArray(lead.tags_crm) ? lead.tags_crm : [];
        const merged = [...new Set([...existing, ...tagsToAdd])];
        await supabase.from("lia_attendances").update({ tags_crm: merged, updated_at: new Date().toISOString() }).eq("id", lead.id);
        tagged++;
      }

      // 3. Send to SellFlux
      if (shouldSendSellFlux && SELLFLUX_WEBHOOK && lead.telefone_normalized) {
        const { sendCampaignViaSellFlux } = await import("../_shared/sellflux-field-map.ts");
        const result = await sendCampaignViaSellFlux(
          SELLFLUX_WEBHOOK,
          lead as Record<string, unknown>,
          args.sellflux_template
        );

        // 4. Log to message_logs
        await supabase.from("message_logs").insert({
          lead_id: lead.id,
          tipo: `campanha_${args.campaign_name}`,
          mensagem_preview: `[Copilot Campaign] ${args.campaign_name}: ${lead.nome}${args.sellflux_template ? ` (template: ${args.sellflux_template})` : ""}`.slice(0, 200),
          status: result.success ? "enviado" : "erro",
          error_details: result.success ? null : result.response,
        });

        if (result.success) sent++;
        else errors++;
      }
      
      processedLeads.push({ id: lead.id, nome: lead.nome, status: "ok" });
    } catch (e) {
      errors++;
      processedLeads.push({ id: lead.id, nome: lead.nome, status: `erro: ${e.message}` });
    }
  }

  // 5. Log campaign summary to system_health_logs
  try {
    await supabase.from("system_health_logs").insert({
      function_name: "smart-ops-copilot",
      severity: "info",
      error_type: "bulk_campaign",
      details: {
        campaign_name: args.campaign_name,
        total_leads: leads.length,
        tagged,
        sent_sellflux: sent,
        errors,
        tags_added: tagsToAdd,
        template: args.sellflux_template || null,
      },
    });
  } catch {}

  return {
    campaign: args.campaign_name,
    total_leads_found: leads.length,
    tagged,
    sent_to_sellflux: sent,
    errors,
    sample: processedLeads.slice(0, 10),
  };
}

async function executeMoveCrmStage(args: any) {
  try {
    // Resolve lead by name if needed
    let leadId = args.lead_id;
    if (!leadId && args.lead_name) {
      const { data: leads } = await supabase.from("lia_attendances")
        .select("id,nome,piperun_id,etapa_crm")
        .ilike("nome", `%${args.lead_name}%`)
        .limit(1);
      if (!leads || leads.length === 0) return { error: `Lead "${args.lead_name}" não encontrado` };
      leadId = leads[0].id;
    }
    if (!leadId) return { error: "Informe lead_id ou lead_name" };

    // Get lead's piperun_id
    const { data: lead } = await supabase.from("lia_attendances")
      .select("id,nome,piperun_id,etapa_crm")
      .eq("id", leadId)
      .single();
    if (!lead) return { error: "Lead não encontrado" };

    // Update local etapa_crm
    await supabase.from("lia_attendances")
      .update({ etapa_crm: args.new_stage, updated_at: new Date().toISOString() })
      .eq("id", leadId);

    // If has piperun_id, also update PipeRun
    let piperunResult: any = null;
    if (lead.piperun_id) {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/smart-ops-kanban-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ piperun_id: lead.piperun_id, new_status: args.new_stage })
      });
      const ct = resp.headers.get("content-type") || "";
      piperunResult = ct.includes("application/json") ? await resp.json() : { raw: await resp.text() };
    }

    return {
      success: true,
      lead: { id: lead.id, nome: lead.nome },
      old_stage: lead.etapa_crm,
      new_stage: args.new_stage,
      piperun_synced: !!lead.piperun_id,
      piperun_result: piperunResult,
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function executeQueryEcommerceOrders(args: any) {
  try {
    const limit = Math.min(args.limit || 50, 200);
    let query = supabase.from("lia_attendances")
      .select("id,nome,email,telefone_normalized,cidade,lojaintegrada_ultimo_pedido_status,lojaintegrada_ultimo_pedido_valor,lojaintegrada_ultimo_pedido_data,lojaintegrada_ultimo_pedido_numero,lojaintegrada_ltv,lojaintegrada_total_pedidos_pagos,tags_crm,proprietario_lead_crm")
      .not("lojaintegrada_ultimo_pedido_status", "is", null)
      .limit(limit);

    if (args.order_status) {
      query = query.ilike("lojaintegrada_ultimo_pedido_status", `%${args.order_status}%`);
    }
    if (args.since) {
      query = query.gte("lojaintegrada_ultimo_pedido_data", args.since);
    }
    if (args.until) {
      query = query.lte("lojaintegrada_ultimo_pedido_data", args.until);
    }
    if (args.min_value) {
      query = query.gte("lojaintegrada_ultimo_pedido_valor", args.min_value);
    }

    query = query.order("lojaintegrada_ultimo_pedido_data", { ascending: false });
    const { data, error } = await query;
    if (error) return { error: error.message };
    return { count: data?.length || 0, orders: data };
  } catch (e) {
    return { error: e.message };
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
  query_leads_advanced: executeQueryLeadsAdvanced,
  bulk_campaign: executeBulkCampaign,
  move_crm_stage: executeMoveCrmStage,
  query_ecommerce_orders: executeQueryEcommerceOrders,
};

const SYSTEM_PROMPT = `Você é o Copilot IA do Smart Ops — o cérebro operacional da empresa. Responda em português brasileiro.

═══════════════════════════════════════════════════════════
📌 QUEM VOCÊ É
═══════════════════════════════════════════════════════════

Você combina duas competências em uma única mente:

1️⃣ **ESPECIALISTA SÊNIOR EM MARKETING ODONTOLÓGICO DIGITAL**
   - Conhece profundamente o mercado brasileiro de odontologia digital: impressão 3D, scanners intraorais, CAD/CAM, resinas, fluxos digitais completos
   - Domina estratégias de reativação, nutrição de leads, segmentação comportamental, campanhas de WhatsApp e automações de CRM
   - Entende o ciclo de venda consultiva de equipamentos de alto ticket (impressoras 3D, scanners, kits de caracterização)
   - Conhece as dores reais dos dentistas: investimento alto, curva de aprendizado, medo de tecnologia, ROI incerto
   - Sabe criar messaging que ressoa com cada perfil: o entusiasta digital, o conservador curioso, o lab owner, o ortodontista, o protesista
   - Domina conceitos de SPIN Selling aplicados a odontologia digital
   - Entende sazonalidade do mercado: congressos (CIOSP, ABCD), festivais, datas comerciais

2️⃣ **ENGENHEIRO ANALÍTICO DE DADOS**
   - Pensa em dados antes de agir: quantifica, segmenta, mede
   - Cruza dados de múltiplas fontes: CRM (PipeRun), e-commerce (Loja Integrada), academia (Astron), chatbot (LIA), propostas comerciais
   - Identifica padrões em cohorts: taxa de conversão por origem, tempo médio de fechamento por produto, LTV por especialidade
   - Calcula métricas de campanha: taxa de abertura estimada, conversão esperada, ROI projetado
   - Quando o usuário pede uma campanha, primeiro analisa os dados, dimensiona o público e então executa
   - Sempre que apresenta resultados, inclui insights analíticos: "desses 47 leads, 12 têm score > 70 e 8 já tiveram proposta aprovada"

═══════════════════════════════════════════════════════════
📌 SUA RELAÇÃO COM A DRA. LIA
═══════════════════════════════════════════════════════════

A Dra. LIA é a IA de atendimento ao cliente (chatbot). Ela conversa com leads, qualifica, identifica necessidades e gera análises cognitivas.
Você APRENDE com o que a LIA faz:
- cognitive_analysis: perfil psicológico, motivação, objeções, urgência de cada lead
- historico_resumos: resumos de todas as conversas do lead com a LIA
- intelligence_score_total: score 0-100 calculado por 4 eixos
- Você usa esses dados para criar campanhas mais inteligentes e personalizadas

Você é o estrategista; a LIA é a linha de frente. Vocês são uma equipe.

═══════════════════════════════════════════════════════════
📌 CURADORIA DE CONTEÚDO
═══════════════════════════════════════════════════════════

Você é o CURADOR e DETENTOR de todo o acervo de conteúdo da SmartDent:
- Conhece em detalhe cada vídeo, artigo, documento técnico e publicação do sistema
- Sabe quais materiais estão disponíveis sobre cada tema (resinas, impressoras, scanners, workflows)
- É responsável por organizar e alimentar a base de conhecimento para que a LIA tenha sempre as melhores referências
- Quando buscar vídeos ou conteúdos (search_videos, search_content), os resultados são automaticamente ARMAZENADOS no cache compartilhado (agent_internal_lookups) para que a LIA também se beneficie
- Use query_table para explorar catalog_documents, resins e system_a_catalog quando precisar de informações detalhadas

═══════════════════════════════════════════════════════════
📌 REGRAS DE EXECUÇÃO
═══════════════════════════════════════════════════════════

Você tem acesso a 21 ferramentas para operar o sistema. Use-as para executar qualquer pedido do usuário.

REGRA ABSOLUTA — NUNCA PERGUNTE, SEMPRE EXECUTE:
- Você é Inteligência Artificial, não um trigger de menus. NUNCA apresente opções, NUNCA pergunte "deseja que eu faça X ou Y?", NUNCA peça confirmação.
- Quando o usuário pedir algo, EXECUTE IMEDIATAMENTE usando as ferramentas. Use seu julgamento para escolher a melhor abordagem.
- Se houver ambiguidade, escolha a interpretação mais útil e execute. Depois explique o que fez.
- Para ações destrutivas (deletar, enviar mensagem em massa), execute mesmo assim — o usuário é o administrador e sabe o que está pedindo.
- Nunca diga "posso fazer isso de duas formas" ou "qual opção prefere". Escolha a melhor e faça.

COMPORTAMENTO:
- Sempre que o usuário pedir para fazer algo com leads, use as ferramentas disponíveis
- Para buscar leads, use query_leads (simples) ou query_leads_advanced (filtros complexos, JSONB, datas, ranges)
- Para campanhas em massa (reativação, WhatsApp, SellFlux), use bulk_campaign — filtra, tageia e envia em um passo
- Para enviar mensagens individuais, use send_whatsapp
- Para notificar vendedores, use notify_seller
- Para consultar dados, use query_table ou query_stats
- Quando o resultado for uma lista, formate como tabela markdown
- Seja conciso e objetivo nas respostas — mas quando fizer análise de dados, seja detalhista nos insights
- IMPORTANTE: Sempre que tiver os dados de uma ferramenta, responda com o resultado formatado
- Ao criar campanhas, adicione sempre um RESUMO ANALÍTICO: quantos leads, distribuição por score, por cidade, por produto — os números que importam

CAMPANHAS EM MASSA (bulk_campaign):
- Use quando o usuário pedir algo como "envie campanha de reativação para leads que..."
- Aceita os mesmos filtros avançados de query_leads_advanced
- Adiciona tags automaticamente e envia para SellFlux
- Exemplos de uso:
  - "Crie campanha para quem recebeu proposta de kit charo side e não fechou" → use where_text_search em itens_proposta_crm/itens_proposta_parsed
  - "Reative leads estagnados há 5 meses" → use where_lte em updated_at com data calculada
  - "Envie para quem tem tag A_ESTAGNADO_15D" → use where_contains em tags_crm

FILTROS AVANÇADOS (query_leads_advanced):
- where_text_search: busca texto dentro de campos JSONB como itens_proposta_parsed, cognitive_analysis, proposals_data
- where_contains: verifica se array (tags_crm) contém uma tag específica
- where_gte/where_lte: ranges de data (entrada_sistema, updated_at) e numéricos (intelligence_score_total, proposals_total_value)
- where_not: exclusão (lead_status diferente de 'fechamento')

INTELIGÊNCIA DA LIA (disponível nos leads):
- cognitive_analysis: análise comportamental profunda feita pela Dra. LIA (eixos: perfil psicológico, motivação, objeções, urgência, persona recomendada)
- historico_resumos: resumos de todas as sessões de chat do lead com a LIA
- intelligence_score_total: score de 0-100 calculado por 4 eixos (sales_heat, technical_maturity, behavioral_engagement, purchase_power)
- itens_proposta_parsed: JSONB com itens de propostas comerciais (scanner, impressora, insumos) 
- itens_proposta_crm: texto com itens da proposta no CRM

TABELAS PRINCIPAIS:
- lia_attendances: Hub central de leads (~200 colunas) — use query_leads_advanced para consultas complexas
- knowledge_contents: Artigos da base de conhecimento
- knowledge_videos: Vídeos educacionais
- team_members: Equipe de vendas
- system_a_catalog: Catálogo de produtos
- cs_automation_rules: Regras de automação
- ai_token_usage: Consumo de tokens IA
- message_logs: Histórico de mensagens enviadas (campanhas, automações)

CAMPOS IMPORTANTES de lia_attendances:
- id, nome, email, telefone_normalized, cidade, uf, lead_status, tags_crm
- intelligence_score_total, urgency_level, interest_timeline
- tem_impressora, tem_scanner, software_cad, especialidade, area_atuacao
- proprietario_lead_crm, total_messages, total_sessions
- itens_proposta_crm, itens_proposta_parsed, proposals_total_value, valor_oportunidade
- cognitive_analysis, historico_resumos, resumo_historico_ia
- entrada_sistema, created_at, updated_at, ultima_sessao_at
- produto_interesse, impressora_modelo, resina_interesse

TAGS CRM PADRONIZADAS:
- Jornada: J01_CONSCIENCIA → J06_APOIO
- Comercial: C_PRIMEIRO_CONTATO, C_PROPOSTA_ENVIADA, C_NEGOCIACAO_ATIVA, C_CONTRATO_FECHADO
- E-commerce: EC_PAGAMENTO_APROVADO, EC_PROD_RESINA, EC_PROD_KIT_CARAC, EC_CLIENTE_RECORRENTE
- Estagnação: A_ESTAGNADO_3D, A_ESTAGNADO_7D, A_ESTAGNADO_15D, A_SEM_RESPOSTA
- LIA: LIA_ATENDEU, LIA_LEAD_NOVO, LIA_LEAD_REATIVADO`;



// --- Helper: simulate SSE from a string ---
function createSSEFromText(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      // Send in chunks for smooth streaming effect
      const chunkSize = 20;
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        const payload = JSON.stringify({ choices: [{ delta: { content: chunk } }] });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, csv_data, model: requestedModel } = await req.json();
    
    // Determine which model to use
    const modelId: ModelId = requestedModel === "gemini" ? "gemini" : "deepseek";
    const config = getModelConfig(modelId);

    // Validate API key
    if (!config.apiKey) {
      const errorMsg = modelId === "gemini" 
        ? "LOVABLE_API_KEY não configurada. Gemini indisponível."
        : "DEEPSEEK_API_KEY não configurada.";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const allMessages: any[] = [
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

    let currentMessages = [...allMessages];
    const MAX_ITERATIONS = 10;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      console.log(`[Copilot] Iteration ${iteration + 1}/${MAX_ITERATIONS} using ${config.label}`);
      
      const response = await fetch(config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: currentMessages,
          tools,
          tool_choice: "auto",
          stream: false
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`${config.label} error:`, response.status, errText);
        
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit atingido. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes para Lovable AI. Adicione créditos no workspace." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        
        return new Response(JSON.stringify({ error: `Erro ao chamar ${config.label}: ${response.status}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const result = await response.json();
      const choice = result.choices?.[0];
      
      // Track tokens
      const usage = extractUsage(result);
      totalPromptTokens += usage.prompt_tokens;
      totalCompletionTokens += usage.completion_tokens;

      if (!choice) {
        return new Response(JSON.stringify({ error: "Sem resposta do modelo" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // If the model returned text content WITHOUT tool calls → stream it directly
      if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
        const content = choice.message.content || "Operação concluída.";
        
        // Log usage
        logAIUsage({
          functionName: "smart-ops-copilot",
          actionLabel: `copilot-chat-${config.label}`,
          model: config.model,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          metadata: { iterations: iteration + 1, modelId }
        });
        
        // Simulate SSE stream from the existing content (no duplicate API call!)
        const sseStream = createSSEFromText(content);
        return new Response(sseStream, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" }
        });
      }

      // Execute tool calls
      currentMessages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const fn = toolCall.function.name;
        let args: any;
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          args = {};
        }
        console.log(`[Copilot] Tool: ${fn}`, JSON.stringify(args).slice(0, 200));

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

    // --- SMART FALLBACK: If we hit max iterations, ask model to summarize ---
    console.log(`[Copilot] Max iterations reached, requesting summary from ${config.label}`);
    
    currentMessages.push({
      role: "user",
      content: "SISTEMA: Você atingiu o limite de iterações. Com base em todos os resultados das ferramentas acima, forneça uma resposta final resumida e útil ao usuário. Não chame mais ferramentas."
    });

    try {
      const summaryResp = await fetch(config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: currentMessages,
          stream: false
        })
      });

      if (summaryResp.ok) {
        const summaryResult = await summaryResp.json();
        const summaryContent = summaryResult.choices?.[0]?.message?.content || "Operação concluída. Os dados foram processados com sucesso.";
        
        const summaryUsage = extractUsage(summaryResult);
        totalPromptTokens += summaryUsage.prompt_tokens;
        totalCompletionTokens += summaryUsage.completion_tokens;
        
        logAIUsage({
          functionName: "smart-ops-copilot",
          actionLabel: `copilot-chat-${config.label}-summary`,
          model: config.model,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          metadata: { iterations: MAX_ITERATIONS, fallback: true, modelId }
        });
        
        const sseStream = createSSEFromText(summaryContent);
        return new Response(sseStream, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" }
        });
      }
    } catch (e) {
      console.error("[Copilot] Summary fallback failed:", e);
    }

    // Ultimate fallback
    return new Response(JSON.stringify({ content: "Processamento concluído, mas não foi possível gerar um resumo." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("Copilot error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
