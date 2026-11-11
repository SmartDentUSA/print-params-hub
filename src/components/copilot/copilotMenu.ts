import { sidebarGroups } from "@/components/admin/systemMenu";

// Catálogo das subabas de cada item do menu lateral, usado pelo Copilot para
// conduzir o usuário: área → subaba → o que fazer → perguntas de cadastro.
// Só apresentação: quem decide o que pode ser gravado é o servidor do Copilot.

export type GuidedKey = "tabela_promocional" | "campanha_grupos_whatsapp" | "campanha_completa";

/** wizard = passo a passo campo a campo sem IA (src/lib/copilotWizard.ts). */
export type CopilotAction = { label: string; prompt: string; guided?: GuidedKey; wizard?: "tabela_promocional" | "membro_equipe" };
export type CopilotSubtab = {
  id: string;
  title: string;
  hint: string;
  /** Exemplo de pedido mostrado na pergunta "O que você quer fazer?". */
  example?: string;
  /** Valor do parâmetro `sub` na URL, quando a tela abre a subaba por ele. */
  urlSub?: string;
  actions?: CopilotAction[];
};

export type MenuContext = {
  group: string;
  section_id: string;
  section: string;
  subtab_id: string;
  subtab: string;
  hint: string;
  guided?: GuidedKey;
};

const one = (title: string, hint: string, actions?: CopilotAction[]): CopilotSubtab[] => [
  { id: "principal", title, hint, actions },
];

