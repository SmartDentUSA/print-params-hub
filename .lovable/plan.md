

## Plano: Adicionar DeepSeek como segundo avaliador na Curadoria de Memória da L.I.A.

### Contexto

A função `heal-knowledge-gaps` (action `generate`) usa apenas **Gemini** (via Lovable Gateway) para gerar rascunhos de FAQ a partir de lacunas de conhecimento. O objetivo é adicionar **DeepSeek** em paralelo para comparar/melhorar a qualidade dos rascunhos gerados.

### Abordagem: Dual-model na geração de FAQ drafts

Executar Gemini e DeepSeek em paralelo na função `generateFAQDraft`. O resultado consolidado usa a melhor resposta (ou merge dos dois).

### 1. Atualizar `heal-knowledge-gaps/index.ts`

- Na função `generateFAQDraft`, chamar **Gemini** e **DeepSeek** em `Promise.allSettled` (mesmo padrão do `evaluate-interaction`)
- DeepSeek usa API direta com `DEEPSEEK_API_KEY`
- Lógica de merge: se ambos retornam, usa o que tiver mais FAQs e melhor conteúdo; se um falhar, usa o outro como fallback
- Logar tokens de ambos via `logAIUsage`

### 2. Adicionar colunas no `knowledge_gap_drafts` para rastreabilidade

```sql
ALTER TABLE public.knowledge_gap_drafts
  ADD COLUMN IF NOT EXISTS ai_model_used text DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS draft_faq_ds jsonb,
  ADD COLUMN IF NOT EXISTS draft_title_ds text,
  ADD COLUMN IF NOT EXISTS draft_excerpt_ds text;
```

Campos `_ds` guardam a versão do DeepSeek para comparação no painel.

### 3. Atualizar UI (`AdminDraLIAStats.tsx`)

- Na seção de rascunhos pendentes, adicionar toggle/tabs para visualizar a versão Gemini vs DeepSeek lado a lado
- Permitir ao admin escolher qual versão aprovar (ou editar manualmente)

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Migration SQL | 4 colunas novas em `knowledge_gap_drafts` |
| `heal-knowledge-gaps/index.ts` | Dual-model: Gemini + DeepSeek em paralelo na geração de FAQs |
| `AdminDraLIAStats.tsx` | Exibir versões Gemini/DeepSeek lado a lado nos rascunhos |
| `types.ts` | Atualizado automaticamente |

