

# Plano: Unificação da Base Existente + Identity Resolution Completa

## Problema Atual

O webhook **só busca por `piperun_id` (deal ID)**. Se a mesma pessoa (person) cria um novo deal no PipeRun, o webhook **não encontra** o lead existente e tenta criar um duplicado. O upsert por email impede duplicata mas **sobrescreve** o `piperun_id` antigo, perdendo o histórico do deal anterior.

```text
HOJE:
  Deal 100 (person: João, email: joao@x.com) → cria lead, piperun_id=100
  Deal 200 (person: João, email: joao@x.com) → upsert por email → piperun_id=200 (PERDEU deal 100)

COM O PLANO:
  Deal 100 → cria lead, piperun_id=100, pessoa_hash=abc, deals_history=[{deal_id:100}]
  Deal 200 → encontra por pessoa_hash=abc → piperun_id=200, deals_history=[{deal_id:100},{deal_id:200}]
```

## O que será feito

### 1. Migration: 3 colunas de identidade + histórico

```sql
ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS pessoa_hash text,
  ADD COLUMN IF NOT EXISTS empresa_hash text,
  ADD COLUMN IF NOT EXISTS piperun_deals_history jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_lia_pessoa_hash ON lia_attendances(pessoa_hash);
CREATE INDEX IF NOT EXISTS idx_lia_empresa_hash ON lia_attendances(empresa_hash);
```

### 2. Identity Resolution em cascata no webhook

Substituir a busca atual (apenas `piperun_id`) por:

```text
1. Buscar por piperun_id = dealId          → match direto (mesmo deal)
2. Se não: buscar por pessoa_hash          → mesma pessoa, deal novo
3. Se não: buscar por pessoa_piperun_id    → mesma pessoa, deal novo
4. Se não: buscar por email                → unificação padrão
5. Se nenhum: criar novo lead
```

Isso garante que **todos os deals de uma mesma pessoa convergem para um único registro** no hub.

### 3. Deals History — acumulação sem perda

A cada webhook, o deal corrente é inserido ou atualizado no array `piperun_deals_history`:

```json
[
  {"deal_id":"100","hash":"x1","pipeline":"Vendas","stage":"Negociação","status":"perdida","value":15000,"closed_at":"2026-01-20","product":"Scanner"},
  {"deal_id":"200","hash":"x2","pipeline":"Vendas","stage":"Proposta","status":"aberta","value":25000,"closed_at":null,"product":"Impressora"}
]
```

O `piperun_id` principal sempre aponta para o **deal ativo mais recente** (status aberto), preservando o link direto no CRM.

### 4. Enriquecimento completo do payload (já planejado)

Todos os campos de Person, Company, Proposals e Deal mapeados para as colunas existentes e novas da `lia_attendances`.

### 5. Secret validation (`X-Webhook-Secret`)

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| Nova migration SQL | +3 colunas + 2 índices |
| `smart-ops-piperun-webhook/index.ts` | Identity resolution cascata + deals history + full payload mapping + secret |
| `src/integrations/supabase/types.ts` | Auto-atualizado |

### Resultado

- Dados existentes na base **não são perdidos** — o webhook só preenche campos vazios (smart merge) ou acumula no histórico
- Múltiplos deals da mesma pessoa **convergem** para o mesmo registro via `pessoa_hash`
- O array `piperun_deals_history` mantém o **histórico completo** de todas as oportunidades
- Empresa associada é rastreada via `empresa_hash` mesmo se mudar de deal para deal

