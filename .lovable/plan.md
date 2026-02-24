
# Refatoracao e verificacao de todas as referencias da LIA

## Escopo da auditoria

Arquivos auditados: 15+ arquivos entre edge functions, componentes React, locales e configuracoes.

## Problemas encontrados

### 1. CORS inconsistentes nas edge functions LIA (3 funcoes)

As seguintes edge functions usam CORS incompletos (faltam headers do Supabase client):

| Funcao | CORS atual |
|---|---|
| `dra-lia/index.ts` (linha 4-7) | Incompleto |
| `dra-lia-export/index.ts` (linha 4-7) | Incompleto |
| `archive-daily-chats/index.ts` (linha 4-7) | Incompleto |

**Correcao:** Padronizar para o mesmo formato usado nas funcoes Smart Ops ja corrigidas:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

### 2. evaluate-interaction sem CORS

O `evaluate-interaction/index.ts` nao tem CORS headers porque e chamado via webhook (trigger de banco). Isso e correto e nao precisa de alteracao.

### 3. EXTERNAL_KB_URL hardcoded com projeto errado

No `dra-lia/index.ts` (linha 100):
```typescript
const EXTERNAL_KB_URL = "https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-base";
```

Este URL aponta para o projeto Supabase `pgfgripuanuwwolmtknn`, mas o projeto atual e `okeogjgqijbfkudfjadz`. Isso significa que o `fetchCompanyContext()` esta buscando dados de um projeto diferente.

**Correcao:** Usar a variavel de ambiente `SUPABASE_URL` que ja existe:
```typescript
const EXTERNAL_KB_URL = `${SUPABASE_URL}/functions/v1/knowledge-base`;
```

### 4. Modelo de IA desatualizado na chain de fallback

No `dra-lia/index.ts` (linhas 2221-2238), a chain de fallback usa:
- Primario: `google/gemini-2.5-flash` 
- Fallback 1: `google/gemini-2.5-flash-lite`
- Fallback 2: `openai/gpt-4o-mini`
- Fallback 3: `openai/gpt-4.1-mini`

No `evaluate-interaction/index.ts` (linha 88), o judge usa:
- `google/gemini-3-flash-preview`

O modelo do judge (`gemini-3-flash-preview`) e mais recente que o modelo principal da LIA (`gemini-2.5-flash`). Isso nao e necessariamente um problema, mas vale o registro.

**Nenhuma acao necessaria** neste item. Os modelos estao funcionais.

### 5. Referencia duplicada ao `dra-lia:ask` CustomEvent (OK)

O evento `dra-lia:ask` e emitido em `KnowledgeBase.tsx` (linha 109) e escutado em `DraLIA.tsx` (linha 282). Ambas as referencias estao consistentes.

### 6. Locales consistentes (OK)

As 3 locales (pt, en, es) tem chaves identicas sob `dra_lia`. Nenhuma chave faltando.

### 7. Routing consistente (OK)

- `App.tsx` importa `AgentEmbed` e registra a rota `/embed/dra-lia`
- `DraLIA` e usado tanto standalone (flutuante) quanto embedded
- Referencia no `KnowledgeBase.tsx` ao CustomEvent esta correta

### 8. sessionStorage keys consistentes (OK)

Todas as chaves de sessionStorage usam o prefixo `dra_lia_`:
- `dra_lia_session`
- `dra_lia_lead_collected`
- `dra_lia_topic_context`

### 9. Tabelas e RLS consistentes (OK)

As tabelas `agent_interactions`, `agent_sessions`, `agent_embeddings`, `agent_knowledge_gaps`, `leads` e `knowledge_gap_drafts` estao com RLS correto e as referencias no codigo batem com os nomes das colunas.

### 10. config.toml consistente (OK)

Todas as funcoes LIA estao registradas:
- `dra-lia`: verify_jwt = false (correto, acesso publico para chat)
- `dra-lia-export`: verify_jwt = false (faz autenticacao manual no codigo)
- `evaluate-interaction`: verify_jwt = false (chamado via trigger)
- `archive-daily-chats`: verify_jwt = false (chamado por cron/admin)
- `index-embeddings`: verify_jwt = false (faz auth manual)
- `heal-knowledge-gaps`: verify_jwt = true (apenas admin)

## Plano de correcoes

| Arquivo | Tipo | Descricao |
|---|---|---|
| `supabase/functions/dra-lia/index.ts` | Bug fix | 1) CORS completo (linha 4-7) 2) EXTERNAL_KB_URL usar SUPABASE_URL (linha 100) |
| `supabase/functions/dra-lia-export/index.ts` | Bug fix | CORS completo (linha 4-7) |
| `supabase/functions/archive-daily-chats/index.ts` | Bug fix | CORS completo (linha 4-7) |

### Detalhes das correcoes

**dra-lia/index.ts - Linha 4-7:**
```typescript
// Antes:
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Depois:
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

**dra-lia/index.ts - Linha 100:**
```typescript
// Antes:
const EXTERNAL_KB_URL = "https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-base";

// Depois:
const EXTERNAL_KB_URL = `${SUPABASE_URL}/functions/v1/knowledge-base`;
```

**dra-lia-export/index.ts - Linha 4-7:**
Mesmo padrao de CORS completo.

**archive-daily-chats/index.ts - Linha 4-7:**
Mesmo padrao de CORS completo.

## Arquivos ja corretos (sem alteracao)

| Arquivo | Status |
|---|---|
| `src/components/DraLIA.tsx` | OK - referencias consistentes |
| `src/pages/AgentEmbed.tsx` | OK |
| `src/pages/KnowledgeBase.tsx` | OK - CustomEvent correto |
| `src/components/AdminDraLIAStats.tsx` | OK - queries e exports corretos |
| `supabase/functions/evaluate-interaction/index.ts` | OK - sem CORS (webhook) |
| `src/locales/pt.json`, `en.json`, `es.json` | OK - chaves consistentes |
| `src/App.tsx` | OK - rota e import corretos |
| `supabase/config.toml` | OK - todas funcoes registradas |

## Resumo

3 edge functions com CORS incompletos + 1 URL hardcoded apontando para projeto Supabase diferente. Apos as correcoes, todas as funcoes LIA terao CORS padronizado e o `fetchCompanyContext()` buscara dados do projeto correto.
