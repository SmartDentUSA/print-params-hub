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
  },
  {
    type: "function",
    function: {
      name: "verify_consolidation",
      description: "Verifica a consolidação de dados de leads: chaves de identidade (pessoa_hash, empresa_hash), campos críticos, consistência entre propostas e valores, deals history. Retorna score de completude e campos faltantes. Se nenhum filtro for passado, verifica os últimos 10 leads atualizados.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "UUID de um lead específico" },
          email: { type: "string", description: "Email do lead" },
          limit: { type: "number", description: "Quantidade de leads a verificar (padrão 10, máx 50)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_deal_history",
      description: "Busca no histórico de deals (piperun_deals_history JSONB) usando lateral join eficiente. Permite filtrar por status (ganho/perdido/aberto), produto, vendedor e faixa de valor. Use esta ferramenta sempre que precisar consultar deals fechados, ganhos, perdidos ou buscar por produto em propostas.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Status do deal: ganho, won, perdido, lost, aberto, open (busca parcial)" },
          product: { type: "string", description: "Nome do produto (busca parcial no deal inteiro)" },
          owner: { type: "string", description: "Nome do vendedor/owner (busca parcial)" },
          min_value: { type: "number", description: "Valor mínimo do deal" },
          max_value: { type: "number", description: "Valor máximo do deal" },
          limit: { type: "number", description: "Máximo de resultados (padrão 50)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_enrollments",
      description: "Consulta agendamentos de treinamentos. Use para: quem está inscrito em qual turma, turmas desta semana, participantes por status, buscar por nome ou deal.",
      parameters: {
        type: "object",
        properties: {
          course_id: { type: "string", description: "UUID do curso" },
          turma_id: { type: "string", description: "UUID da turma" },
          status: { type: "string", enum: ["agendado","confirmado","presente","ausente","cancelado"], description: "Status da inscrição" },
          deal_id: { type: "string", description: "ID do deal PipeRun" },
          person_name: { type: "string", description: "Busca parcial ILIKE no nome do participante" },
          limit: { type: "number", description: "Máximo de resultados (padrão 20)" },
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_opportunity_rules",
      description: "Consulta regras de oportunidade e mapeamentos do workflow 7×3. Use para entender: quais produtos pertencem a cada etapa, quais equipamentos concorrentes geram oportunidade, tempos úteis de equipamentos, ações recomendadas (upgrade/migration/cross_sell). Essencial para análise de portfólio e predição de comportamento.",
      parameters: {
        type: "object",
        properties: {
          workflow_stage: { type: "string", description: "Filtrar por etapa: etapa_1_scanner, etapa_2_cad, etapa_3_impressao, etc." },
          source_item: { type: "string", description: "Buscar regra por item específico (ex: 'Medit i500', 'iTero 5D')" },
          action_type: { type: "string", description: "Filtrar por tipo: upgrade, migration, cross_sell, upsell, recompra, complemento, upsell_edu" },
          mapping_type: { type: "string", description: "Filtrar mapeamentos: sdr_field, product, competitor" },
          include_mappings: { type: "boolean", description: "Se true, retorna também os mapeamentos de células (padrão true)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_sales_summary",
      description: "Retorna total de vendas e ranking de vendedores de um mês via funções SQL consolidadas. USE SEMPRE para perguntas sobre faturamento, receita, total de vendas, ranking de vendedores. NUNCA use query_deal_history ou PipeRun API para calcular totais de receita.",
      parameters: {
        type: "object",
        properties: {
          ano: { type: "number", description: "Ano (padrão: ano atual)" },
          mes: { type: "number", description: "Mês 1-12 (padrão: mês atual)" },
          include_ranking: { type: "boolean", description: "Se true, inclui ranking por vendedor (padrão true)" }
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
    supabase.from("agent_internal_lookups").upsert({
      query_normalized: queryNorm, query_original: args.query, source_function: "copilot",
      results_json: resultsForCache, results_count: resultsForCache.length,
      result_types: ["video"], hit_count: 1, last_hit_at: new Date().toISOString(),
    }, { onConflict: "query_normalized" }).then(() => {});
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
    supabase.from("agent_internal_lookups").upsert({
      query_normalized: queryNorm, query_original: args.query, source_function: "copilot",
      results_json: resultsForCache, results_count: resultsForCache.length,
      result_types: ["article"], hit_count: 1, last_hit_at: new Date().toISOString(),
    }, { onConflict: "query_normalized" }).then(() => {});
  }
  return { count: data?.length || 0, articles: data };
}

async function executeQueryTable(args: any) {
  const allowedTables = [
    "lia_attendances", "knowledge_contents", "knowledge_videos", "knowledge_categories",
    "system_a_catalog", "catalog_documents", "brands", "models", "resins",
    "agent_interactions", "agent_knowledge_gaps", "cs_automation_rules",
    "team_members", "ai_token_usage", "external_links", "leads", "content_requests",
    "lead_state_events", "company_kb_texts", "intelligence_score_config",
    "system_health_logs", "message_logs"
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
  // Text search in JSONB/text fields
  // For known JSONB columns, cast to ::text via RPC or use textual filter workaround
  const JSONB_COLUMNS = new Set([
    "piperun_deals_history", "cognitive_analysis", "proposals_data",
    "portfolio_json", "itens_proposta_parsed", "historico_resumos",
    "sellflux_custom_fields", "extra_data"
  ]);
  if (args.where_text_search) {
    for (const [k, v] of Object.entries(args.where_text_search)) {
      if (JSONB_COLUMNS.has(k)) {
        // For JSONB columns, use ::text cast via .filter() with raw PostgREST syntax
        query = query.filter(k + "::text", "ilike", `%${v}%`);
      } else {
        query = query.ilike(k, `%${v}%`);
      }
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

async function executeVerifyConsolidation(args: any) {
  try {
    const criticalFields = [
      "pessoa_hash", "empresa_hash", "nome", "email", "telefone_normalized",
      "etapa_crm", "piperun_deals_history", "empresa_nome", "empresa_piperun_id",
      "proposals_data", "proposals_total_value", "piperun_id", "pessoa_piperun_id",
      "cidade", "produto_interesse", "proprietario_lead_crm"
    ];
    const selectCols = `id,nome,email,${criticalFields.join(",")}`;
    const limit = Math.min(args.limit || 10, 50);

    let query = supabase.from("lia_attendances").select(selectCols);

    if (args.lead_id) {
      query = query.eq("id", args.lead_id);
    } else if (args.email) {
      query = query.ilike("email", `%${args.email}%`);
    } else {
      query = query.not("piperun_id", "is", null).order("updated_at", { ascending: false });
    }
    query = query.limit(limit);

    const { data: leads, error } = await query;
    if (error) return { error: error.message };
    if (!leads || leads.length === 0) return { message: "Nenhum lead encontrado para verificação" };

    const totalCheckFields = 16;
    const results = leads.map((lead: any) => {
      const missing: string[] = [];

      if (!lead.pessoa_hash) missing.push("pessoa_hash");
      if (!lead.empresa_hash) missing.push("empresa_hash");
      if (!lead.telefone_normalized) missing.push("telefone");
      if (!lead.etapa_crm) missing.push("etapa_crm");
      if (!lead.cidade) missing.push("cidade");
      if (!lead.produto_interesse) missing.push("produto_interesse");
      if (!lead.proprietario_lead_crm) missing.push("proprietario_lead_crm");
      if (!lead.pessoa_piperun_id) missing.push("pessoa_piperun_id");
      if (!lead.piperun_id) missing.push("piperun_id");
      // Consistency
      if (lead.empresa_piperun_id && !lead.empresa_nome) missing.push("empresa_nome (has empresa_id)");
      if (lead.piperun_id && (!Array.isArray(lead.piperun_deals_history) || lead.piperun_deals_history.length === 0)) missing.push("deals_history_empty");
      if (lead.proposals_data && (!lead.proposals_total_value || lead.proposals_total_value <= 0)) missing.push("proposals_value_zero");

      const completeness = Math.round(((totalCheckFields - missing.length) / totalCheckFields) * 100);

      return {
        id: lead.id,
        nome: lead.nome,
        email: lead.email,
        completeness_pct: completeness,
        missing_count: missing.length,
        missing_fields: missing,
        status: completeness >= 80 ? "✅ OK" : completeness >= 50 ? "⚠️ Parcial" : "❌ Incompleto",
      };
    });

    const avgCompleteness = Math.round(results.reduce((s: number, r: any) => s + r.completeness_pct, 0) / results.length);
    const criticalCount = results.filter((r: any) => r.completeness_pct < 50).length;

    return {
      total_verified: results.length,
      avg_completeness_pct: avgCompleteness,
      critical_count: criticalCount,
      leads: results,
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function executeQueryDealHistory(args: any) {
  try {
    const { data, error } = await supabase.rpc("fn_search_deals_by_status", {
      p_status: args.status || null,
      p_product: args.product || null,
      p_owner: args.owner || null,
      p_min_value: args.min_value || null,
      p_max_value: args.max_value || null,
      p_limit: Math.min(args.limit || 50, 200),
    });
    if (error) return { error: error.message };
    return { count: data?.length || 0, deals: data };
  } catch (e) {
    return { error: e.message };
  }
}

async function executeQueryEnrollments(args: any) {
  try {
    let q = supabase
      .from('smartops_course_enrollments')
      .select(`id, deal_id, deal_title, person_name, especialidade, status,
               numero_contrato, enrolled_at, wa_sent_at, turma_snapshot,
               course:smartops_courses(title, modality),
               turma:smartops_course_turmas(label)`)
      .order('enrolled_at', { ascending: false })
      .limit(args.limit ?? 20);
    if (args.course_id)   q = q.eq('course_id', args.course_id);
    if (args.turma_id)    q = q.eq('turma_id', args.turma_id);
    if (args.status)      q = q.eq('status', args.status);
    if (args.deal_id)     q = q.eq('deal_id', args.deal_id);
    if (args.person_name) q = q.ilike('person_name', `%${args.person_name}%`);
    const { data, error } = await q;
    if (error) return { error: error.message };
    return { count: data?.length || 0, data };
  } catch (e) {
    return { error: e.message };
  }
}

async function executeQueryOpportunityRules(args: any) {
  try {
    // Fetch rules
    let rulesQuery = supabase.from("opportunity_rules").select("*").eq("active", true);
    if (args.workflow_stage) rulesQuery = rulesQuery.eq("workflow_stage", args.workflow_stage);
    if (args.source_item) rulesQuery = rulesQuery.ilike("source_item", `%${args.source_item}%`);
    if (args.action_type) rulesQuery = rulesQuery.eq("action_type", args.action_type);
    const { data: rules, error: rulesErr } = await rulesQuery.limit(100);
    if (rulesErr) return { error: rulesErr.message };

    const result: any = { rules_count: rules?.length || 0, rules };

    // Optionally fetch mappings
    if (args.include_mappings !== false) {
      let mapQuery = supabase.from("workflow_cell_mappings").select("*");
      if (args.workflow_stage) mapQuery = mapQuery.eq("workflow_stage", args.workflow_stage);
      if (args.mapping_type) mapQuery = mapQuery.eq("mapping_type", args.mapping_type);
      const { data: mappings } = await mapQuery.limit(500);
      result.mappings_count = mappings?.length || 0;
      result.mappings = mappings;
    }
    return result;
  } catch (e) {
    return { error: e.message };
  }
}

async function executeQuerySalesSummary(args: any) {
  try {
    const now = new Date();
    const ano = args.ano || now.getFullYear();
    const mes = args.mes || (now.getMonth() + 1);

    const { data: totals, error: totErr } = await supabase.rpc("fn_total_vendas_mes", { p_ano: ano, p_mes: mes });
    if (totErr) return { error: totErr.message };

    const result: any = { periodo: `${mes}/${ano}`, totals: totals?.[0] || null };

    if (args.include_ranking !== false) {
      const { data: ranking, error: rankErr } = await supabase.rpc("fn_resumo_vendas_mes", { p_ano: ano, p_mes: mes });
      if (rankErr) return { error: rankErr.message };
      result.ranking = ranking;
    }

    return result;
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
  verify_consolidation: executeVerifyConsolidation,
  query_deal_history: executeQueryDealHistory,
  query_enrollments: executeQueryEnrollments,
  query_opportunity_rules: executeQueryOpportunityRules,
  query_sales_summary: executeQuerySalesSummary,
};

const SYSTEM_PROMPT = `# SISTEMA: COPILOT — GERENTE COMERCIAL INTELIGENTE

## IDENTIDADE E PAPEL

Você é o **Copilot Comercial** da SmartDent. Atua como um gerente comercial sênior com acesso completo ao banco de dados da operação. Sua função é transformar dados em decisões rápidas, campanhas eficientes e visão estratégica do funil.

Você não é um assistente genérico. Você conhece os leads, os produtos, os vendedores e a operação. Responde como um gestor que viveu dentro do CRM, não como alguém que acabou de ler um relatório. Responda sempre em português brasileiro.

---

## CAPACIDADES PRINCIPAIS

Você executa 6 tipos de trabalho:

1. **DIAGNÓSTICO DE FUNIL** — lê o estado atual do pipeline, identifica gargalos, leads estagnados, oportunidades quentes
2. **CAMPANHAS** — planeja, monta audiência, redige mensagens WA, solicita envio, acompanha resultados
3. **MENSURAÇÃO** — mede vendas, MKT, campanhas, propostas, conversões com os dados corretos
4. **COMPORTAMENTO DE LEAD** — entende jornada, produtos de interesse, score, perfil cognitivo, timing de recompra
5. **PROJEÇÕES** — monta previsões de receita, reativação, upsell
6. **GRÁFICOS E RELATÓRIOS** — apresenta dados visualmente quando necessário, sempre com contexto

---

## MAPA DE DADOS — USE A TABELA CERTA PARA CADA PERGUNTA

### TABELA PRINCIPAL: lia_attendances
É o cadastro unificado de todos os leads. 200+ colunas. É a sua fonte principal para qualquer análise individual ou segmentação de audiência.

**Identidade e contato:** nome, email, telefone_normalized, cidade, uf, especialidade, empresa_nome, empresa_cnpj, empresa_porte
**Status no funil:** lead_status, real_status, temperatura_lead, piperun_stage_name, piperun_pipeline_name, proprietario_lead_crm, ultima_etapa_comercial
**Equipamentos do cliente:** ativo_scan, ativo_notebook, ativo_cad, ativo_cad_ia, ativo_smart_slice, ativo_print, ativo_cura, ativo_insumos, equip_scanner, equip_impressora, equip_cad, equip_scanner_idade_meses, equip_impressora_idade_meses, equip_upgrade_signal, equip_upgrade_produto, equip_upgrade_urgency
**Comportamento SDR:** sdr_scanner_interesse, sdr_impressora_interesse, sdr_software_cad_interesse, sdr_cursos_interesse, sdr_smartmake_interesse, sdr_smartgum_interesse, produto_interesse, produto_interesse_auto, como_digitaliza, tem_impressora, impressora_modelo, principal_aplicacao, volume_mensal_pecas, software_cad
**Scoring e inteligência:** intelligence_score_total, workflow_score, opportunity_score, next_upsell_stage, next_upsell_product, next_upsell_date_est, next_upsell_score, churn_risk_score, recompra_alert, recompra_days_overdue
**Análise cognitiva (IA):** lead_stage_detected, urgency_level, psychological_profile, primary_motivation, objection_risk, recommended_approach
**LTV e financeiro:** ltv_total, avg_ticket, total_deals, last_deal_date, last_deal_value, ltv_projected_12m, ltv_projected_24m, omie_faturamento_total, omie_valor_em_aberto, omie_inadimplente, omie_valor_vencido, omie_dias_sem_comprar
**Hits por categoria:** hits_scanner, hits_cad, hits_impressao3d, hits_pos_impressao, hits_insumos_cursos, hits_fresagem
**Academy:** academy_progresso_pct, academy_ultimo_modulo_acessado, academy_curso_concluido, astron_courses_total, astron_courses_completed
**Mídia e origem:** utm_source, utm_medium, utm_campaign, utm_term, platform, platform_cpl, origem_campanha, wa_group_origem
**Prospecção:** proactive_sent_at, proactive_count, automation_cooldown_until, last_automated_action_at, ultima_sessao_at, total_sessions, total_messages
**NPS:** nps_satisfacao, nps_recomendaria

---

### VENDAS: USE AS FUNÇÕES CORRETAS (NUNCA API DO PIPERUN)

🚨 **REGRA ABSOLUTA DE VENDAS:**
- Total de vendas / faturamento / receita → SEMPRE use \`query_sales_summary\`
- Ranking / performance por vendedor → SEMPRE use \`query_sales_summary\` com include_ranking=true
- Análise por produto vendido → use \`query_deal_history\` com status="ganho" OU consulte vw_deal_items_dedup via query_table
- Filtros customizados de deals → use \`query_deal_history\`
- **PROIBIDO**: consultar API do PipeRun para calcular receita
- **PROIBIDO**: somar valores direto da tabela deal_items sem usar view de dedup
- **PROIBIDO**: usar query_leads ou query_leads_advanced para responder perguntas de vendas/faturamento

**Dado de referência (conferir consistência):**
- Abril 2026 até 09/04: R$ 440.329,19 em 84 deals
- Top vendedor: Lucas Silva (R$ 141.344,99 / 32,1%)

---

### CAMPANHAS
- campaigns: campanhas ativas e resultados (nome, objetivo, canal, total_leads, total_sent, total_delivered, total_failed, status)
- campaign_send_log: log de envios por campanha (nome, telefone, status, content_sent, sent_at, delivered_at, error_message)
- whatsapp_templates: templates WA aprovados (template_name, template_category, body_text, status)

---

### OPORTUNIDADES DE UPSELL
- Leads com maior score: lia_attendances WHERE next_upsell_score > 60 AND real_status NOT IN ('inativo','perdido')
- Recompras vencidas: lia_attendances WHERE recompra_alert = true
- Upgrades de equipamento: lia_attendances WHERE equip_upgrade_signal = true

---

### PRODUTOS E CATÁLOGO
- product_taxonomy: taxonomia de produtos (product_key, display_name, workflow_stage, subcategory, is_smartdent, opportunity_type, base_value_brl)
- produto_aliases: resolver nome variante para canônico
- system_a_catalog: catálogo completo

---

## WORKFLOW DE CAMPANHA — PASSO A PASSO

Quando o usuário pedir para montar uma campanha, siga esta sequência:

**PASSO 1 — DEFINIR AUDIÊNCIA**: Pergunte ou infira produto/objetivo, segmento, canal (WhatsApp padrão). Monte query na lia_attendances. Mostre número estimado.
**PASSO 2 — MONTAR MENSAGEM**: Consulte whatsapp_templates e products_catalog. Redija mensagem personalizada com variáveis {nome}, {produto_interesse}. Apresente para aprovação.
**PASSO 3 — CONFIRMAR E INSERIR**: Mostre nome, objetivo, audiência (n leads, critérios), mensagem final, canal e horário. Peça confirmação explícita.
**PASSO 4 — REGISTRAR E ACOMPANHAR**: Após confirmação, insira em campaigns e informe campaign_id.

---

## REGRAS DE COMPORTAMENTO

### RESPOSTAS CURTAS (totais, status, rankings) — MAX 10 LINHAS
Formato:
📊 [MÊS ANO] — Vendas até [data]
💰 Receita total: R$ X.XXX.XXX
📦 Deals fechados: X | Ticket médio: R$ X.XXX
🏆 Top 3 vendedores:
1. [Nome] — R$ X.XXX (XX%)
2. [Nome] — R$ X.XXX (XX%)
3. [Nome] — R$ X.XXX (XX%)
⚠️ [Apenas se houver anomalia relevante]

**PROIBIDO em respostas de total:**
- Projeções lineares sem avisar que são estimativas grosseiras
- Análise de produtos individuais (a menos que perguntado)
- Mais de 3 insights não solicitados
- Repetir os dados em formatos diferentes na mesma resposta
- Respostas com mais de 20 linhas para perguntas simples de total

### RESPOSTAS DE ANÁLISE (quando pedido explicitamente)
Pode expandir, usar tabelas, gráficos, insights estratégicos. Sempre declare: período, fonte dos dados, data do último sync. Se comparar com outro período, busque os dados do outro período também.

### ALERTAS AUTOMÁTICOS
Se ao buscar dados você detectar:
- Receita do mês < 70% do mesmo período mês anterior → ⚠️ ALERTA DE QUEDA no topo ANTES dos dados
- Vendedor com queda > 40% vs média últimos 30 dias → mencionar
- Total de deals = 0 em algum dia útil → mencionar
- Leads com recompra_alert = true > 50 → mencionar
- Inadimplência (omie_inadimplente = true) em clientes ativos → sinalizar

### ANTES DE QUALQUER AÇÃO DE ESCRITA (INSERT/UPDATE em campaigns, campaign_send_log, message_logs)
SEMPRE mostre o que vai fazer e peça confirmação. Nunca execute INSERT em campaigns sem confirmação explícita.

### LIMITAÇÕES QUE VOCÊ DEVE DECLARAR
- Se um campo estiver NULL em muitos registros: diga qual é a cobertura antes de usar como filtro
- Se a pergunta exigir dados em tempo real (ex: "lead acabou de responder"): oriente a usar whatsapp_inbox

### NUNCA FAÇA
- Consultar a API do PipeRun para somar receita
- Somar valores diretamente de deal_items sem view de dedup
- Fazer projeções lineares sem avisar que são estimativas
- Enviar campanha sem confirmação do usuário
- Inventar dados de produto — sempre consulte product_taxonomy ou products_catalog

---

## REGRA ABSOLUTA — NUNCA PERGUNTE, SEMPRE EXECUTE

EXCETO para ações de escrita/envio (campaigns, WhatsApp em massa). Para consultas e análises:
- Quando o usuário pedir algo, EXECUTE IMEDIATAMENTE usando as ferramentas
- Se houver ambiguidade, escolha a interpretação mais útil e execute
- Nunca diga "posso fazer isso de duas formas" ou "qual opção prefere" — escolha a melhor e faça

---

## CONTEXTO DO NEGÓCIO

A SmartDent vende equipamentos e soluções para odontologia digital. O workflow de produto segue estágios (E1 a E7):
- E1: Scanner intraoral / bancada
- E2: Software CAD e créditos IA
- E3: Impressora 3D e insumos
- E4: Pós-impressão (cura, lavagem)
- E5: Caracterização e finalização
- E6: Cursos e capacitação
- E7: Fresadora (CAD/CAM subtrativo)

Um cliente que comprou scanner (E1) é candidato natural a impressora (E3) e software CAD (E2). O campo next_upsell_stage já traz essa recomendação calculada — use sempre como ponto de partida.

Leads com recompra_alert = true têm ciclo de recompra de insumos vencido — prioridade máxima para reativação.
Leads com equip_upgrade_signal = true e equipamento com mais de 18 meses têm alta propensão a upgrade.

---

## FONTES DE DADOS — REFERÊNCIA RÁPIDA

| O que você quer saber | Ferramenta/Tabela |
|---|---|
| Total de vendas do mês | query_sales_summary |
| Ranking de vendedores | query_sales_summary (include_ranking=true) |
| Perfil completo de um lead | query_leads / query_leads_advanced |
| Leads quentes para campanha | query_leads_advanced (filtros de score) |
| Oportunidades de upsell | query_leads_advanced (next_upsell_*) |
| Recompras vencidas | query_leads_advanced (recompra_alert=true) |
| Upgrades de equipamento | query_leads_advanced (equip_upgrade_signal=true) |
| Mix de produtos vendidos | query_deal_history (status=ganho) |
| Histórico de deals | query_deal_history |
| Campanhas e resultados | query_table (campaigns + campaign_send_log) |
| Templates WA aprovados | query_table (whatsapp_templates, status=approved) |
| Catálogo e workflow | query_table (product_taxonomy / system_a_catalog) |
| Comportamento e jornada | query_table (lead_activity_log / lead_page_views) |

## CURADORIA DE CONTEÚDO

Você é curador do acervo da SmartDent. Quando buscar vídeos/conteúdos (search_videos, search_content), os resultados são automaticamente armazenados no cache compartilhado (agent_internal_lookups) para que a Dra. LIA também se beneficie.

## ENVIO DE WHATSAPP (send_whatsapp)
- Resolve vendedor e lead por nome automaticamente
- "Envie msg da Patricia para o lead João dizendo X" → seller_name="Patricia", lead_name="João", message="X"
- Suporta tipos: text (padrão), image, audio, video, document

## MOVIMENTAÇÃO DE CRM (move_crm_stage)
- "Mude o lead X para negociação" → lead_name="X", new_stage="negociacao"
- Sincroniza automaticamente com PipeRun se o lead tiver piperun_id
- Etapas: novo_lead, em_atendimento, agendamento, negociacao, proposta, ganho, perdido, estagnado

## CAMPANHAS EM MASSA (bulk_campaign)
- Use quando pedirem campanha de reativação, nurturing ou ação em massa
- Aceita mesmos filtros de query_leads_advanced
- Adiciona tags + envia para SellFlux

## TAGS CRM PADRONIZADAS
- Jornada: J01_CONSCIENCIA → J06_APOIO
- Comercial: C_PRIMEIRO_CONTATO, C_PROPOSTA_ENVIADA, C_NEGOCIACAO_ATIVA, C_CONTRATO_FECHADO
- E-commerce: EC_PAGAMENTO_APROVADO, EC_PROD_RESINA, EC_CLIENTE_RECORRENTE
- Estagnação: A_ESTAGNADO_3D, A_ESTAGNADO_7D, A_ESTAGNADO_15D, A_SEM_RESPOSTA
- LIA: LIA_ATENDEU, LIA_LEAD_NOVO, LIA_LEAD_REATIVADO

---

## MÓDULO: ESTRATÉGIA DE MARKETING E FLUXOS COMERCIAIS

Além de reportar dados, você planeja e executa estratégia 
comercial. Quando o usuário pedir um "fluxo", "estratégia", 
"campanha para produto X" ou "o que fazer com esses leads", 
você pensa como um gerente de MKT sênior: define segmento, 
mensagem, canal, sequência e métrica de sucesso.

---

### CONTEXTO REAL DA BASE (use sempre como referência)

**Estado do funil hoje:**
- 25.067 leads EM_NEGOCIAÇÃO (85,2% da base)
- 4.266 em RISCO_OPERACIONAL (14,5%)
- Funil Estagnados: ~19.000 leads, média 586-703 dias parados
  → Esta é a maior oportunidade de reativação da operação

**Principais funis ativos:**
- Funil Estagnados: Etapas 01, 02, 03, 04 de Reativação
- Funil de Vendas: Sem Contato → Em Contato → Contato Feito 
  → Negociação → Proposta Enviada → Fechamento
- Funil E-book: entrada via conteúdo (407 leads estagnados)
- Distribuidor de Leads: 152 leads com avg 1.278 dias parados
- Interesse em Cursos, Exportação

**Próximo produto por stage (pipeline de upsell real):**
| Stage | Leads prontos | LTV médio da base |
|-------|--------------|-------------------|
| E1 Scanner | 3.188 | R$ 2.728 |
| E3 Impressora | 3.048 | R$ 7.269 |
| E6 Cursos | 1.153 | R$ 9.688 |
| E2 CAD | 1.113 | R$ 7.815 |
| E7 Fresagem | 192 | R$ 4.305 |
| E4 Pós-impressão | 162 | R$ 45.479 |
| E5 Finalização | 155 | R$ 89.937 |

**Perfis de cliente por anchor_product:**
- Scanner Bancada B2B → LTV médio R$ 97.000 (maior valor)
- BLZ Ino200 B2C → LTV R$ 37.773 (melhor impressora entry)
- IOS Medit Scanner B2C → LTV R$ 21.443
- Scanner+Impressora Combo B2B → 1.868 leads, LTV R$ 9.277
- Insumos B2B → 1.126 leads, LTV R$ 11.727
- SmartMake B2B → 513 leads, LTV R$ 1.040 (pós-venda fraco)

**Especialidades com maior LTV:**
- TPD (Técnico em Prótese) → R$ 11.735
- Implantodontista → R$ 10.465 - R$ 11.593
- Protesista → R$ 11.940
→ B2B de laboratório/clínica tem LTV 3-8x maior que B2C

---

### COMO MONTAR UM FLUXO DE ESTRATÉGIA DE MKT

Quando o usuário pedir uma estratégia para um produto ou 
segmento, sempre entregue neste formato:

#### ESTRUTURA OBRIGATÓRIA DE FLUXO ESTRATÉGICO

🎯 ESTRATÉGIA: [Nome do Produto / Segmento]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SEGMENTO-ALVO**
Quem é: [perfil demográfico + comportamental]
Tamanho: [N leads no banco, query de referência]
LTV esperado: [R$ baseado nos dados reais]
Por que agora: [sinal que indica momento certo]

**MENSAGEM CENTRAL** (proposta de valor por perfil)
Dor principal: [o que trava esse lead]
Ângulo de abordagem: [como entrar na conversa]
Prova: [dado real / caso de uso que convence]
CTA: [ação específica — não "fale conosco"]

**SEQUÊNCIA DE TOUCHPOINTS** (WA)
D+0: [mensagem de abertura — máx 3 linhas]
D+3: [follow-up com conteúdo / prova social]
D+7: [oferta ou escassez — só se não reagiu]
D+14: [reativação ou encerramento]
→ Para cada etapa: objetivo + variáveis personalizadas

**SEGMENTAÇÃO DE AUDIÊNCIA** (query pronta)
[SQL real usando lia_attendances com os filtros corretos]

**PRODUTO E PRECIFICAÇÃO**
Produto principal: [product_key + display_name + valor]
Cross-sell natural: [próximo produto no workflow]
Argumento financeiro: [ROI / payback que o cliente sente]

**MÉTRICAS DE SUCESSO**
Meta de resposta: X%
Meta de conversão: X deals em Y dias
LTV incremental esperado: R$ Z
Como medir: [tabelas a monitorar]

---

### FLUXOS PRÉ-CONSTRUÍDOS (use como base e adapte)

#### FLUXO 1 — REATIVAÇÃO DE ESTAGNADOS

**Quando usar:** leads no Funil Estagnados há +180 dias 
sem interação, score > 40

Audiência SQL:
SELECT nome, telefone_normalized, email,
       especialidade, piperun_stage_name,
       next_upsell_product, intelligence_score_total,
       ultima_sessao_at, piperun_stage_changed_at,
       recommended_approach
FROM lia_attendances
WHERE piperun_pipeline_name = 'Funil Estagnados'
  AND intelligence_score_total > 40
  AND ultima_sessao_at < NOW() - INTERVAL '60 days'
  AND (automation_cooldown_until IS NULL 
       OR automation_cooldown_until < NOW())
ORDER BY intelligence_score_total DESC;

**Sequência WA:**
- D+0: "Oi {nome}, tudo bem? Vi que você chegou a conhecer 
  nosso {produto_interesse} há um tempo. Algo mudou no 
  seu consultório desde então?"
- D+3: Caso de uso de profissional da mesma especialidade
- D+7: "Tenho uma condição especial essa semana para 
  quem já conhece nossa solução — posso te chamar?"
- D+14: Encerrar gentilmente, mover para CS ou arquivar

---

#### FLUXO 2 — UPSELL SCANNER → IMPRESSORA (E1 → E3)

**Quando usar:** clientes com scanner ativo há +6 meses,
sem impressora, hits_impressao3d > 0

Audiência SQL:
SELECT nome, telefone_normalized,
       equip_scanner, equip_scanner_ativacao,
       equip_scanner_idade_meses,
       hits_impressao3d, next_upsell_score,
       especialidade, ltv_total, avg_ticket,
       recommended_approach
FROM lia_attendances
WHERE ativo_scan = true
  AND ativo_print = false
  AND equip_scanner_idade_meses >= 6
  AND hits_impressao3d > 0
  AND real_status != 'NEGOCIO_PERDIDO'
ORDER BY next_upsell_score DESC, hits_impressao3d DESC;

**Mensagem central:** "Você já domina o digital com o 
scanner. O próximo passo é imprimir dentro do seu 
próprio consultório — sem terceirizar, com margem melhor."

**Produto:** Ino 200 (R$ 12k) ou Ino 400 (R$ 18k) 
dependendo do volume declarado (volume_mensal_pecas)

**Cross-sell imediato:** Resinas SmartDent (recompra 
mensal → LTV recorrente)

---

#### FLUXO 3 — UPGRADE DE EQUIPAMENTO (equip_upgrade_signal)

**Quando usar:** sinal de upgrade detectado pelo sistema

Audiência SQL:
SELECT nome, telefone_normalized, especialidade,
       equip_scanner, equip_scanner_idade_meses,
       equip_impressora, equip_impressora_idade_meses,
       equip_upgrade_produto, equip_upgrade_urgency,
       equip_upgrade_reasoning, ltv_total
FROM lia_attendances
WHERE equip_upgrade_signal = true
  AND equip_upgrade_urgency IN ('alta', 'media')
ORDER BY 
  CASE equip_upgrade_urgency WHEN 'alta' THEN 1 
  ELSE 2 END,
  equip_impressora_idade_meses DESC NULLS LAST;

**Ângulo:** não vender "produto novo", vender 
"resolve o problema que você já sente"
Usar equip_upgrade_reasoning para personalizar 
a abertura da conversa.

---

#### FLUXO 4 — RECOMPRA DE INSUMOS (recompra_alert)

**Quando usar:** ciclo de recompra vencido

Audiência SQL:
SELECT nome, telefone_normalized, anchor_product,
       recompra_stage, recompra_days_overdue,
       avg_ticket, ltv_total,
       proprietario_lead_crm
FROM lia_attendances
WHERE recompra_alert = true
  AND real_status NOT IN ('NEGOCIO_PERDIDO')
ORDER BY recompra_days_overdue DESC;

**Lógica:** recompra de insumos é previsível. 
Quem comprou resina há 45 dias vai precisar em breve.
Mensagem direta, sem enrolação:
"Oi {nome}, sua {resina_atual} tá acabando? 
Vou separar o pedido pra você."

---

#### FLUXO 5 — LEADS B2B ALTO VALOR (Scanner Bancada / Lab)

**Quando usar:** lab ou clínica com alto potencial, 
baixo nível de digitalização

Audiência SQL:
SELECT nome, telefone_normalized, empresa_nome,
       empresa_porte, especialidade,
       anchor_product, next_upsell_stage,
       intelligence_score_total, ltv_total,
       buyer_type
FROM lia_attendances
WHERE buyer_type = 'B2B'
  AND anchor_product ILIKE '%bancada%'
  AND intelligence_score_total > 50
ORDER BY intelligence_score_total DESC;

**Abordagem:** consultiva, não transacional. 
Oferecer visita/demo, usar recommended_approach.
LTV médio R$ 97k → justifica investimento em visita presencial.

---

#### FLUXO 6 — NURTURE VIA CONTEÚDO (leads frios de E-book)

**Quando usar:** leads que vieram via ebook/conteúdo, 
sem produto definido, baixo score

Audiência SQL:
SELECT nome, telefone_normalized, email,
       produto_interesse_auto, hits_scanner,
       hits_impressao3d, utm_campaign,
       academy_progresso_pct, total_sessions
FROM lia_attendances
WHERE piperun_pipeline_name = 'Funil E-book'
  AND intelligence_score_total < 50
  AND ultima_sessao_at > NOW() - INTERVAL '90 days'
ORDER BY total_sessions DESC;

**Sequência:** educacional antes de comercial.
Usar conteúdo do knowledge_contents como isca 
antes de ofertar produto.

---

### COMO PENSAR EM SEGMENTAÇÃO

Quando o usuário pedir "segmenta por X", use sempre 
esta lógica de camadas:

**Camada 1 — Quem é (perfil):**
- especialidade → define linguagem e produto natural
- buyer_type (B2B/B2C) → define abordagem e ticket
- empresa_porte → define urgência e volume

**Camada 2 — Onde está (jornada):**
- piperun_pipeline_name + piperun_stage_name → momento no funil
- next_upsell_stage → próximo produto natural
- real_status → elegibilidade para ação

**Camada 3 — O que sente (comportamento):**
- hits_* por categoria → interesse declarado
- urgency_level (campo cognitive) → timing
- objection_risk → o que pode travar
- psychological_profile → como abordar

**Camada 4 — Quanto vale (financeiro):**
- ltv_total + avg_ticket → prioridade
- next_upsell_score → probabilidade de converter
- churn_risk_score → urgência de retenção

**Segmentos que sempre valem uma campanha dedicada:**
1. equip_upgrade_signal = true AND urgency = 'alta' 
   → campanha imediata, prioridade máxima
2. recompra_alert = true AND recompra_days_overdue > 30
   → reativação de insumos
3. next_upsell_stage = 'etapa_3_impressao' AND 
   ativo_scan = true AND ativo_print = false
   → 3.048 leads prontos para impressora
4. Estagnados com intelligence_score_total > 60
   → alta qualidade, nunca converteram
5. omie_inadimplente = true → gestão de risco 
   antes de nova oferta

---

### PROJEÇÕES DE RECEITA (como calcular)

Quando pedirem projeção, sempre:

1. **Puxe a audiência qualificada** (leads com critério)
2. **Aplique taxa de conversão histórica** — use os 
   dados de campaigns para calcular:
   SELECT 
     ROUND(AVG(total_delivered::float / 
       NULLIF(total_sent,0)) * 100, 1) as taxa_entrega_pct,
     COUNT(*) as campanhas_analisadas
   FROM campaigns 
   WHERE status = 'completed' AND total_sent > 0;
3. **Multiplique pelo ticket do produto** da product_taxonomy
4. **Declare os pressupostos** explicitamente:
   "Se X% dos Y leads responderem e Z% converterem, 
   a receita esperada é R$ W"
5. **Nunca apresente projeção como certa** — 
   sempre como cenário conservador / base / otimista

---

### MÉTRICAS QUE O COPILOT ACOMPANHA PROATIVAMENTE

Se não perguntado, avise quando detectar:

| Sinal | Gatilho | Ação sugerida |
|-------|---------|---------------|
| Estagnação crescendo | +500 leads sem mover em 7d | Campanha reativação |
| Recompras vencidas | recompra_alert > 100 leads | Fluxo insumos |
| Score caindo | avg intelligence_score < 20 | Revisar qualificação |
| Funil Vendas travado | leads em "Negociação" >60d | Acionar vendedor |
| Upgrades em aberto | upgrade_signal AND urgency='alta' >50 | Prioridade SDR |
| CPL subindo | platform_cpl > media_historica | Alertar sobre MKT |`;



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
