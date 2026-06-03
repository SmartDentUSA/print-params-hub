## Diagnóstico

Olhando o timeline que você colou + o código atual:

1. **Spam de notas idênticas no mesmo lead**
   - O lock anti-duplicação fica em `lia_attendances.last_seller_note_hash/_at` (por lead).
   - Esse lead tem **5 deals abertos** em pipelines diferentes. Cada novo deal dispara `postRichSellerNote`, gera um hash diferente (o resumo CRM muda — "5 deals" vs "4 deals") e o lock por lead não impede nada.
   - Resultado: a cada nova entrada de Meta/redelivery, o vendedor recebe N notas de "Resumo do Lead" no mesmo dia.

2. **Análise SPIN ruim e fora de contexto**
   - O LLM (`enrichSpinWithLLM`) está caindo/timeoutando — o que aparece na nota é o **seed determinístico** (`buildSpinBriefing`).
   - O seed produz `Qual "[object Object]" você usa hoje?` em `workflow-diagnosis.ts:1402` quando `key_specs` traz objetos aninhados (`o.label = { pt: "..." }`).
   - Não há uso real da RAG (Knowledge Base / dossiês do System A) na nota; tudo é heurístico estático.

3. **Pouco valor para o vendedor**
   - Nota tem ~80 linhas com roteiro, diagnóstico, alerta. O vendedor não consegue acionar nada em 10 segundos.

## Plano

### 1. Eliminar duplicidade real (por deal, não por lead)

`supabase/functions/_shared/seller-summary.ts` + `smart-ops-lia-assign/index.ts` + `smart-ops-deal-form-note/index.ts`:

- Criar tabela `smartops_deal_note_locks (deal_id bigint PK, lead_id uuid, content_hash text, posted_at timestamptz)` com GRANTs e RLS (service_role only).
- Em `postRichSellerNote`, substituir o "atomic claim" em `lia_attendances` por `upsert` em `smartops_deal_note_locks` com `WHERE content_hash IS DISTINCT FROM :hash OR posted_at < now() - interval '24h'`.
- Manter um **floor por lead** de 60s (qualquer deal) apenas para amortecer bursts de redelivery — sem bloquear notas legítimas em deals distintos.

### 2. Reescrever a nota: cabeçalho acionável + RAG

`supabase/functions/_shared/seller-summary.ts` — nova estrutura:

```text
🎯 PITCH — <produto-alvo>
⏱ <TIMING> · <ação recomendada em 1 linha>
👤 <persona> · <porte> · <maturidade>
📞 PRÓXIMA AÇÃO: <verbo + canal + janela>
💡 3 PERGUNTAS-CHAVE: ...
🧱 2 OBJEÇÕES PROVÁVEIS + resposta da RAG: ...
📚 RAG (Smart Dent): 3 cards [título — 140 chars — link interno]
─────────────
<details>📋 Diagnóstico completo (roteiro 7×3, todas as perguntas SPIN, histórico)</details>
```

- Puxar top-3 entradas da RAG via RPC já existente (`search_knowledge_rag`) usando como query o `produto_interesse` ou `intent.matched_product_label`.
- Pré-trabalhar 2 objeções pedindo ao LLM um JSON adicional `{ objecoes: [{ objeção, resposta_rag, link }] }` baseado na RAG carregada.
- Cabeçalho fica fora do `<details>` e é o que o vendedor lê primeiro.

### 3. Corrigir bug "[object Object]"

`workflow-diagnosis.ts:1389-1402`:
- Achatar `key_specs` recursivamente: se `String(x) === "[object Object]"`, tentar `x.pt || x.value || Object.values(x).find(v=>typeof v==='string')`.
- Filtrar qualquer item resultante que ainda contenha `[object` ou tenha < 3 chars.
- Adicionar teste unitário leve em `_shared/__tests__/workflow-diagnosis_test.ts`.

### 4. Suprimir seed quando LLM falha

`seller-summary.ts` + `workflow-diagnosis.ts`:
- Se `enrichSpinWithLLM` retornar `null`, **não** renderizar o bloco "PERGUNTAS SPIN" com o seed cru — em vez disso, mostrar só "🤖 Análise IA indisponível agora — perguntas-chave estão no roteiro abaixo" e manter apenas o roteiro determinístico.
- Garante que nunca mais sai `Qual "[object Object]"...`.

### 5. Telemetria

- Logar em `system_health_logs`: `seller_note_skipped_duplicate` (com `deal_id`, `lead_id`, `reason`) e `seller_note_llm_unavailable` para monitorar quanto da degradação vem do gateway.

## Detalhes técnicos

- **Migration** (nova): `smartops_deal_note_locks` + índice em `lead_id`, `posted_at`. GRANT só para `service_role`.
- **Edge functions a redeployar**: `smart-ops-lia-assign`, `smart-ops-deal-form-note`, `smart-ops-preview-seller-note`.
- **Sem mudança de schema** em `lia_attendances` — colunas `last_seller_note_*` ficam como legado (não removo nesta iteração para evitar bater em código fora do escopo).
- **RAG**: usar `search_knowledge_rag` com `match_count=3` e `min_similarity=0.55`. Se vier vazio, cair para `search_knowledge_content` (FTS) — mesma política do Dra. LIA (Complete Collection).
- **Memória do projeto**: atualizar `mem://architecture/seller-note-pipeline` (novo) com a regra "1 nota por (deal_id, content_hash) + janela 60s por lead".

## Fora do escopo

- Não vou tocar na lógica de criação/merge de deals do PipeRun.
- Não vou alterar a política Golden Rule de freeze de VENDAS.
- Não vou refatorar `workflow-diagnosis.ts` inteiro — só os pontos 3 e 4.
