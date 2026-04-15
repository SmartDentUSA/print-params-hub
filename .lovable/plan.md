

# Plano: Criar MCP Server para Claude usar o SmartDent Revenue OS

## O que é isso

Um **MCP Server** (Model Context Protocol) é um serviço que permite ao Claude acessar diretamente os dados e ferramentas do seu sistema. Ao configurá-lo como "Conector Personalizado" no Claude, ele poderá consultar leads, buscar artigos, verificar métricas — tudo sem sair da conversa.

## Como funciona

O Claude envia requisições HTTP para uma Edge Function no seu Supabase. Essa function expõe "tools" (ferramentas) que o Claude pode chamar, como buscar leads, consultar estatísticas, pesquisar conteúdo, etc.

```text
Claude Desktop/Web
      │
      ▼
MCP Connector (HTTPS)
      │
      ▼
Edge Function: mcp-server (Supabase)
      │
      ▼
Banco de dados SmartDent (lia_attendances, knowledge_base, etc.)
```

## Alterações

### 1. Nova Edge Function: `supabase/functions/mcp-server/index.ts`

Usar a biblioteca **mcp-lite** com Hono para criar um MCP Server Streamable HTTP. Expor as seguintes tools (reutilizando a lógica já existente no Copilot):

| Tool | Descrição |
|------|-----------|
| `query_leads` | Busca leads por filtros (nome, email, cidade, etapa CRM, score) |
| `query_stats` | Métricas agregadas (leads por etapa, score médio, total) |
| `search_content` | Busca artigos na base de conhecimento |
| `search_videos` | Busca vídeos por título/tags |
| `describe_table` | Lista colunas de uma tabela |
| `query_table` | Consulta genérica em tabelas do sistema |
| `check_missing_fields` | Auditoria de dados — campos faltantes |

Cada tool faz queries diretas no Supabase usando `SUPABASE_SERVICE_ROLE_KEY`. Autenticação via Bearer token (um secret `MCP_AUTH_TOKEN` que você define).

### 2. Segurança

- Validação de Bearer token em todas as requisições (secret `MCP_AUTH_TOKEN`)
- Queries somente leitura (SELECT) — sem UPDATE/DELETE
- Filtro `WHERE merged_into IS NULL` obrigatório em `lia_attendances`
- Limite de 50 resultados por query

### 3. Configuração no Claude

Após deploy, você configura no Claude como conector personalizado:
- **URL**: `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/mcp-server`
- **Auth**: Bearer token com o `MCP_AUTH_TOKEN` definido

## Detalhes técnicos

- Biblioteca: `mcp-lite@^0.10.0` via npm (compatível com Deno)
- Roteamento: Hono
- Protocolo: MCP Streamable HTTP (POST)
- Arquivo único: `supabase/functions/mcp-server/index.ts`
- Secret necessário: `MCP_AUTH_TOKEN` (você escolhe o valor)

## Arquivos afetados

- `supabase/functions/mcp-server/index.ts` — **novo** (único arquivo de código)