export const SECTION_SUBTABS: Record<string, CopilotSubtab[]> = {
  // Catálogo
  models: one("Modelos", "Cadastro de modelos de impressora (informações básicas e imagem)."),
  catalog: [
    { id: "catalog", title: "Catálogo", hint: "Produtos do catálogo comercial, preços e variações." },
    { id: "sku-mapping", title: "Mapeamento de SKU", hint: "Vínculo entre SKUs do catálogo, ERP e loja." },
    {
      id: "promotional-tables", title: "Tabelas promocionais",
      hint: "Tabelas de preços promocionais com combos, itens, vigência e cupons.",
      actions: [
        { label: "Criar nova tabela promocional", prompt: "Quero criar uma nova tabela promocional.", guided: "tabela_promocional", wizard: "tabela_promocional" },
        { label: "Editar uma tabela existente", prompt: "Quero editar uma tabela promocional existente.", guided: "tabela_promocional" },
      ],
    },
  ],
  documents: one("Docs Sistema", "Documentos técnicos e comerciais do sistema."),
  // Conteúdo
  knowledge: [
    { id: "content", title: "Conteúdo", hint: "Texto dos artigos da Base de Conhecimento.",
      actions: [{ label: "Criar rascunho de artigo", prompt: "Quero criar um rascunho de artigo para a Base de Conhecimento." }] },
    { id: "ai-generation", title: "IA", hint: "Geração de artigos com IA." },
    { id: "seo", title: "SEO", hint: "Título, descrição e palavras-chave dos artigos." },
    { id: "faqs", title: "FAQs", hint: "Perguntas frequentes dos artigos." },
    { id: "media", title: "Mídias", hint: "Vídeos e imagens vinculados aos artigos." },
    { id: "conversion", title: "Conversão", hint: "Chamadas para ação dos artigos." },
  ],
  "knowledge-hub": [
    { id: "faqs", title: "FAQs", hint: "Perguntas frequentes gerais." },
    { id: "datasheets", title: "Fichas técnicas", hint: "Fichas técnicas de produtos." },
    { id: "stories", title: "Casos de sucesso", hint: "Casos de sucesso de clientes (nunca inventados)." },
  ],
  authors: one("Autores", "Cadastro de autores dos artigos."),
  // Smart Ops
  "so-bowtie": one("Bowtie", "Painel do funil completo (leitura e análise)."),
  "so-kanban": one("Público / Lista", "Lista de leads, filtros e públicos.", [
    { label: "Atualizar dados de um lead", prompt: "Quero atualizar os dados de um lead." },
    { label: "Adicionar tags a leads", prompt: "Quero adicionar tags a leads." },
    { label: "Criar um público", prompt: "Quero criar um público de leads para campanha." },
  ]),
  "so-equipe": [
    { id: "dados", title: "Dados do membro", hint: "Cadastro dos membros da equipe.", example: "“cadastrar a Maria como vendedora”",
      actions: [{ label: "Cadastrar novo membro", prompt: "Quero cadastrar um novo membro na equipe.", wizard: "membro_equipe" }] },
    { id: "wa", title: "WhatsApp individual", hint: "Instância de WhatsApp de cada membro." },
    { id: "grupos", title: "Grupos (EvoGo)", hint: "Instância de grupos de cada membro." },
  ],
  "so-reguas": one("Automações", "Réguas de relacionamento e regras de CS."),
  "so-logs": [
    { id: "envios", title: "Logs de Envios", hint: "Histórico de mensagens enviadas." },
    { id: "chegada", title: "Log de Chegada", hint: "Histórico de leads recebidos." },
  ],
  "so-reports": one("Relatórios", "Relatórios comerciais.", [
    { label: "Gerar relatório comercial", prompt: "Quero gerar um relatório comercial." },
  ]),
  "so-conteudo": one("Conteúdo", "Produção de conteúdo."),
  "so-saude": [
    { id: "check", title: "Check", hint: "Verificação geral do sistema." },
    { id: "incoming", title: "Entradas", hint: "Dados recebidos pelas integrações." },
    { id: "functions", title: "Funções", hint: "Funções do servidor." },
    { id: "logs", title: "Logs", hint: "Registros de erros e eventos." },
  ],
  "so-whatsapp": one("WhatsApp", "Caixa de entrada do WhatsApp.", [
    { label: "Enviar mensagem a um lead", prompt: "Quero enviar uma mensagem de WhatsApp para um lead." },
  ]),
  "so-formularios": [
    { id: "formularios", title: "Formulários", hint: "Formulários de captação e suas perguntas (campos padrão reutilizados)." },
    { id: "link-na-bio", title: "Link da Bio", hint: "Cards da página Link da Bio." },
  ],
  "so-treinamentos": [
    { id: "agendamentos", title: "Agendamentos", hint: "Agendamentos de treinamentos." },
    { id: "catalogo", title: "Catálogo", hint: "Catálogo de treinamentos." },
    { id: "inscricoes", title: "Inscrições", hint: "Inscrições nas turmas." },
    { id: "lista-espera", title: "Lista de espera", hint: "Lista de espera das turmas lotadas." },
    { id: "publica-imersoes", title: "Página Pública Imersões", hint: "Página pública das imersões." },
    { id: "publica-aovivo", title: "Página Pública Ao Vivo", hint: "Página pública das aulas ao vivo." },
    { id: "calendario", title: "Calendário", hint: "Calendário de turmas." },
    { id: "nps", title: "NPS Pós-Treinamento", hint: "Pesquisa de satisfação após o treinamento." },
    { id: "nps-demos", title: "Treinamentos Online (NPS)", hint: "NPS e reativação da base dos treinamentos online." },
    { id: "nps-recomendados", title: "NPS - Cursos recomendados", hint: "Cursos recomendados pelo NPS." },
  ],
  "so-tokens-ia": one("Tokens IA", "Consumo de IA."),
  "so-ai-routing": one("AI Routing", "Roteamento entre modelos de IA."),
  "so-intelligence": [
    { id: "overview", title: "Visão geral", hint: "Inteligência comercial." },
    { id: "sentinela", title: "Sentinela", hint: "Monitoramento dos grupos de WhatsApp." },
  ],
  "so-roi": one("ROI", "Análises de ROI."),
  "so-mapeamento": [
    { id: "sdr", title: "SDR", hint: "Mapeamento 7×3 do SDR." },
    { id: "products", title: "Produtos", hint: "Mapeamento de produtos." },
    { id: "competitors", title: "Concorrentes", hint: "Mapeamento de concorrentes." },
    { id: "rules", title: "Regras", hint: "Regras do mapeamento." },
  ],
  "so-campanhas": [
    { id: "biblioteca", urlSub: "biblioteca", title: "Biblioteca de Conteúdo", hint: "Conteúdos para campanhas." },
    {
      id: "criar", urlSub: "criar", title: "Criar Campanha", hint: "Montagem de campanhas.",
      actions: [
        { label: "Campanha completa (ex.: Black Friday)", prompt: "Quero criar uma campanha completa de Black Friday.", guided: "campanha_completa" },
        { label: "Só a tabela promocional", prompt: "Quero criar uma nova tabela promocional.", guided: "tabela_promocional", wizard: "tabela_promocional" },
        { label: "Só a campanha de grupos", prompt: "Quero criar uma campanha para grupos de WhatsApp.", guided: "campanha_grupos_whatsapp" },
      ],
    },
    { id: "rascunhos", urlSub: "rascunhos", title: "Rascunhos", hint: "Campanhas em rascunho." },
    { id: "historico", urlSub: "historico", title: "Histórico", hint: "Campanhas já enviadas." },
    {
      id: "grupos-wa", urlSub: "grupos-wa", title: "Grupos WA", hint: "Campanhas com sequência de mensagens para grupos de WhatsApp.",
      actions: [
        { label: "Criar campanha para grupos", prompt: "Quero criar uma campanha para grupos de WhatsApp.", guided: "campanha_grupos_whatsapp" },
        { label: "Editar um rascunho de campanha", prompt: "Quero editar um rascunho de campanha de grupos de WhatsApp.", guided: "campanha_grupos_whatsapp" },
      ],
    },
    { id: "formularios-meta", urlSub: "formularios-meta", title: "Origens", hint: "Origens e formulários Meta." },
    { id: "anuncios", urlSub: "anuncios", title: "Anúncios", hint: "Anúncios das campanhas." },
    { id: "links-lia", urlSub: "links-lia", title: "Links da LIA", hint: "Links de atendimento da Dra. LIA." },
    { id: "pushapp", urlSub: "pushapp", title: "PushApp", hint: "Notificações PushApp." },
    { id: "email-sequencial", urlSub: "email-sequencial", title: "Automação e-mails sequenciais", hint: "Sequências automáticas de e-mail." },
  ],
  "so-distribuicao": [
    { id: "cadastro", title: "Distribuidores", hint: "Cadastro de distribuidores." },
    { id: "catalogo", title: "Catálogo de Produtos", hint: "Catálogo para distribuidores." },
    { id: "tabela", title: "Tabela de Preço", hint: "Tabela de preço para distribuidores." },
    { id: "proposta", title: "Gerar Proposta", hint: "Propostas para distribuidores." },
  ],
  "so-reativacao": [
    { id: "ltv", title: "Regras LTV", hint: "Regras de recompra e LTV." },
    { id: "flows", title: "Fluxos Editor", hint: "Editor de fluxos de reativação." },
    { id: "ingestion", title: "Ingestão de Leads", hint: "Regras de entrada de leads." },
    { id: "crm", title: "Regras CRM", hint: "Regras de envio ao CRM." },
    { id: "normalize", title: "Normalizar Campos", hint: "Padronização de campos dos leads." },
    { id: "settings", title: "Configurações", hint: "Configurações da reativação." },
  ],
  "so-eventos": one("Eventos", "Eventos e feiras."),
  "so-usados": [
    { id: "pending", title: "Fila", hint: "Anúncios de equipamentos usados aguardando aprovação." },
    { id: "review", title: "Auditoria", hint: "Anúncios em auditoria." },
    { id: "reported", title: "Denunciados", hint: "Anúncios denunciados." },
    { id: "active", title: "No ar", hint: "Anúncios publicados." },
  ],
  "so-rayshape": one("Rayshape", "Painel Rayshape."),
  "so-stripe": one("Stripe / Pagamentos", "Pagamentos via Stripe."),
  "so-cursos": one("Cursos", "Cursos de profissionais parceiros."),
  // Ferramentas
  tools: one("Ferramentas", "Ferramentas de conteúdo e exportação."),
  "pandavideo-test": one("PandaVideo", "Vídeos do PandaVideo."),
  // Sistema
  stats: one("Estatísticas", "Estatísticas de uso."),
  users: [
    { id: "usuarios", title: "Usuários do sistema", hint: "Usuários com acesso ao painel." },
    { id: "acessos", title: "Acessos enviados (clientes)", hint: "Acessos enviados a clientes." },
  ],
  settings: [
    { id: "brands", title: "Marcas", hint: "Marcas de impressoras." },
    { id: "models", title: "Modelos", hint: "Modelos de impressoras." },
    { id: "resins", title: "Resinas", hint: "Resinas e suas configurações." },
    { id: "parameters", title: "Parâmetros", hint: "Parâmetros de impressão." },
    { id: "cta3", title: "CTA", hint: "Chamadas para ação." },
    { id: "hub", title: "Hub", hint: "Configurações do Hub." },
    { id: "seo", title: "SEO", hint: "Configurações de SEO." },
    { id: "data", title: "Dados", hint: "Importação e exportação de dados." },
  ],
};

