# Plano consolidado: Copilot Inteligente — Status "ganha" + RAG

Dois planos aprovados, executados em sequência. Zero importação de dados — tudo já existe.

---

## PARTE A — Bug do status "ganha" (deals/CRM)

### A1. Normalizador PT-BR/EN/numérico
**Arquivo**: `supabase/functions/_shared/piperun-field-map.ts`

Adicionar helper exportado:
```ts
normalizePipeRunDealStatus(raw): "won" | "lost" | "open" | null
```
Aceita: número (`1→won`, `2→lost`, `0→open`), strings EN (`won/lost/open`), strings PT-BR (`ganha/ganho/perdida/perdido/aberta/aberto`), case-insensitive, trim.

### A2. Webhook respeita PT-BR
**Arquivo**: `supabase/functions/smart-ops-piperun-webhook/index.ts`

Substituir os 3 call-sites onde `isWon`/`isLost` são derivados de `deal.status` cru por `normalizePipeRunDealStatus(deal.status)`. Mantém o bloco "Oportunidade Encerrada" disparando `lead_status='CLIENTE_ativo'`, `status_oportunidade='ganha'`, valor da proposta, e enfileira `cognitive-lead-analysis`.

### A3. Backfill dos 511 leads travados
**Nova função**: `supabase/functions/backfill-stranded-won-deals/index.ts`

One-shot. Query: leads com `piperun_deals_history @> '[{"status":"ganha"}]'` E `lead_status <> 'CLIENTE_ativo' AND merged_into IS NULL`. Para cada um: reaproveita o handler "Oportunidade Encerrada" do webhook (extraído como função pura `applyWonDealClosure(lead, lastDealSnapshot)`), sem reabrir HTTP. Loga em `system_health_logs` com `kind='backfill_stranded_won'` e contadores.

### A4. Safety-net trigger
**Migração**:
- Trigger `tg_lia_sync_won_from_history` BEFORE UPDATE OF `piperun_deals_history` ON `public.lia_attendances`:
  - Se o último snapshot tem `status IN ('ganha','ganho','won','1',1)` E `NEW.lead_status <> 'CLIENTE_ativo'` E `NEW.merged_into IS NULL`:
    - força `lead_status='CLIENTE_ativo'`, `status_oportunidade='ganha'`
    - `valor_oportunidade = COALESCE(NEW.valor_oportunidade, (snapshot->>'value')::numeric)`
- GRANTs já existem (tabela atual). Nada novo a conceder.

### A5. Verificação A
1. `curl backfill-stranded-won-deals` → contar processados.
2. Query: `SELECT COUNT(*) FROM lia_attendances WHERE piperun_deals_history @> '[{"status":"ganha"}]' AND lead_status<>'CLIENTE_ativo' AND merged_into IS NULL` → deve cair para ~0.
3. Inserir snapshot teste via update simulando PipeRun → trigger garante consistência.

---

## PARTE B — RAG no Copilot

### Diagnóstico (já validado)
Todo conhecimento existe no projeto:
- `products_catalog` (116), `system_a_catalog` (360), `resins` (20) + `resin_documents` (47)
- `knowledge_contents` (799), `knowledge_videos` (547)
- `smartops_courses` (11), `astron_courses`
- `agent_embeddings` (2337 vetores) + RPC `match_agent_embeddings`
- Pipeline: `_shared/generate-embedding.ts`, `_shared/lia-rag.ts`, `_shared/product-rag.ts`

A Dra. LIA já usa tudo isso. O Copilot só não tem **acesso**: o `ACTION_TOOLS_ALLOWLIST` em `smart-ops-copilot/index.ts:1876-1889` exclui as tools de busca, e por isso ele responde "Não tenho esse dado no Cérebro".

### B1. Liberar tools de conhecimento no allowlist
**Arquivo**: `supabase/functions/smart-ops-copilot/index.ts`

Adicionar ao `ACTION_TOOLS_ALLOWLIST`:
- `search_content` (já implementado em `:1764`)
- `search_videos` (já implementado em `:1763`)

### B2. Três tools novas (busca de conhecimento)
**Arquivo**: `supabase/functions/smart-ops-copilot/index.ts`

Cada tool retorna no máx. 5 itens, payload ≤2KB, com `title`, `snippet`, `url` canônica (`/base-conhecimento/...`) e `similarity` quando vetorial.

