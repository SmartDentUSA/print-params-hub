

# Plano de Implementacao: Sistema de Qualificacao Cognitiva

## Resumo

Implementar o motor de interpretacao estrategica de conversa que analisa padroes linguisticos, cruza com dados CRM e gera perfil psicologico + recomendacao de abordagem para cada lead. O sistema e desacoplado (edge function propria), assincrono (fire-and-forget) e persistente (JSONB + campos desnormalizados).

---

## Fase 1: Migracao SQL

Adicionar 11 colunas + 3 CHECK constraints + 3 indices em `lia_attendances`:

```sql
ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS cognitive_analysis jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cognitive_updated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_stage_detected text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interest_timeline text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS urgency_level text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS psychological_profile text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS primary_motivation text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS objection_risk text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recommended_approach text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confidence_score_analysis integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prediction_accuracy numeric DEFAULT NULL;

ALTER TABLE lia_attendances
  ADD CONSTRAINT check_lead_stage CHECK (lead_stage_detected IS NULL OR lead_stage_detected IN ('MQL_pesquisador','SAL_comparador','SQL_decisor','CLIENTE_ativo'));
ALTER TABLE lia_attendances
  ADD CONSTRAINT check_urgency_level CHECK (urgency_level IS NULL OR urgency_level IN ('alta','media','baixa'));
ALTER TABLE lia_attendances
  ADD CONSTRAINT check_interest_timeline CHECK (interest_timeline IS NULL OR interest_timeline IN ('imediato','3_6_meses','6_12_meses','indefinido'));

CREATE INDEX IF NOT EXISTS idx_lia_lead_stage ON lia_attendances(lead_stage_detected);
CREATE INDEX IF NOT EXISTS idx_lia_urgency ON lia_attendances(urgency_level);
CREATE INDEX IF NOT EXISTS idx_lia_cognitive_updated ON lia_attendances(cognitive_updated_at);
```

---

## Fase 2: Edge Function `cognitive-lead-analysis/index.ts` (nova, ~170 linhas)

Funcao isolada com:

1. **Input**: `{ email }` ou `{ leadId }`
2. **Guard Clause 1**: Busca lead em `lia_attendances` — se nao encontrar, retorna skip
3. **Guard Clause 2**: Conta `agent_interactions` via join `agent_sessions` — se < 5, retorna `{ skip: "insufficient_messages" }`
4. **Guard Clause 3**: Busca timestamp da ultima interacao — se `cognitive_updated_at >= ultima_interacao.created_at`, retorna `{ skip: "already_current" }`
5. **Busca**: Ultimas 50 interacoes formatadas como `Usuário: {user_message}\nLIA: {agent_response}`
6. **Dados CRM**: nome, area_atuacao, tem_impressora, tem_scanner, impressora_modelo, volume_mensal_pecas, ultima_etapa_comercial, resumo_historico_ia, status_oportunidade
7. **Prompt**: 7 niveis de classificacao com padroes linguisticos especificos do mercado odontologico (MQL_pesquisador, SAL_comparador, SQL_decisor, CLIENTE_ativo + timeline + urgencia emocional + perfil + motivacao + objecao + abordagem)
8. **LLM**: Via `https://ai.gateway.lovable.dev/v1/chat/completions` com `LOVABLE_API_KEY`, modelo `google/gemini-2.5-flash-lite`, `max_tokens: 300`, `AbortController` 10s
9. **Sanitizacao 3 camadas**: Regex `{...}` → limpeza markdown → parse defensivo
10. **Validacao enums**: Arrays `VALID_STAGES`, `VALID_URGENCY`, `VALID_TIMELINE` — valores invalidos se tornam NULL (evita violacao de CHECK constraint)
11. **Upsert**: `cognitive_updated_at = now()` APENAS apos sucesso do parse + validacao. Campos desnormalizados + `cognitive_analysis` JSONB completo
12. **Auth**: `SUPABASE_SERVICE_ROLE_KEY` para bypass RLS

---

## Fase 3: Config TOML

Adicionar ao `supabase/config.toml`:
```toml
[functions.cognitive-lead-analysis]
verify_jwt = false
```

---

## Fase 4: Integracao `dra-lia/index.ts` — Fire-and-forget no `summarize_session`