/** Itens fora do menu do Copilot: o próprio Copilot e o Suporte (dados isolados). */
const HIDDEN = new Set(["so-copilot", "suporte-tecnico"]);

export const copilotMenuGroups = sidebarGroups
  .map((g) => ({ ...g, items: g.items.filter((i) => !HIDDEN.has(i.id)) }))
  .filter((g) => g.items.length > 0);

export function findSection(sectionId: string) {
  for (const g of copilotMenuGroups) {
    const item = g.items.find((i) => i.id === sectionId);
    if (item) return { group: g, item, subtabs: SECTION_SUBTABS[sectionId] ?? one(item.title, item.title) };
  }
  return null;
}

export function buildMenuContext(sectionId: string, subtabId: string, guided?: GuidedKey): MenuContext | null {
  const found = findSection(sectionId);
  const sub = found?.subtabs.find((s) => s.id === subtabId);
  if (!found || !sub) return null;
  return {
    group: found.group.label,
    section_id: sectionId,
    section: found.item.title.replace(/^[^\p{L}\p{N}]+/u, "").trim(),
    subtab_id: sub.id,
    subtab: sub.title,
    hint: sub.hint,
    guided,
  };
}

export function menuPath(ctx: Pick<MenuContext, "section" | "subtab">) {
  return ctx.section === ctx.subtab ? ctx.section : `${ctx.section} › ${ctx.subtab}`;
}

/** Botões de opção sugeridos pelo Copilot: bloco ```copilot-options [..] ``` no texto. */
export const OPTIONS_BLOCK_RE = /```copilot-options\s*\n([\s\S]*?)\n?```/g;

export function parseOptions(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x ?? "").trim()).filter((x) => x && x.length <= 120).slice(0, 8);
  } catch { return []; }
}
