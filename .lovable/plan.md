

## Plano: Dashboard de Consumo de Tokens IA (substitui aba "Modelos IA")

### Contexto

O sistema usa IA em **22 edge functions** via 3 provedores:
- **Lovable Gateway** (Gemini): 19 funções
- **DeepSeek API**: 1 função (ai-model-compare)
- **Google AI (Embeddings)**: 5 funções (index-embeddings, index-spin-entries, ingest-knowledge-text, heal-knowledge-gaps, dra-lia)

Não existe tabela de tracking de tokens no banco. Precisamos criar uma.

### 1. Migration: Criar tabela `ai_token_usage`

```sql
CREATE TABLE public.ai_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  function_name text NOT NULL,        -- ex: "dra-lia", "translate-content"
  action_label text NOT NULL,         -- ex: "Chat com lead", "Tradução EN"
  provider text NOT NULL DEFAULT 'lovable', -- lovable | deepseek | google
  model text,                         -- ex: "gemini-2.5-flash", "deepseek-chat"
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  estimated_cost_usd numeric(10,6) DEFAULT 0,
  metadata jsonb DEFAULT '{}'
);

ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only" ON public.ai_token_usage
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "service_insert" ON public.ai_token_usage
  FOR INSERT TO anon WITH CHECK (true);

CREATE INDEX idx_ai_token_usage_created ON public.ai_token_usage(created_at DESC);
CREATE INDEX idx_ai_token_usage_function ON public.ai_token_usage(function_name);
```

### 2. Edge Function: `log-ai-usage` (helper reutilizável)

Uma edge function simples que as demais funções chamam internamente para registrar consumo. Alternativamente, inserção direta via Supabase client service-role já presente nas funções.

### 3. Novo componente: `SmartOpsAIUsageDashboard.tsx` (substitui `SmartOpsModelCompare`)

**Funcionalidades:**
- **Filtro de mês** (seletor mês/ano)
- **Cotação USD→BRL** (campo editável, default R$5,80)
- **Cards resumo**: Total tokens, Custo USD, Custo BRL, Chamadas totais
- **Tabela por função**: Nome da função, descrição do uso, provider, chamadas, tokens, custo R$
- **Gráfico de barras** (Recharts): Top 10 funções por consumo
- **Gráfico de linha**: Evolução diária no mês

**Mapa completo de funções IA no sistema** (hardcoded como referência):

| Função | Ação | Provider |
|--------|------|----------|
| dra-lia | Chat com leads (Dra. L.I.A.) | Lovable + Google |
| evaluate-interaction | Avaliação de qualidade de resposta | Lovable |
| ai-content-formatter | Formatação de conteúdo HTML | Lovable |
| ai-metadata-generator | Geração de SEO (título, excerpt, meta) | Lovable |
| ai-orchestrate-content | Orquestração de conteúdo completo | Lovable |
| ai-enrich-pdf-content | Enriquecimento de PDF | Lovable |
| ai-generate-og-image | Geração de OG Image config | Lovable |
| ai-model-compare | Comparação de modelos | Lovable + DeepSeek |
| translate-content | Tradução EN/ES | Lovable |
| reformat-article-html | Reformatação HTML de artigos | Lovable |
| enrich-article-seo | Enriquecimento SEO de artigos | Lovable |
| extract-pdf-specialized | Extração especializada de PDF | Lovable |
| extract-pdf-text | Extração de texto de PDF | Lovable |
| extract-pdf-raw | Extração raw de PDF | Lovable |
| cognitive-lead-analysis | Análise cognitiva de leads | Lovable |
| backfill-lia-leads | Resumo de histórico de leads | Lovable |
| backfill-keywords | Geração de keywords | Lovable |
| generate-veredict-data | Geração de dados de veredito | Lovable |
| format-processing-instructions | Formatação de instruções | Lovable |
| heal-knowledge-gaps | Geração de drafts para gaps | Lovable + Google |
| extract-commercial-expertise | Extração de expertise comercial | Lovable |
| index-embeddings | Geração de embeddings | Google |
| index-spin-entries | Embeddings SPIN | Google |
| ingest-knowledge-text | Embeddings de KB | Google |

### 4. Instrumentar funções existentes (gradual)

Adicionar logging de tokens nas funções mais críticas (dra-lia, ai-orchestrate-content, translate-content) via insert direto na tabela `ai_token_usage` usando o service-role client já existente.

A API OpenAI-compatible retorna `usage.prompt_tokens` e `usage.completion_tokens` no response — basta capturar e inserir.

### 5. Atualizar `SmartOpsTab.tsx`

- Substituir aba "Modelos IA" → "Tokens IA"
- Trocar `SmartOpsModelCompare` → `SmartOpsAIUsageDashboard`

### Arquivos alterados

| Arquivo | Mudança |
|--------|---------|
| Migration SQL | Tabela `ai_token_usage` |
| `SmartOpsAIUsageDashboard.tsx` | **Novo** — dashboard completo |
| `SmartOpsTab.tsx` | Aba "Modelos IA" → "Tokens IA" |
| `types.ts` | Atualizado automaticamente |
| Edge functions (gradual) | Instrumentação de logging |

Na primeira entrega, o dashboard mostrará a tabela de referência com todas as funções mapeadas e ficará pronto para receber dados assim que as funções forem instrumentadas. A instrumentação das 5 funções mais usadas (dra-lia, translate-content, ai-orchestrate-content, evaluate-interaction, ai-metadata-generator) será incluída nesta mesma entrega.