Apos linha 2422 (apos `extractImplicitLeadData`), inserir ~8 linhas:

```typescript
const totalMsgs = previousMessages + sessionMsgCount;
if (totalMsgs >= 5 && leadEmail) {
  fetch(`${SUPABASE_URL}/functions/v1/cognitive-lead-analysis`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: leadEmail }),
  }).catch(e => console.warn("[cognitive] fire-and-forget error:", e));
}
```

---

## Fase 5: Integracao `dra-lia/index.ts` — Bloco cognitivo imperativo no prompt

Na zona da linha 3480-3488, apos `classifyLeadMaturity`:

1. Buscar `cognitive_analysis` de `lia_attendances` (mesma query, adicionar campos cognitivos ao select existente na `classifyLeadMaturity`)
2. Modificar `buildCommercialInstruction` para aceitar parametro `cognitiveData` opcional
3. Injetar bloco imperativo quando disponivel:

```typescript
const cognitiveBlock = cognitiveData ? `
### ESTADO COGNITIVO DO LEAD (ESTRITAMENTE OBRIGATORIO)
Estagio: ${cognitiveData.lead_stage_detected}
Perfil: ${cognitiveData.psychological_profile}
Urgencia: ${cognitiveData.urgency_level}
Motivacao: ${cognitiveData.primary_motivation}
Risco objecao: ${cognitiveData.objection_risk}
ABORDAGEM OBRIGATORIA: ${cognitiveData.recommended_approach}
- Se MQL: Foque em educacao e riscos invisiveis (Persona Auditora).
- Se SAL: Foque em Prova Social e Modelo Smart Dent (Persona Mentora).
- Se SQL: Seja direta, remova friccao, use gatilhos de fechamento.
SIGA esta abordagem. NAO contrarie.` : "";
```

4. Quando `lead_stage_detected` existir, usar como override de `leadMaturity` (ex: `SQL_decisor` → `SQL`)

---

## Fase 6: Feedback Loop no `smart-ops-piperun-webhook/index.ts`

Apos linha 254 (bloco `deal.status === "won"`), adicionar ~15 linhas:

1. Buscar `cognitive_analysis` de `lia_attendances` para o lead
2. Calcular `prediction_accuracy` comparando previsoes com resultado real
3. Disparar reanálise cognitiva fire-and-forget quando estagio CRM muda (linha 243)

---

## Fase 7: Dashboard `SmartOpsLeadsList.tsx`

1. Adicionar campos cognitivos ao interface `LeadFull` (linhas 38-103)
2. Adicionar filtro dropdown por `lead_stage_detected`
3. Renderizar na tabela:
   - Badge `lead_stage_detected`: MQL (cinza), SAL (azul), SQL (verde), CLIENTE (roxo)
   - Icone urgencia: vermelho (alta), amarelo (media), verde (baixa)
   - Tooltip em `recommended_approach` ao hover
4. Modal de detalhe: adicionar secao "Analise Cognitiva" com JSON formatado

---

## Arquivos Modificados

| # | Arquivo | Acao |
|---|---------|------|
| 1 | Migracao SQL | 11 colunas + 3 constraints + 3 indices |
| 2 | `supabase/functions/cognitive-lead-analysis/index.ts` | NOVO (~170 linhas) |
| 3 | `supabase/config.toml` | +3 linhas |
| 4 | `supabase/functions/dra-lia/index.ts` | Fire-and-forget (~8 linhas) + cognitivo no prompt (~30 linhas) + ampliar `classifyLeadMaturity` select |
| 5 | `supabase/functions/smart-ops-piperun-webhook/index.ts` | Feedback loop (~15 linhas) + reanálise fire-and-forget (~5 linhas) |
| 6 | `src/components/SmartOpsLeadsList.tsx` | Badges, filtro, tooltip, modal cognitivo (~60 linhas) |

## Ordem de Execucao

```text
1. Migracao SQL
2. Criar cognitive-lead-analysis/index.ts + deploy
3. Atualizar config.toml
4. Modificar dra-lia/index.ts
5. Modificar smart-ops-piperun-webhook/index.ts
6. Atualizar SmartOpsLeadsList.tsx
```

