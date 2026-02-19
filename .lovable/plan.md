
# Implementação Completa: Judge, Sessions e Painel de Qualidade

## Visão geral do que será construído

3 entregas simultâneas, 1 migração SQL, 4 arquivos modificados, 2 arquivos novos.

---

## Fase 1 — Migração SQL + Coleta de Dados

### 1A. Migração do banco

Adiciona 5 colunas na tabela `agent_interactions` existente e cria a nova tabela `agent_sessions`:

```sql
-- Colunas para o Judge
ALTER TABLE agent_interactions
  ADD COLUMN IF NOT EXISTS context_raw text,
  ADD COLUMN IF NOT EXISTS judge_score integer CHECK (judge_score BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS judge_verdict text,
  ADD COLUMN IF NOT EXISTS judge_evaluated_at timestamptz,
  ADD COLUMN IF NOT EXISTS human_reviewed boolean DEFAULT false;

-- Nova tabela agent_sessions
CREATE TABLE IF NOT EXISTS agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  current_state text NOT NULL DEFAULT 'idle',
  extracted_entities jsonb DEFAULT '{}'::jsonb,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public manage sessions" ON agent_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admins read all sessions" ON agent_sessions FOR SELECT USING (is_admin(auth.uid()));
```

### 1B. Mudança 1 em `supabase/functions/dra-lia/index.ts` — salvar `context_raw`

**Linha 1097-1104** (INSERT em `agent_interactions`): adicionar `context_raw`:

```typescript
// ANTES
.insert({
  session_id,
  user_message: message,
  lang,
  top_similarity: topSimilarity,
  context_sources: contextSources,
  unanswered: false,
})

// DEPOIS
.insert({
  session_id,
  user_message: message,
  lang,
  top_similarity: topSimilarity,
  context_sources: contextSources,
  context_raw: context.slice(0, 8000),
  unanswered: false,
})
```

A variável `context` já existe na linha 992 — é exatamente o texto completo enviado ao LLM. O truncamento a 8000 caracteres garante que parâmetros técnicos (que aparecem primeiro na ordenação do RAG) sejam sempre incluídos.

### 1C. Mudança 2 em `supabase/functions/dra-lia/index.ts` — substituir `detectPrinterDialogState` por `agent_sessions`

A função atual (linhas 318-430) usa regex sobre o texto da última mensagem do assistente. Será substituída por:

1. Busca a sessão no início: `SELECT * FROM agent_sessions WHERE session_id = $1`
2. Valida expiração de 2 horas: `last_activity_at < now() - 2h` → retorna `not_in_dialog` e limpa sessão
3. Usa `current_state` + `extracted_entities` persistidos em vez de regex
4. Após cada step do diálogo, faz UPSERT com merge cumulativo das entidades:

```typescript
const updatedEntities = {
  ...(sessionData?.extracted_entities || {}),
  brand_name: brand.name,
  brand_slug: brand.slug,
  brand_id: brand.id,
};
await supabase.from("agent_sessions").upsert({
  session_id,
  current_state: "needs_model",
  extracted_entities: updatedEntities,
  last_activity_at: new Date().toISOString(),
}, { onConflict: "session_id" });
```

O merge cumulativo garante que se o usuário mudar de marca, o modelo anterior é descartado mas a nova marca é preservada corretamente.

---

## Fase 2 — Nova Edge Function `evaluate-interaction`

### Arquivo novo: `supabase/functions/evaluate-interaction/index.ts`

