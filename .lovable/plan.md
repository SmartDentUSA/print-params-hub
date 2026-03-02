

## Plano: Adicionar DeepSeek como segundo Judge IA

### Abordagem

Executar **ambos os modelos em paralelo** (Gemini + DeepSeek) e salvar os dois resultados. O score final será a **média dos dois**, dando mais robustez à avaliação. Se um falhar, usa o outro como fallback.

### 1. Migration: Colunas para o segundo juiz

```sql
ALTER TABLE public.agent_interactions
  ADD COLUMN IF NOT EXISTS judge_score_ds integer,
  ADD COLUMN IF NOT EXISTS judge_verdict_ds text,
  ADD COLUMN IF NOT EXISTS judge_reason_ds text,
  ADD COLUMN IF NOT EXISTS judge_reason text;
```

Campos `_ds` = resultado do DeepSeek. O `judge_score` e `judge_verdict` originais continuam sendo o Gemini. Adicionar `judge_reason` e `judge_reason_ds` para guardar as explicações de cada modelo.

### 2. Atualizar `evaluate-interaction/index.ts`

- Chamar **Gemini** e **DeepSeek** em `Promise.allSettled` (paralelo)
- DeepSeek usa API direta (`https://api.deepseek.com/chat/completions`) com `DEEPSEEK_API_KEY` (já configurada nos secrets)
- Salvar resultados independentes: `judge_score` + `judge_verdict` + `judge_reason` (Gemini) e `judge_score_ds` + `judge_verdict_ds` + `judge_reason_ds` (DeepSeek)
- Score final consolidado = média arredondada dos dois scores (ou o que existir se um falhar)
- Logar tokens de ambos os provedores via `logAIUsage`

### 3. Atualizar UI (`AdminDraLIAStats.tsx`)

- Exibir os dois scores lado a lado na lista de interações problemáticas (badge Gemini + badge DeepSeek)
- Mostrar reason de cada modelo no expand

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Migration SQL | 4 colunas novas (`judge_score_ds`, `judge_verdict_ds`, `judge_reason_ds`, `judge_reason`) |
| `evaluate-interaction/index.ts` | Dual-model: Gemini + DeepSeek em paralelo |
| `AdminDraLIAStats.tsx` | Exibir scores dos dois modelos |
| `types.ts` | Atualizado automaticamente |

