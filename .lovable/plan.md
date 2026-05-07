## Diagnóstico

Encontrei dois bugs concretos:

### Bug 1 — Idioma ignorado pela LIA
- Em `supabase/functions/dra-lia/index.ts:3469`, a variável `langInstruction` é montada a partir de `LANG_INSTRUCTIONS` mas **nunca é injetada no `systemPrompt`** (linhas 3636–3843). O front passa `lang` corretamente (`DraLIA.tsx` mapeia `pt/en/es` → `pt-BR/en-US/es-ES` e envia no body), mas o LLM nunca recebe a instrução de idioma. Resultado: responde sempre em PT-BR independente da bandeira escolhida.
- Mensagens de interceptor (saudações, coleta de nome/telefone, escalonamento) já respeitam `lang` via `[lang] || ["pt-BR"]`. O problema é exclusivo da resposta principal do LLM.

### Bug 2 — IFUs/documentos de resinas invisíveis ao RAG
- A tabela `resin_documents` tem **47 docs (14 IFUs)** com `extracted_text`, `document_type`, `language`, etc.
- Em `supabase/functions/_shared/lia-rag.ts` (`searchContentDirect`), a LIA busca `catalog_documents`, `knowledge_videos`, `knowledge_contents`, `resins` (só metadados básicos: nome, indicação, biocompat) e `system_a_catalog`. **Nunca consulta `resin_documents`**. Por isso, quando o usuário pergunta "IFU da resina X", ela não encontra nem retorna o link do PDF.
- A tabela `resins` consultada também não traz documentos relacionados — só campos clínicos resumidos.

## O que vou alterar

### Correção 1 — Injetar `langInstruction` no prompt
Em `dra-lia/index.ts`, mover `langInstruction` para o cabeçalho do `systemPrompt` (logo após `leadNameContext`/`topicInstruction`) com peso máximo:

```ts
const systemPrompt = `${langInstruction}

Você é a Dra. L.I.A. ...`;
```

Aplicar a mesma injeção no caminho do `dra-lia-whatsapp` se ele construir prompt próprio (vou verificar e replicar se for o caso).

### Correção 2 — Adicionar `resin_documents` ao RAG
Em `_shared/lia-rag.ts`, dentro de `searchContentDirect`, adicionar bloco análogo ao de `catalog_documents` que:

1. Busca em `resin_documents` por `document_name`, `document_description`, `extracted_text`, `document_type` (ILIKE) e join com `resins(name, slug)`.
2. Detecta intenção "IFU" no `queryNormalized` (regex `/\b(ifu|instru[cç][õo]es de uso|instructions for use|bula)\b/i`) e, quando presente, dá boost de similarity para 0.85 e prioriza `document_type ILIKE 'ifu'`.
3. Inclui no resultado:
   - `chunk_text`: `[IFU] {document_name} — {trecho de extracted_text}` para o LLM citar conteúdo real.
   - `metadata.url_publica`: `file_url` direto (PDF), além de `resin_name` e `resin_slug` para o LLM linkar a página da resina como contexto.
   - Limit 5 docs por busca.
4. Respeitar coluna `active=true` (se existir) e `language` (filtrar por idioma do `lang` quando disponível, com fallback para qualquer idioma).

### Correção 3 — Reforçar prompt para entregar links de IFU
Adicionar regra explícita ao `systemPrompt` (junto às Regras de Ouro):

> "Quando o usuário pedir IFU, manual, instruções de uso ou documento técnico de uma resina, SEMPRE retorne o link direto do PDF (`url_publica` do source_type=`resin_document`) junto com 1–2 linhas resumindo o conteúdo encontrado em `extracted_text`."

### Correção 4 — Cache busting
A `agent_internal_lookups` cacheia resultados por 30 dias. Vou invalidar entradas relacionadas a resinas/IFUs:
```sql
DELETE FROM agent_internal_lookups WHERE query_normalized ~* '(ifu|resina|manual|instruc)';
```
(via tool `read_query` não dá; será migration de DELETE controlado.)

## Arquivos a tocar

- `supabase/functions/dra-lia/index.ts` — injetar `langInstruction` no `systemPrompt` + regra de IFU
- `supabase/functions/_shared/lia-rag.ts` — novo bloco `resin_documents` em `searchContentDirect` + boost para intenção IFU
- `supabase/functions/dra-lia-whatsapp/index.ts` — verificar e replicar fix de idioma se necessário
- Migration: limpar cache de `agent_internal_lookups` para queries de resinas/IFU

## Validação após o fix

1. `curl_edge_functions` em `/dra-lia` com `lang="es-ES"` perguntando sobre Vitality Classic → resposta deve vir em espanhol.
2. `curl_edge_functions` com `"qual o IFU da Vitality HT?"` → deve retornar link `file_url` real do `resin_documents`.
3. Conferir logs do `searchContentDirect` mostrando hits de `resin_documents`.

## Fora do escopo

- Reescrever a UI de upload de IFUs.
- Vetorizar `extracted_text` via embeddings (já existe pipeline; só amarrar à busca da LIA fica para iteração futura se ILIKE não bastar).
- Tradução automática do conteúdo dos IFUs (eles ficam no idioma original; LIA traduz a explicação ao redor via `langInstruction`).