Baseado exatamente no código fornecido pelo engenheiro, com os guardrails de idempotência:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { record, old_record } = await req.json();

  // Guardrails de idempotência
  if (!record.agent_response || old_record?.agent_response) {
    return new Response("Skip: agent_response not yet filled", { status: 200 });
  }
  if (record.judge_evaluated_at || record.unanswered || !record.context_raw) {
    return new Response("Skip: already evaluated or no context", { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  const judgePrompt = `...`; // prompt compacto com foco em fidelidade técnica

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: judgePrompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  const evaluation = JSON.parse(aiData.choices[0].message.content);

  await supabase.from("agent_interactions")
    .update({ judge_score: evaluation.score, judge_verdict: evaluation.verdict, judge_evaluated_at: new Date().toISOString() })
    .eq("id", record.id);
});
```

### Adição em `supabase/config.toml`

```toml
[functions.evaluate-interaction]
verify_jwt = false

[functions.dra-lia-export]
verify_jwt = false
```

### Por que o Webhook dispara no UPDATE (não no INSERT)

O fluxo em `dra-lia/index.ts` é:
- **INSERT** (linha 1095): salva `user_message`, `context_raw` — `agent_response = NULL`
- **UPDATE** (linha 1163): salva `agent_response` quando o stream termina com `[DONE]`

O Judge só tem material quando `agent_response` é preenchido. O guard `if (!record.agent_response || old_record?.agent_response)` garante que rode apenas nessa transição exata — update de feedback (👍/👎) não re-aciona o Judge.

**Configuração manual do Webhook** (após deploy):
- Supabase Dashboard → Database → Webhooks → New Webhook
- Tabela: `agent_interactions` | Evento: `UPDATE`
- URL: `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/evaluate-interaction`

---

## Fase 3 — Painel de Qualidade em `AdminDraLIAStats.tsx` + `dra-lia-export`

### Mudanças em `src/components/AdminDraLIAStats.tsx`

O componente atual será envolvido em `Tabs` (já disponível no projeto via Radix):

**Aba "Visão Geral"**: todo o conteúdo atual preservado integralmente

**Aba "Qualidade"** (nova):

1. **4 KPIs de qualidade:**
   - Taxa de Alucinação: % de `judge_score = 0` (KPI principal para acompanhar ao longo do tempo)
   - Score Médio do Juiz: média de todos os scores avaliados
   - Interações Avaliadas: total com `judge_evaluated_at IS NOT NULL`
   - Revisadas pelo Time: total com `human_reviewed = true`

2. **Lista de revisão paginada (10/página):**
   - Busca interações com `judge_score <= 2` OU `feedback = 'negative'`
   - Cada item: pergunta, resposta truncada com botão "expandir", badge do verdict (vermelho = hallucination, laranja = off_topic, amarelo = incomplete), score numérico
   - Botão "Marcar como OK" → UPDATE `human_reviewed = true`

3. **Botão "Exportar Dataset JSONL":**
   - Chama `dra-lia-export` via fetch
   - Faz download do arquivo `.jsonl` gerado

A consulta adicional necessária no `fetchData`:
```typescript
const { data: qualityData } = await supabase
  .from("agent_interactions")
  .select("id, created_at, user_message, agent_response, judge_score, judge_verdict, feedback, human_reviewed, judge_evaluated_at")
  .or("judge_score.lte.2,feedback.eq.negative")
  .not("judge_score", "is", null)
  .order("created_at", { ascending: false })
  .limit(50);
```

### Nova edge function: `supabase/functions/dra-lia-export/index.ts`

- Requer admin (valida `Authorization` header via `getClaims`)
- Busca interações `human_reviewed = true AND judge_score >= 4`
- Gera JSONL no formato do Google AI Studio para Gemini fine-tuning:
  ```json
  {"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "pergunta"}, {"role": "model", "content": "resposta"}]}
  ```
- Retorna com `Content-Type: application/x-ndjson` + `Content-Disposition: attachment; filename=lia-dataset.jsonl`

---

## Arquivos modificados e criados

| Ação | Arquivo |
|---|---|
| Nova migração | `supabase/migrations/[timestamp]_add_judge_sessions.sql` |
| Modificado | `supabase/functions/dra-lia/index.ts` — salvar `context_raw` (linha 1097) + refatorar `detectPrinterDialogState` (linhas 318-430) |
| Novo | `supabase/functions/evaluate-interaction/index.ts` |
| Novo | `supabase/functions/dra-lia-export/index.ts` |
| Modificado | `supabase/config.toml` — +2 entradas |
| Modificado | `src/components/AdminDraLIAStats.tsx` — nova aba Qualidade + KPIs + lista de revisão + botão exportar |

---

## Ordem de execução após aprovação

```text
1. Migração SQL executa → colunas criadas, tabela agent_sessions criada
2. dra-lia/index.ts atualizado → context_raw começa a ser salvo + sessions ativas
3. evaluate-interaction + dra-lia-export deployadas
4. config.toml atualizado com as 2 novas entradas
5. AdminDraLIAStats.tsx atualizado com aba Qualidade
6. [Manual] Usuário configura Webhook no Supabase Dashboard
```

A partir do passo 6, cada nova conversa com resposta RAG será avaliada automaticamente pelo Judge em background, sem impacto no tempo de resposta do usuário.
