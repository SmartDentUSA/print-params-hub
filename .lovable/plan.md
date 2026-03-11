

# Plano: Cache de Inteligência Interna LIA ↔ Copilot

## Problema
Quando a LIA busca conteúdo (vídeos, documentos, resinas) para responder um lead, essa busca é descartada. Se outro lead perguntar algo similar, a busca é refeita do zero. Não há memória compartilhada entre as consultas internas.

## Solução
Criar uma tabela `agent_internal_lookups` que armazena cada consulta interna (query do lead → resultados encontrados), funcionando como cache inteligente e base de aprendizado.

### 1. Nova Tabela: `agent_internal_lookups`

```sql
CREATE TABLE public.agent_internal_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_normalized text NOT NULL,        -- query normalizada (lowercase, sem acentos)
  query_original text NOT NULL,          -- pergunta original do lead
  source_function text NOT NULL DEFAULT 'dra-lia', -- quem pediu
  results_json jsonb NOT NULL DEFAULT '[]',  -- resultados encontrados
  results_count integer NOT NULL DEFAULT 0,
  result_types text[] DEFAULT '{}',      -- ex: ['video','article','resin']
  hit_count integer DEFAULT 1,           -- quantas vezes foi reutilizado
  last_hit_at timestamptz DEFAULT now(),
  session_id text,                       -- sessão que originou
  lead_id uuid,                          -- lead que perguntou
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_internal_lookups_query ON agent_internal_lookups 
  USING gin(to_tsvector('portuguese', query_normalized));
CREATE INDEX idx_internal_lookups_types ON agent_internal_lookups 
  USING gin(result_types);
```

### 2. Lógica na `dra-lia/index.ts`

Nova função `searchContentDirect()` com cache em 2 etapas:

```text
Lead pergunta: "Tem vídeo sobre placas miorrelaxantes?"
  │
  ▼
ETAPA 1 — Cache Check
  SELECT * FROM agent_internal_lookups
  WHERE to_tsvector('portuguese', query_normalized) @@ plainto_tsquery('portuguese', ?)
    AND results_count > 0
    AND created_at > now() - interval '30 days'
  ORDER BY hit_count DESC, last_hit_at DESC
  LIMIT 3
  │
  ├─ Cache HIT → injeta results_json no contexto, UPDATE hit_count+1
  │
  └─ Cache MISS ↓
  
ETAPA 2 — Busca Direta
  ├─ knowledge_videos (FTS via search_vector)
  ├─ knowledge_contents (ILIKE título/excerpt, active=true)
  ├─ catalog_documents (ILIKE título/descrição, active=true)
  └─ resins (ILIKE nome)
  │
  ▼
INSERT resultado em agent_internal_lookups
  │
  ▼
Injeta no contexto RAG da LIA
```

### 3. Atualização do Prompt (Regra 10)

Remover:
> "Se pedirem vídeo sem link exato, admita."

Substituir por:
> "Você tem acesso COMPLETO ao acervo SmartDent. Consulte a base interna automaticamente. Se mesmo assim não encontrar, responda: 'Não encontrei um [tipo] específico sobre [tema] no momento, mas posso te explicar...'"

### 4. Copilot também grava lookups

Quando o Copilot usar `search_videos` ou `search_content`, também grava em `agent_internal_lookups` com `source_function = 'copilot'`, alimentando o cache para a LIA.

### 5. Benefícios do Cache Compartilhado

- **Performance**: Queries repetidas (ex: "vídeo sobre resina modelo") resolvidas em 1 query SQL em vez de 4
- **Inteligência cruzada**: O que o Copilot descobre fica disponível para a LIA e vice-versa
- **Analytics**: `hit_count` revela os conteúdos mais procurados; `results_count = 0` revela gaps de conteúdo
- **TTL de 30 dias**: Cache expira naturalmente para refletir novos conteúdos adicionados

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| **Migration SQL** | Criar tabela `agent_internal_lookups` + índices |
| `supabase/functions/dra-lia/index.ts` | Nova `searchContentDirect()` com cache, integração no pipeline RAG, atualização regra 10 |
| `supabase/functions/smart-ops-copilot/index.ts` | Gravar lookups nas tools de busca + seção curadoria no prompt |

