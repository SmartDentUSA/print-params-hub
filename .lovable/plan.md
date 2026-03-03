

## Plano: Memória Longitudinal para a Dra. LIA

### Problema Atual

O `cognitive-lead-analysis` analisa apenas a conversa **atual** (últimas 50 mensagens da sessão corrente). Não considera:
- Sessões anteriores e seus resumos (`historico_resumos` — já existe como JSONB array com até 20 entradas)
- Deals anteriores do PipeRun (ganhos/perdidos, valores, datas)
- Notas do vendedor no PipeRun
- Evolução do estágio ao longo do tempo (o lead já foi SAL antes? abandonou?)
- Padrões sazonais (contato todo março? ciclo de recompra?)

### O que já existe

| Dado | Onde | Status |
|---|---|---|
| Resumos de sessões anteriores | `lia_attendances.historico_resumos` (JSONB[]) | Existe, max 20 entradas com data+resumo+msgs |
| Dados PipeRun (deal, pipeline, stage, propostas) | `lia_attendances` (30+ campos PipeRun) | Já sincronizado |
| Notas do vendedor PipeRun | PipeRun API `GET /notes?deal_id=X` | Existe na API, **não é puxado** |
| Histórico de conversas anteriores | `agent_interactions` (via bridge leads→lia_attendances) | Existe, usado parcialmente |
| Cursos Astron | `lia_attendances.astron_*` | Já sincronizado |
| E-commerce | `lia_attendances.lojaintegrada_*` | Já sincronizado |

### Solução: Enrichment Pré-Cognitivo em 2 Etapas

**Arquivo principal:** `supabase/functions/cognitive-lead-analysis/index.ts`

**Etapa 1 — Montar "Memória Longitudinal" antes do prompt LLM**

Após o Guard 3, antes de montar o prompt (linha ~99), adicionar uma fase de coleta de contexto longitudinal:

```text
1. historico_resumos → últimas 10 sessões (data, resumo, msgs)
2. Evolução de estágios → consultar cognitive_analysis anterior + lead_stage_detected
3. Dados PipeRun enriquecidos → propostas (proposals_data), status deal, pipeline, 
   data_fechamento, valor_oportunidade, piperun_stage_changed_at
4. Notas PipeRun → GET /notes?deal_id=X (top 5 mais recentes, max 500 chars cada)
5. Astron → cursos completados, último login, planos ativos
6. E-commerce → último pedido, valor, data
```

**Etapa 2 — Expandir o prompt com contexto longitudinal**

Injetar no prompt um bloco `**Memória Longitudinal:**` com os dados coletados, antes do histórico de conversa. Aumentar `max_tokens` de 400 para 500. Adicionar 2 novos eixos de classificação:

- `stage_trajectory`: string descrevendo evolução (ex: "MQL→SAL→abandono→MQL (reentrada)")
- `seasonal_pattern`: string (ex: "Contato recorrente em março", "Primeiro contato")

**Etapa 3 — Persistir os novos campos**

Salvar `stage_trajectory` e `seasonal_pattern` no `cognitive_analysis` JSONB (já é campo livre). Não precisa de migração — o JSONB absorve.

### Mudanças em `piperun-field-map.ts`

Adicionar função `fetchDealNotes(apiToken, dealId, limit)` que faz `GET /notes?deal_id=X&show=5` e retorna array de `{ text, created_at }`.

### Mudanças no `cognitive-lead-analysis/index.ts`

1. **Expandir o SELECT** do Guard 1 para incluir: `historico_resumos, proposals_data, proposals_total_value, piperun_stage_name, piperun_pipeline_name, piperun_created_at, piperun_closed_at, valor_oportunidade, data_fechamento_crm, astron_courses_completed, astron_courses_total, astron_last_login_at, astron_plans_active, lojaintegrada_ultimo_pedido_data, lojaintegrada_ultimo_pedido_valor, lead_stage_detected as previous_stage`

2. **Buscar notas PipeRun** (se `piperun_id` existe e `PIPERUN_API_KEY` disponível) — top 5 notas, truncadas a 200 chars cada

3. **Montar bloco longitudinal** no prompt:
```
**Memória Longitudinal:**
- Sessões anteriores (${n}): [data: resumo] ...
- Estágio anterior: ${previous_stage} | Pipeline: ${pipeline}
- Propostas: R$ ${valor} | Status deal: ${status}
- Notas do vendedor: ${notas}
- Astron: ${cursos} cursos | Último login: ${data}
- E-commerce: Último pedido R$ ${valor} em ${data}
```

4. **Adicionar eixos 9-10** ao prompt: `stage_trajectory` e `seasonal_pattern`

5. **Persistir** no JSONB `cognitive_analysis` (sem mudança de schema)

### Mudanças no `dra-lia/index.ts` (consumo)

No bloco de returning lead (linha ~3303), quando `cognitive_analysis` existe, extrair `stage_trajectory` e `seasonal_pattern` para enriquecer o `lead_archetype` e o `lead_profile` enviado à sessão. Isso faz a LIA "lembrar" do padrão do lead na conversa.

### Resultado Esperado

| Cenário | Antes | Depois |
|---|---|---|
| Lead que abandonou como SAL em março passado | "MQL_pesquisador" (sem contexto) | "SAL_comparador" + trajectory "MQL→SAL→abandono→SAL (reentrada)" |
| Cliente que compra todo março | Urgência "baixa" | Urgência "media" + seasonal "Ciclo anual de recompra em março" |
| Lead com 3 notas do vendedor sobre objeção de preço | Objeção genérica | Objeção "Preço alto (confirmado por vendedor em 3 notas)" |

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/piperun-field-map.ts` | + `fetchDealNotes()` |
| `supabase/functions/cognitive-lead-analysis/index.ts` | Enrichment longitudinal + prompt expandido + 2 novos eixos |
| `supabase/functions/dra-lia/index.ts` | Consumo de `stage_trajectory` e `seasonal_pattern` no returning lead |