1. **`search_knowledge_rag`** — busca semântica multi-fonte
   - Params: `query` (obrigatório), `top_k=5`, `min_similarity=0.5`, `sources?: ("products"|"resins"|"content"|"videos"|"courses")[]`
   - Reusa `generateEmbedding()` + RPC `match_agent_embeddings` (mesmo caminho da Dra. LIA em `dra-lia/index.ts:1651`)
   - Para perguntas técnicas/comparativas ("diferença Vitality A2 vs BL1", "qual scanner para implantes")

2. **`search_products`** — busca textual em catálogo
   - Params: `query`, `category?`, `limit=5`
   - Lê `products_catalog` + `system_a_catalog` + `resins` (ILIKE em nome/sku/categoria, dedup por nome)
   - Retorna: nome, sku, categoria, aplicação, compatibilidade, link canônico
   - Para "qual SKU da X", "lista resinas para anteriores"

3. **`search_courses`** — busca em cursos
   - Params: `query`, `limit=5`
   - Lê `smartops_courses` + `astron_courses` (ILIKE em nome/descrição)
   - Retorna: nome, módulos, carga horária, link
   - Para "tem curso de fluxo digital?"

### B3. SYSTEM_PROMPT atualizado
**Arquivo**: `supabase/functions/smart-ops-copilot/index.ts`

Adicionar bloco **"FONTES DE CONHECIMENTO"**:

```
- BRAIN CONTEXT (copilot_brain) → dados operacionais: KPIs, deals, pipeline, vendas, ranking, leads
- RAG TOOLS (search_knowledge_rag, search_products, search_content, search_videos, search_courses)
  → catálogo, especificações técnicas, conteúdo educacional, FAQs, cursos

REGRA: Antes de responder "Não tenho esse dado", SEMPRE consulte RAG quando a pergunta envolver:
- produto, SKU, preço de catálogo, compatibilidade, comparação técnica
- conteúdo, artigo, vídeo, tutorial, curso, FAQ
- diferenças entre resinas, scanners, impressoras

Cite sempre o link canônico (/base-conhecimento/{letra}/{slug}) quando usar conteúdo do RAG.
```

Não toca na regra "Cérebro = ops" — conhecimento é categoria separada e read-only, igual `get_lead_card`.

### B4. Instrumentação
Anexar `metadata.rag_hits = [{source, similarity, id}]` em `system_health_logs` por turno do Copilot quando uma das 5 tools de conhecimento for chamada. Sem schema novo.

### B5. Memória
Salvar `mem://smart-ops/copilot-rag-access-v1`:
> Copilot reads `copilot_brain` for ops data and RAG (`agent_embeddings` + catálogos `products_catalog`/`system_a_catalog`/`resins`/`knowledge_contents`/`knowledge_videos`/`smartops_courses`/`astron_courses`) for product/content knowledge. Both layers are read-only; only `ACTION_TOOLS_ALLOWLIST` may mutate. Tools de conhecimento liberadas: `search_knowledge_rag`, `search_products`, `search_content`, `search_videos`, `search_courses`.

Atualizar `mem://index.md` com a referência.

### B6. Verificação B
1. `curl smart-ops-copilot` com *"Qual a diferença entre Vitality A2 e BL1?"* → cita dados de `resins` + link canônico.
2. *"Tem curso sobre fluxo digital?"* → retorna SmartOps/Astron course com link.
3. *"Quais leads ganhamos esta semana?"* → continua via Brain (ops intacto).
4. `system_health_logs.metadata.rag_hits` populado nos turnos relevantes.

---

## Fora de escopo (ambas as partes)

- Importar catálogo, criar tabela `products`, alterar Sellflux/Astron.
- Score preditivo, abandoned checkout, payload PipeRun.
- Novos campos em `lia_attendances` (`rag_knowledge_hit`, etc.) — redundantes.
- Mexer em Dra. LIA, retry-cron ou cognitive engine.

## Entregáveis

| # | Arquivo / ação | Tipo |
|---|---|---|
| 1 | `_shared/piperun-field-map.ts` (`normalizePipeRunDealStatus`) | edit |
| 2 | `smart-ops-piperun-webhook/index.ts` (3 call-sites + extrair `applyWonDealClosure`) | edit |
| 3 | `backfill-stranded-won-deals/index.ts` | nova função |
| 4 | Migração: trigger `tg_lia_sync_won_from_history` | migração |
| 5 | `smart-ops-copilot/index.ts` (allowlist + 3 tools + SYSTEM_PROMPT + rag_hits log) | edit |
| 6 | `mem://smart-ops/copilot-rag-access-v1` + index | memória |

Zero novas tabelas. Zero importação. Reuso máximo do que já existe.
