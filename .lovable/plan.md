

# Plano: LIA v2 — Fase 1 (Otimizações de Produção) + Aba Suporte

Este plano cobre as implementações prioritárias: resize de imagem, cache de embeddings, telemetria, e a aba Suporte no admin. Organizado em ordem de dependência.

## Escopo Total: 4 entregas

### 1. Resize + Compressão de Imagem (Frontend + WhatsApp)

**DraLIA.tsx** (linha 328-354): Substituir leitura direta do FileReader por pipeline canvas:
- Criar função `normalizeImage(file)` que usa `createImageBitmap` + canvas para resize max 1024px e JPEG 80%
- Skip se arquivo < 500KB
- Atualizar `handleImageSelect` para usar essa função antes de setar `pendingImage`

**wa-inbox-webhook** (linha ~160): Após download da imagem e antes de converter para base64:
- Resize via canvas API do Deno (sem sharp — não disponível em Deno Deploy)
- Alternativa: usar `ImageBitmap` se disponível, ou enviar com flag de tamanho para o `dra-lia` fazer o resize

### 2. Cache de Embeddings (2 tabelas + lógica no generate-embedding)

**Migration SQL**:
```sql
CREATE TABLE image_embedding_cache (
  image_hash text PRIMARY KEY,
  embedding vector(768),
  hit_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE text_embedding_cache (
  text_hash text PRIMARY KEY,
  embedding vector(768),
  hit_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```
RLS: service_role only (usado apenas em edge functions).

**generate-embedding.ts**: Antes de chamar Gemini, computar SHA256 do input → check cache → se hit, retornar e incrementar `hit_count` → se miss, gerar e inserir.

### 3. Telemetria Visual

**Migration SQL**:
```sql
CREATE TABLE image_query_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  image_hash text,
  image_size_kb int,
  cache_hit boolean,
  embedding_time_ms int,
  vector_results_count int,
  top_match_score float,
  gatekeeper_result text,
  failure_detected text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_iql_session ON image_query_logs(session_id);
CREATE INDEX idx_iql_created ON image_query_logs(created_at);
```

**dra-lia/index.ts**: Inserir log (fire-and-forget) após cada query visual com os campos acima.

### 4. Aba Suporte no Admin

**Migration SQL** — Tabela `support_cases`:
- Campos: `title`, `problem_description`, `failure_type`, `confidence`, `causes` (jsonb), `solutions` (jsonb), `image_urls` (text[]), `tags` (text[])
- Parametrização: `brand_id` FK brands, `model_id` FK models, `resin_id` FK resins
- 15 colunas workflow (uuid[]): `workflow_scanners`, `workflow_cad_softwares`, `workflow_resins`, `workflow_print_software`, `workflow_printers`, `workflow_print_accessories`, `workflow_print_parts`, `workflow_cure_equipment`, `workflow_finishing`, `workflow_final_equipment`, `workflow_characterization`, `workflow_installation`, `workflow_dentistry_ortho`, `workflow_lab_supplies` + `workflow_notebook` (text)
- Controle: `status` (pending/approved/rejected), `author_user_id`, timestamps
- RLS via `is_admin(auth.uid())`

**`src/hooks/useSupportCases.ts`** (novo, ~120 linhas):
- CRUD para support_cases
- `fetchProductsByCategory(category, subcategory?)` — query system_a_catalog
- Fetch brands, models (filtrado por brand_id), resins

**`src/components/AdminSupportCases.tsx`** (novo, ~650 linhas):
- Lista de casos com filtro por status + badges coloridos
- Formulário com 3 seções Accordion:
  - **Dados do Caso**: título, descrição, failure_type (Select), confiança (Slider), causas (tags), soluções (textarea), imagens
  - **Parametrização**: marca → modelo (cascading) → resina
  - **Workflow 5 etapas** (Collapsible): cada etapa com multi-selects puxando system_a_catalog por category/subcategory
- Botões Aprovar/Rejeitar/Excluir

**`AdminKnowledge.tsx`** — 4 linhas de mudança:
- Import do componente
- Grid-cols de 7 para 8
- TabsTrigger "🛠️ Suporte" após Validador
- TabsContent com `<AdminSupportCases />`

## Arquivos Modificados/Criados

| Arquivo | Ação |
|---------|------|
| 4 migrations SQL | Criar tabelas (cache, telemetria, support_cases) |
| `src/components/DraLIA.tsx` | Adicionar `normalizeImage` no upload |
| `supabase/functions/_shared/generate-embedding.ts` | Cache lookup/store |
| `supabase/functions/dra-lia/index.ts` | Log telemetria visual |
| `src/hooks/useSupportCases.ts` | Novo |
| `src/components/AdminSupportCases.tsx` | Novo |
| `src/components/AdminKnowledge.tsx` | +4 linhas (tab) |

